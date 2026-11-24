#!/usr/bin/env node
// FE-24: đo độ chính xác chấm điểm AI của luồng 1 (đặt lịch xem nhà) trên bộ 20 lead có nhãn.
//
// Với mỗi lead: đặt lịch qua POST /api/viewings để luồng 1 chạy thật, đợi AI chấm xong, đọc level/score, so với nhãn.
// Chỉ chạy trên backend local. Chi tiết: docs/do-luong-cham-diem-ai.md, openspec/changes/fe24-lead-scoring-eval/design.md.
//
// Ví dụ:
//   EVAL_USER=admin@local EVAL_PASSWORD=... WEBHOOK_SECRET=... node scripts/eval-lead-scoring.cjs --repeat 3
//   node scripts/eval-lead-scoring.cjs --dry-run            # không gọi mạng, kiểm phần tính số
const fs = require('node:fs');
const path = require('node:path');
const { validateCases, loadCases, DEFAULT_CASES, LEVELS } = require('./check-lead-scoring-eval.cjs');
const { computeMetrics, renderReport } = require('./lib/lead-scoring-metrics.cjs');

const SOURCE = 'eval-fe24';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const HOUR_MS = 3600000;
// Bỏ vài khung sớm nhất: "khung sớm nhất" dịch tới giờ kế tiếp trong lúc chạy, khung sát mép sẽ bị từ chối
const SLOT_MARGIN_HOURS = 2;
const MAX_PROPERTY_CANDIDATES = 10;
const DEFAULTS = { api: 'http://localhost:8081', repeat: 1, concurrency: 2, timeoutS: 120, pollMs: 3000 };
// Điểm giả của chế độ --dry-run: mỗi mức một điểm đại diện
const DRY_SCORE = { HOT: 85, WARM: 55, COLD: 15 };

const CLEANUP_SQL = `DELETE FROM lead_events WHERE lead_id IN (SELECT id FROM leads WHERE source = '${SOURCE}');
DELETE FROM followup_tasks WHERE lead_id IN (SELECT id FROM leads WHERE source = '${SOURCE}');
DELETE FROM viewings WHERE lead_id IN (SELECT id FROM leads WHERE source = '${SOURCE}');
DELETE FROM leads WHERE source = '${SOURCE}';`;

const USAGE = `Dùng: node scripts/eval-lead-scoring.cjs [tuỳ chọn]

  --api <url>          Backend local (mặc định ${DEFAULTS.api}); chỉ nhận localhost, 127.0.0.1, [::1]
  --repeat <n>         Số lần chạy mỗi lead (mặc định ${DEFAULTS.repeat})
  --concurrency <n>    Số lượt chạy cùng lúc (mặc định ${DEFAULTS.concurrency})
  --timeout-s <n>      Giây chờ AI chấm tối đa mỗi lượt (mặc định ${DEFAULTS.timeoutS})
  --only <id,id,...>   Chỉ chạy các lead này (chạy lại phần lỗi)
  --property <id>      Căn dùng để đặt lịch (mặc định: căn đang mở bán đầu tiên đủ khung giờ)
  --cases <tệp>        Bộ lead (mặc định eval/lead-scoring/cases.json)
  --out <tiền tố>      Ghi <tiền tố>.json và <tiền tố>.md (mặc định eval/lead-scoring/results/<ngày>-<giờ>)
  --poll-ms <n>        Chu kỳ hỏi kết quả, mili giây (mặc định ${DEFAULTS.pollMs})
  --model <chữ>        Ghi tên mô hình vào báo cáo (mặc định đọc từ n8n-workflows/luong-1-dat-lich.json)
  --dry-run            Bộ chấm giả trả đúng nhãn, không gọi mạng
  --help               Hiện trợ giúp

Biến môi trường (không cần khi --dry-run): EVAL_USER, EVAL_PASSWORD (đăng nhập /api/auth/login),
WEBHOOK_SECRET (bỏ giới hạn đặt lịch 5 lần mỗi 10 phút).`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { ...DEFAULTS, dryRun: false, help: false, cases: DEFAULT_CASES, out: null, only: null, property: null, model: null };
  const intOpt = (name, value, min) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min) throw new UsageError(`${name} phải là số nguyên từ ${min}, nhận "${value}"`);
    return n;
  };
  for (let i = 0; i < argv.length; i += 1) {
    let arg = argv[i];
    let inline = null;
    const eq = arg.indexOf('=');
    if (arg.startsWith('--') && eq > -1) { inline = arg.slice(eq + 1); arg = arg.slice(0, eq); }
    const value = () => {
      const v = inline ?? argv[++i];
      if (v === undefined || (inline === null && v.startsWith('--'))) throw new UsageError(`${arg} cần một giá trị`);
      return v;
    };
    switch (arg) {
      case '--api': opts.api = value(); break;
      case '--repeat': opts.repeat = intOpt('--repeat', value(), 1); break;
      case '--concurrency': opts.concurrency = intOpt('--concurrency', value(), 1); break;
      case '--timeout-s': opts.timeoutS = intOpt('--timeout-s', value(), 1); break;
      case '--poll-ms': opts.pollMs = intOpt('--poll-ms', value(), 1); break;
      case '--property': opts.property = intOpt('--property', value(), 1); break;
      case '--only': opts.only = value().split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--cases': opts.cases = path.resolve(value()); break;
      case '--out': opts.out = path.resolve(value()); break;
      case '--model': opts.model = value(); break;
      case '--dry-run': opts.dryRun = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new UsageError(`Tham số lạ: ${arg}`);
    }
  }
  if (opts.repeat > 99) throw new UsageError('--repeat tối đa 99');
  return opts;
}

// Chỉ nhận đúng ba tên máy; "localhost.evil.com" hay "localhost@evil.com" đều không qua.
function assertLocalApi(api) {
  let url;
  try { url = new URL(api); } catch { throw new UsageError(`--api "${api}" không phải địa chỉ hợp lệ`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UsageError(`--api phải là http hoặc https, nhận "${url.protocol}"`);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new UsageError(`Từ chối chạy: --api trỏ tới "${url.hostname}", không phải localhost, 127.0.0.1 hay [::1]. Phép đo tạo lead mẫu và gửi thư nên chỉ chạy trên máy local.`);
  }
  return url.origin;
}

function requireEnv(env) {
  const missing = ['EVAL_USER', 'EVAL_PASSWORD', 'WEBHOOK_SECRET'].filter((k) => !env[k]);
  if (missing.length > 0) throw new UsageError(`Thiếu biến môi trường: ${missing.join(', ')}. Đặt chúng trước khi chạy (xem --help).`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fmtS = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

// Dựng nội dung đặt lịch cho một lượt. Mã chạy nằm trong email và số điện thoại để lần chạy sau không đụng "một khách một lead".
function buildBooking(testCase, caseIndex, run, runCode, property, slotStart) {
  const body = {
    name: `[EVAL] ${testCase.id} #${run}`,
    email: `eval-${runCode}-${testCase.id}-${run}@eval.invalid`,
    phone: `09${runCode}${String(caseIndex).padStart(2, '0')}${String(run).padStart(2, '0')}`,
    budget: Math.round(Number(property.price) * testCase.ratio),
    propertyId: property.id,
    viewingTime: slotStart,
    source: SOURCE,
    consentMarketing: false,
  };
  if (testCase.needs && testCase.needs.trim()) body.needs = testCase.needs;
  return body;
}

function modelFromWorkflow() {
  try {
    const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows/luong-1-dat-lich.json'), 'utf8'));
    const node = wf.nodes.find((n) => /lmChat/i.test(n.type));
    return node?.parameters?.modelName ? `${node.parameters.modelName} (theo n8n-workflows/luong-1-dat-lich.json)` : null;
  } catch { return null; }
}

function nonMeasuredSection(results) {
  const bad = results.filter((r) => r.status !== 'SCORED' || !LEVELS.includes(r.level));
  if (bad.length === 0) return '';
  const lines = ['## Lượt lỗi hoặc quá hạn chờ', '', '| Lead | Lượt | Trạng thái | Chi tiết |', '| --- | ---: | --- | --- |'];
  for (const r of bad) lines.push(`| ${r.caseId} | ${r.run} | ${r.status} | ${String(r.detail ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')} |`);
  const ids = [...new Set(bad.map((r) => r.caseId))].join(',');
  lines.push('', `Chạy lại phần lỗi: \`node scripts/eval-lead-scoring.cjs --only ${ids}\``, '');
  return lines.join('\n');
}

function writeOutputs(prefix, payload, markdown) {
  fs.mkdirSync(path.dirname(prefix), { recursive: true });
  fs.writeFileSync(`${prefix}.json`, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(`${prefix}.md`, `${markdown}\n`);
  return [`${prefix}.json`, `${prefix}.md`];
}

function defaultOutPrefix(date) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return path.join(__dirname, '../eval/lead-scoring/results', stamp);
}

// io: { log, error, fetch } — tiêm vào để kiểm thử; mặc định dùng console và fetch của Node.
async function run(argv, env, io = {}) {
  const log = io.log ?? console.log;
  const error = io.error ?? console.error;
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.help) { log(USAGE); return 0; }
    if (!opts.dryRun) {
      opts.api = assertLocalApi(opts.api); // trước mọi thứ khác, kể cả kiểm biến môi trường
      requireEnv(env);
    }

    const all = loadCases(opts.cases);
    const problems = validateCases(all);
    if (problems.length > 0) throw new UsageError(`Bộ lead không hợp lệ:\n  - ${problems.join('\n  - ')}`);
    if (opts.only) {
      const unknown = opts.only.filter((id) => !all.some((c) => c.id === id));
      if (unknown.length > 0) throw new UsageError(`--only có id không có trong bộ lead: ${unknown.join(', ')}`);
    }
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    error(`Lỗi: ${e.message}`);
    return 2;
  }

  const all = loadCases(opts.cases);
  const selected = all.map((c, i) => ({ c, caseIndex: i + 1 })).filter(({ c }) => !opts.only || opts.only.includes(c.id));
  const startedAt = new Date();
  const meta = { model: opts.model ?? modelFromWorkflow() ?? 'không rõ', date: startedAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC', repeat: opts.repeat };

  if (opts.dryRun) return runDry(opts, selected, meta, { log, error });

  const doFetch = (...a) => (io.fetch ?? globalThis.fetch)(...a);
  const api = {
    token: null,
    async call(method, route, { body, auth = false, headers = {} } = {}) {
      const send = () => doFetch(`${opts.api}${route}`, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${this.token}` } : {}), ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
      });
      let res = await send();
      if (res.status === 401 && auth) { await this.login(); res = await send(); } // token hết hạn giữa chừng
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 200) }; }
      return { status: res.status, data };
    },
    async login() {
      const res = await doFetch(`${opts.api}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: env.EVAL_USER, password: env.EVAL_PASSWORD }), signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => null);
      if (res.status !== 200 && res.status !== 201) throw new Error(`Đăng nhập thất bại (HTTP ${res.status}): kiểm EVAL_USER và EVAL_PASSWORD`);
      if (!data?.accessToken) throw new Error('Đăng nhập không trả accessToken');
      this.token = data.accessToken;
    },
  };

  const items = [];
  for (let r = 1; r <= opts.repeat; r += 1) for (const s of selected) items.push({ ...s, run: r });
  const need = items.length;

  // --- Chuẩn bị: đăng nhập, chọn căn, lấy khung giờ. Mọi lỗi ở đây xảy ra trước khi tạo lead nào. ---
  let property;
  let slotList;
  try {
    await api.login();
    const list = await api.call('GET', '/api/properties');
    if (list.status !== 200 || !Array.isArray(list.data)) throw new Error(`Không lấy được danh sách căn (HTTP ${list.status})`);
    let candidates = list.data.filter((p) => p.status === 'AVAILABLE' && Number(p.price) > 0).sort((a, b) => a.id - b.id);
    if (opts.property) candidates = candidates.filter((p) => p.id === opts.property);
    if (candidates.length === 0) throw new Error(opts.property ? `Căn ${opts.property} không có hoặc không đang mở bán` : 'Không có căn nào đang mở bán');

    let best = null;
    for (const p of candidates.slice(0, MAX_PROPERTY_CANDIDATES)) {
      const res = await api.call('GET', `/api/viewings/slots?propertyId=${p.id}`);
      if (res.status !== 200) continue;
      const free = res.data.days.flatMap((d) => d.slots).filter((s) => s.available)
        .map((s) => s.start).sort((a, b) => Date.parse(a) - Date.parse(b));
      const margin = Date.parse(res.data.earliest) + SLOT_MARGIN_HOURS * HOUR_MS;
      const margined = free.filter((s) => Date.parse(s) >= margin);
      if (!best || free.length > best.free.length) best = { property: p, free, margined };
      if (free.length >= need) { best = { property: p, free, margined }; break; }
    }
    if (!best) throw new Error('Không lấy được khung giờ của căn nào');
    if (best.free.length < need) {
      error(`Không đủ khung giờ: cần ${need} khung (${selected.length} lead × ${opts.repeat} lần), căn "${best.property.name}" (id ${best.property.id}) còn ${best.free.length}, thiếu ${need - best.free.length}. Chưa tạo lead nào.`);
      error('Cách xử lý: giảm --repeat, hoặc dọn lead mẫu cũ để trả khung (chạy trên DB local):');
      error(CLEANUP_SQL);
      return 1;
    }
    property = best.property;
    slotList = (best.margined.length >= need ? best.margined : best.free).slice(0, need);
  } catch (e) {
    error(`Lỗi chuẩn bị: ${e.message}. Chưa tạo lead nào.`);
    return 1;
  }

  const runCode = String(Math.floor(startedAt.getTime() / 1000) % 100000).padStart(5, '0');
  items.forEach((item, i) => { item.slot = slotList[i]; });
  log(`Đo ${selected.length} lead × ${opts.repeat} lần = ${need} lượt trên căn "${property.name}" (id ${property.id}, giá ${Number(property.price).toLocaleString('vi-VN')} đ), chạy ${opts.concurrency} lượt cùng lúc.`);

  const seenLeadIds = new Set();
  const results = new Array(items.length);
  let done = 0;

  async function measure(item) {
    const { c, caseIndex, run: runNo, slot } = item;
    const base = { caseId: c.id, label: c.label, run: runNo, slot, leadId: null, level: null, score: null, reason: null, latencyS: null, detail: null };
    const t0 = Date.now();
    try {
      const booking = buildBooking(c, caseIndex, runNo, runCode, property, slot);
      const created = await api.call('POST', '/api/viewings', { body: booking, headers: { 'X-Webhook-Secret': env.WEBHOOK_SECRET } });
      if (created.status !== 201 && created.status !== 200) {
        return { ...base, status: 'FAILED', detail: `Đặt lịch lỗi HTTP ${created.status}: ${[].concat(created.data?.message ?? '').join('; ')}` };
      }
      const leadId = created.data?.lead?.id;
      if (!leadId || seenLeadIds.has(leadId)) return { ...base, status: 'FAILED', detail: `Phản hồi đặt lịch không có lead mới (lead id ${leadId ?? 'trống'})` };
      seenLeadIds.add(leadId);
      base.leadId = leadId;

      let lastNote = 'chưa có điểm';
      while (Date.now() - t0 < opts.timeoutS * 1000) {
        await sleep(opts.pollMs);
        let res;
        try { res = await api.call('GET', `/api/leads/${leadId}`, { auth: true }); } catch (e) { lastNote = `lỗi khi hỏi kết quả: ${e.message}`; continue; }
        if (res.status !== 200) { lastNote = `hỏi kết quả HTTP ${res.status}`; continue; }
        const lead = res.data;
        if (lead.level) {
          const latencyS = (Date.now() - t0) / 1000;
          if (!LEVELS.includes(lead.level)) return { ...base, status: 'FAILED', latencyS, detail: `AI trả level không hợp lệ: "${lead.level}"` };
          return { ...base, status: 'SCORED', level: lead.level, score: lead.score, reason: lead.reason, latencyS };
        }
        if (lead.automationStatus === 'FAILED') return { ...base, status: 'FAILED', detail: `Luồng báo lỗi: ${lead.automationError ?? 'không có chi tiết'}` };
      }
      return { ...base, status: 'TIMEOUT', detail: `Không có điểm sau ${opts.timeoutS} s (${lastNote})` };
    } catch (e) {
      return { ...base, status: 'FAILED', detail: `Lỗi khi đo: ${e.message}` };
    }
  }

  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      const r = await measure(items[i]);
      results[i] = r;
      done += 1;
      const outcome = r.status === 'SCORED' ? `${r.level} (${r.score}) ${fmtS(r.latencyS)} s${r.level === r.label ? '' : `, kỳ vọng ${r.label}`}` : `${r.status}: ${r.detail}`;
      log(`[${done}/${need}] ${r.caseId} #${r.run} → ${outcome}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency, items.length) }, worker));

  const metrics = computeMetrics(results);
  const report = `${renderReport(metrics, { ...meta, api: opts.api, property: `${property.name} (id ${property.id})` })}\n${nonMeasuredSection(results)}`;
  const prefix = opts.out ?? defaultOutPrefix(startedAt);
  const files = writeOutputs(prefix, { meta: { ...meta, api: opts.api, propertyId: property.id, runCode, source: SOURCE }, metrics, results }, report);
  log(`\n${report}`);
  log(`Đã ghi: ${files.join(', ')}`);
  log(`\nDọn lead mẫu khỏi DB local khi xong (script không tự xoá):\n${CLEANUP_SQL}`);
  return metrics.measured === 0 ? 1 : 0;
}

// Chế độ mô phỏng: bộ chấm giả trả đúng nhãn. Chặn fetch toàn cục để chứng minh không có kết nối mạng.
async function runDry(opts, selected, meta, { log, error }) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('--dry-run không được gọi mạng'); };
  try {
    const results = [];
    for (let r = 1; r <= opts.repeat; r += 1) {
      for (const { c } of selected) {
        results.push({ caseId: c.id, label: c.label, run: r, status: 'SCORED', level: c.label, score: DRY_SCORE[c.label], reason: 'Bộ chấm giả (--dry-run)', latencyS: 0, leadId: null, detail: null });
      }
    }
    const metrics = computeMetrics(results);
    const report = renderReport(metrics, { ...meta, model: 'bộ chấm giả (--dry-run)', api: 'không gọi mạng', property: 'giả lập' });
    log(report);
    if (opts.out) log(`Đã ghi: ${writeOutputs(opts.out, { meta: { ...meta, dryRun: true }, metrics, results }, report).join(', ')}`);
    return 0;
  } catch (e) {
    error(`Lỗi: ${e.message}`);
    return 1;
  } finally {
    globalThis.fetch = realFetch;
  }
}

module.exports = { run, parseArgs, assertLocalApi, buildBooking, CLEANUP_SQL, SOURCE };

if (require.main === module) {
  run(process.argv.slice(2), process.env).then((code) => { process.exitCode = code; }, (e) => { console.error(e); process.exitCode = 1; });
}
