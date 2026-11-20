// FE-24: kiểm bộ 20 lead có nhãn của phép đo chấm điểm AI.
// Chạy: node scripts/check-lead-scoring-eval.cjs [--cases đường-dẫn]  (không cần n8n, backend hay mạng)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const DEFAULT_CASES = path.join(__dirname, '../eval/lead-scoring/cases.json');
const LEVELS = ['HOT', 'WARM', 'COLD'];
const EXPECTED_TOTAL = 20;
const EXPECTED_PER_LEVEL = { HOT: 6, WARM: 8, COLD: 6 };
const REQUIRED_TAGS = ['vague-needs', 'low-budget', 'zero-budget', 'gibberish', 'injection'];
const KNOWN_TAGS = new Set([...REQUIRED_TAGS, 'boundary', 'high-budget', 'empty-needs']);
const MAX_RATIO = 2;

// Trả về danh sách lỗi (chuỗi); rỗng nghĩa là bộ lead hợp lệ. Mỗi lỗi nêu id lead sai.
function validateCases(cases) {
  const errors = [];
  if (!Array.isArray(cases)) return ['Tệp bộ lead phải là một mảng'];
  if (cases.length !== EXPECTED_TOTAL) errors.push(`Bộ lead có ${cases.length} lead, cần đúng ${EXPECTED_TOTAL}`);

  const seen = new Set();
  const perLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  const perTag = Object.fromEntries(REQUIRED_TAGS.map((t) => [t, 0]));

  cases.forEach((c, index) => {
    const id = c && typeof c.id === 'string' && c.id.trim() ? c.id : `#${index + 1}`;
    const fail = (msg) => errors.push(`Lead ${id}: ${msg}`);
    if (!c || typeof c !== 'object') return fail('không phải đối tượng');

    if (typeof c.id !== 'string' || !c.id.trim()) fail('thiếu id');
    else if (seen.has(c.id)) fail('id bị trùng');
    else seen.add(c.id);

    if (!LEVELS.includes(c.label)) fail(`nhãn "${c.label}" không thuộc ${LEVELS.join(', ')}`);
    else perLevel[c.label] += 1;

    if (typeof c.ratio !== 'number' || !Number.isFinite(c.ratio) || c.ratio < 0 || c.ratio > MAX_RATIO) {
      fail(`ratio "${c.ratio}" phải là số từ 0 đến ${MAX_RATIO}`);
    }
    if (typeof c.needs !== 'string') fail('needs phải là chuỗi (có thể rỗng)');
    if (typeof c.rationale !== 'string' || !c.rationale.trim()) fail('thiếu rationale');

    if (!Array.isArray(c.tags)) fail('tags phải là mảng');
    else {
      for (const t of c.tags) {
        if (!KNOWN_TAGS.has(t)) fail(`tag "${t}" không có trong danh sách`);
        if (t in perTag) perTag[t] += 1;
      }
      if (c.tags.includes('zero-budget') !== (c.ratio === 0)) fail('tag zero-budget phải đi cùng ratio 0 và ngược lại');
    }

    // Nhãn phải khớp các quy tắc cơ học của rubric (docs/do-luong-cham-diem-ai.md mục 1.2)
    if (LEVELS.includes(c.label) && typeof c.ratio === 'number') {
      if (c.ratio < 0.5 && c.label !== 'COLD') fail(`ratio ${c.ratio} dưới 0,5 phải là COLD theo rubric`);
      if (c.ratio < 0.9 && c.label === 'HOT') fail(`ratio ${c.ratio} dưới 0,9 không thể là HOT theo rubric`);
      if (Array.isArray(c.tags) && (c.tags.includes('gibberish') || c.tags.includes('injection')) && c.label !== 'COLD') {
        fail('lead vô nghĩa hoặc thao túng phải là COLD theo rubric');
      }
    }
  });

  for (const l of LEVELS) {
    if (perLevel[l] !== EXPECTED_PER_LEVEL[l]) errors.push(`Mức ${l} có ${perLevel[l]} lead, cần ${EXPECTED_PER_LEVEL[l]}`);
  }
  for (const t of REQUIRED_TAGS) {
    if (perTag[t] < 1) errors.push(`Thiếu lead mang tag ${t}`);
  }
  return errors;
}

function loadCases(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

module.exports = { validateCases, loadCases, DEFAULT_CASES, LEVELS };

if (require.main === module) {
  const argIndex = process.argv.indexOf('--cases');
  const file = argIndex > -1 ? path.resolve(process.argv[argIndex + 1] ?? '') : DEFAULT_CASES;
  const cases = loadCases(file);

  // 1. Bộ lead thật phải hợp lệ
  const errors = validateCases(cases);
  if (errors.length > 0) {
    console.error('FAIL bộ lead không hợp lệ:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  // 2. Bản hỏng phải bị bắt và nêu đúng lead
  const clone = () => JSON.parse(JSON.stringify(cases));
  const mutate = (fn) => {
    const copy = clone();
    fn(copy);
    return validateCases(copy);
  };
  const typo = mutate((c) => { c[0].label = 'HOTT'; });
  assert.ok(typo.some((e) => e.includes(cases[0].id) && e.includes('HOTT')), 'nhãn HOTT phải bị báo và nêu đúng lead');
  assert.ok(mutate((c) => { c[3].id = c[2].id; }).some((e) => e.includes('trùng')), 'id trùng phải bị báo');
  assert.ok(mutate((c) => { c.pop(); }).some((e) => e.includes('cần đúng 20')), 'thiếu lead phải bị báo');
  assert.ok(mutate((c) => { c[1].ratio = 2.5; }).some((e) => e.includes(cases[1].id) && e.includes('ratio')), 'ratio quá 2 phải bị báo');
  assert.ok(mutate((c) => { c[2].rationale = ''; }).some((e) => e.includes(cases[2].id) && e.includes('rationale')), 'thiếu rationale phải bị báo');
  assert.ok(mutate((c) => { for (const x of c) x.tags = x.tags.filter((t) => t !== 'injection'); }).some((e) => e.includes('injection')), 'thiếu tag injection phải bị báo');
  const coldHot = cases.findIndex((c) => c.label === 'COLD' && c.ratio < 0.5);
  assert.ok(mutate((c) => { c[coldHot].label = 'HOT'; }).some((e) => e.includes(cases[coldHot].id) && e.includes('rubric')), 'ngân sách thấp mà gán HOT phải bị báo');

  console.log(`PASS bộ lead hợp lệ: ${cases.length} lead (${LEVELS.map((l) => `${l} ${cases.filter((c) => c.label === l).length}`).join(', ')}), kiểm lỗi giả định đều bị bắt`);

  runMetricsTests();
  runRunnerTests().catch((e) => { console.error('FAIL runner:', e); process.exit(1); });
}

// FE-24 mục 2: phần tính số liệu, đúng các ví dụ số của spec và các trường hợp biên.
function runMetricsTests() {
  const { computeMetrics, renderReport, median, percentile } = require('./lib/lead-scoring-metrics.cjs');
  const scored = (caseId, label, level, latencyS, run = 1, extra = {}) => ({ caseId, label, run, status: 'SCORED', level, score: 50, reason: `lý do ${caseId}`, latencyS, ...extra });
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} khác ${b}`);
  const noJunk = (text) => assert.ok(!/NaN|undefined|Infinity/.test(text), 'báo cáo không được chứa NaN, undefined hay Infinity');

  // Mẫu của spec: 18 đo được, 15 đúng, 2 lệch một bậc, 1 lệch hai bậc, thêm 2 lượt lỗi
  const sample = [];
  let t = 0;
  const add = (label, level, n) => { for (let i = 0; i < n; i += 1) { t += 1; sample.push(scored(`${label}-${level}-${i}`, label, level, t)); } };
  add('HOT', 'HOT', 5); add('WARM', 'WARM', 5); add('COLD', 'COLD', 5); // 15 đúng
  add('WARM', 'HOT', 1); add('COLD', 'WARM', 1); // 2 lệch một bậc
  add('HOT', 'COLD', 1); // 1 lệch hai bậc
  sample.push({ caseId: 'err-1', label: 'HOT', run: 1, status: 'FAILED', latencyS: 999 });
  sample.push({ caseId: 'err-2', label: 'WARM', run: 1, status: 'TIMEOUT', latencyS: 999 });
  const m = computeMetrics(sample);
  assert.equal(m.total, 20); assert.equal(m.measured, 18); assert.equal(m.errors, 2);
  assert.equal(m.failed, 1); assert.equal(m.timedOut, 1);
  assert.equal(m.exact, 15); near(m.exactRate, 15 / 18);
  assert.equal(m.withinOne, 17); near(m.withinOneRate, 17 / 18);
  assert.equal(m.severe, 1);
  near(m.errorRate, 2 / 20);
  assert.deepEqual(m.confusion.HOT, { HOT: 5, WARM: 0, COLD: 1 });
  assert.deepEqual(m.confusion.WARM, { HOT: 1, WARM: 5, COLD: 0 });
  assert.deepEqual(m.confusion.COLD, { HOT: 0, WARM: 1, COLD: 5 });
  assert.equal(m.wrong.length, 3);
  assert.equal(m.latency.count, 18); // lượt lỗi (latency 999) không vào độ trễ
  assert.equal(m.latency.median, 9.5); assert.equal(m.latency.p95, 18);
  assert.equal(m.consistency, null, 'không lặp thì không có mục nhất quán');
  const report = renderReport(m, { model: 'gemini-test', date: '2026-01-01', repeat: 1 });
  assert.ok(report.includes('15/18 (83,3%)'), 'báo cáo phải có 15/18 (83,3%)');
  assert.ok(report.includes('17/18 (94,4%)'), 'báo cáo phải có 17/18 (94,4%)');
  assert.ok(report.includes('(nghiêm trọng)') && report.includes('lý do HOT-COLD-0'), 'báo cáo liệt kê lead sai, kèm lý do AI');
  assert.ok(report.includes('Chưa đạt mục tiêu'), 'lệch một bậc 94,4% và lỗi nghiêm trọng dưới ngưỡng phải ghi chưa đạt');
  noJunk(report);

  // Dưới 80% vẫn ghi đúng con số và chưa đạt (spec "báo cáo trung thực")
  const low = computeMetrics([scored('a', 'HOT', 'HOT', 1), scored('b', 'HOT', 'WARM', 1), scored('c', 'WARM', 'COLD', 1), scored('d', 'COLD', 'COLD', 1)]);
  const lowReport = renderReport(low);
  assert.ok(lowReport.includes('2/4 (50,0%)') && lowReport.includes('Chưa đạt mục tiêu') && lowReport.includes('dưới mục tiêu 80,0%'));

  // Đạt mọi ngưỡng
  const good = computeMetrics(Array.from({ length: 20 }, (_, i) => scored(`g${i}`, 'WARM', 'WARM', 5 + i)));
  assert.ok(renderReport(good).includes('**Đạt**') && !renderReport(good).includes('Chưa đạt'));

  // Trung vị và p95 của dãy mẫu (hạng gần nhất)
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  const ten = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(median(ten), 55); assert.equal(percentile(ten, 0.95), 100);
  const twenty = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.equal(percentile(twenty, 0.95), 19);

  // Độ nhất quán khi lặp 3 lần: a ổn định, b đổi mức, c ổn định, d có lượt lỗi nên bị loại khỏi mẫu số
  const repeated = [
    ...[1, 2, 3].map((r) => scored('a', 'HOT', 'HOT', 5, r)),
    scored('b', 'WARM', 'WARM', 5, 1), scored('b', 'WARM', 'WARM', 5, 2), scored('b', 'WARM', 'HOT', 5, 3),
    ...[1, 2, 3].map((r) => scored('c', 'COLD', 'COLD', 5, r)),
    scored('d', 'HOT', 'HOT', 5, 1), scored('d', 'HOT', 'HOT', 5, 2), { caseId: 'd', label: 'HOT', run: 3, status: 'FAILED' },
  ];
  const rm = computeMetrics(repeated);
  assert.equal(rm.total, 12);
  assert.deepEqual({ cases: rm.consistency.cases, consistent: rm.consistency.consistent, excluded: rm.consistency.excluded }, { cases: 3, consistent: 2, excluded: 1 });
  near(rm.consistency.rate, 2 / 3);
  assert.deepEqual(rm.consistency.unstableCaseIds, ['b']);
  const rr = renderReport(rm, { repeat: 3 });
  assert.ok(rr.includes('2/3 (66,7%)') && rr.includes('bỏ 1 lead có lượt lỗi'));

  // Biên (task 2.2): mọi lượt lỗi, không chia cho 0
  const allFailed = computeMetrics([
    { caseId: 'x', label: 'HOT', run: 1, status: 'FAILED' },
    { caseId: 'y', label: 'COLD', run: 1, status: 'TIMEOUT' },
  ]);
  assert.equal(allFailed.measured, 0); assert.equal(allFailed.exactRate, null); assert.equal(allFailed.withinOneRate, null);
  assert.equal(allFailed.latency.median, null); assert.equal(allFailed.severe, 0);
  near(allFailed.errorRate, 1);
  const allFailedReport = renderReport(allFailed);
  assert.ok(allFailedReport.includes('Không có dữ liệu đo'));
  noJunk(allFailedReport);

  // Biên: không có lượt nào
  const none = computeMetrics([]);
  assert.equal(none.total, 0); assert.equal(none.errorRate, null);
  noJunk(renderReport(none));

  // Biên: một lead duy nhất
  const single = computeMetrics([scored('only', 'HOT', 'HOT', 7.5)]);
  assert.equal(single.measured, 1); near(single.exactRate, 1);
  assert.equal(single.latency.median, 7.5); assert.equal(single.latency.p95, 7.5);
  const singleReport = renderReport(single);
  assert.ok(singleReport.includes('1/1 (100,0%)'));
  noJunk(singleReport);

  // Biên: độ trễ rỗng (đo được nhưng không ghi được giờ) vẫn ra báo cáo
  const noLatency = computeMetrics([scored('p', 'HOT', 'HOT', undefined), scored('q', 'COLD', 'COLD', undefined)]);
  assert.equal(noLatency.latency.count, 0); assert.equal(noLatency.latency.median, null); assert.equal(noLatency.latency.p95, null);
  const noLatencyReport = renderReport(noLatency);
  assert.ok(noLatencyReport.includes('không có dữ liệu'));
  noJunk(noLatencyReport);

  // Lý do chứa ký tự | hoặc xuống dòng không phá bảng
  const pipe = computeMetrics([scored('z', 'HOT', 'WARM', 1, 1, { reason: 'a | b\nc' })]);
  assert.ok(renderReport(pipe).includes('a \\| b c'));

  console.log('PASS số liệu: ví dụ spec (15/18, 17/18, 1 lỗi nghiêm trọng), trung vị/p95, độ nhất quán, các trường hợp biên');
}


// FE-24 mục 3: runner chạy thật trên stub backend có áp luật đặt lịch (không cần n8n, backend, Gemini hay mạng ngoài).
async function runRunnerTests() {
  const os = require('node:os');
  const { spawnSync } = require('node:child_process');
  const { run } = require('./eval-lead-scoring.cjs');
  const { startBookingStub } = require('./lib/booking-stub.cjs');
  const cases = loadCases(DEFAULT_CASES);
  const labelOf = Object.fromEntries(cases.map((c) => [c.id, c.label]));
  const SCORE = { HOT: 85, WARM: 55, COLD: 15 };
  const NOW = new Date('2026-06-10T03:17:00Z'); // 10:17 giờ Việt Nam, cố định để kiểm lặp lại được
  const PRICE = 3000000000;
  const capture = () => {
    const out = { log: [], error: [] };
    out.io = { log: (m) => out.log.push(String(m)), error: (m) => out.error.push(String(m)) };
    return out;
  };
  const caseIdOf = (lead) => /\[EVAL\] (\S+) #/.exec(lead.name)?.[1];
  const exactScorer = (lead) => ({ level: labelOf[caseIdOf(lead)], score: SCORE[labelOf[caseIdOf(lead)]], reason: 'stub' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fe24-check-'));
  const realFetch = globalThis.fetch;

  try {
    // 3.2 Chế độ mô phỏng: không gọi mạng, 20 lead đúng 100%
    let fetchCalls = 0;
    globalThis.fetch = () => { fetchCalls += 1; throw new Error('fetch bị chặn trong test'); };
    const dry = capture();
    assert.equal(await run(['--dry-run'], {}, dry.io), 0);
    assert.ok(dry.log.join('\n').includes('20/20 (100,0%)') && dry.log.join('\n').includes('Số lượt đo: 20'));
    assert.equal(fetchCalls, 0, '--dry-run không được gọi fetch');
    globalThis.fetch = realFetch;
    assert.equal(spawnSync(process.execPath, [path.join(__dirname, 'eval-lead-scoring.cjs'), '--dry-run'], { encoding: 'utf8' }).status, 0, 'CLI --dry-run phải thoát mã 0');

    // 3.3 --only và --repeat
    const part = capture();
    assert.equal(await run(['--dry-run', '--only', 'warm-01,cold-02', '--repeat', '3'], {}, part.io), 0);
    const partText = part.log.join('\n');
    assert.ok(partText.includes('Số lượt đo: 6') && partText.includes('Số lần lặp: 3') && partText.includes('Cùng mức ở mọi lần chạy | 2/2 (100,0%)'), 'chỉ hai lead ba lần, có độ nhất quán');
    const unknown = capture();
    assert.equal(await run(['--dry-run', '--only', 'khong-co'], {}, unknown.io), 2);
    assert.ok(unknown.error.join('\n').includes('khong-co'));

    // 3.1 Từ chối địa chỉ không phải local và thiếu biến môi trường: không có kết nối nào
    for (const api of ['https://example.com', 'http://localhost.evil.com:8081', 'http://localhost@evil.com']) {
      let calls = 0;
      const refused = capture();
      const code = await run(['--api', api], { EVAL_USER: 'u', EVAL_PASSWORD: 'p', WEBHOOK_SECRET: 's' }, { ...refused.io, fetch: () => { calls += 1; throw new Error('không được gọi'); } });
      assert.equal(code, 2, `${api} phải bị từ chối`);
      assert.equal(calls, 0, `${api}: không được gọi mạng`);
    }
    const noEnv = capture();
    assert.equal(await run(['--api', 'http://localhost:8081'], { EVAL_PASSWORD: 'p', WEBHOOK_SECRET: 's' }, noEnv.io), 2);
    assert.ok(noEnv.error.join('\n').includes('EVAL_USER') && !noEnv.error.join('\n').includes('EVAL_PASSWORD'), 'chỉ nêu biến thiếu');

    // 3.4 Chạy thật trên stub, --repeat 3: 60 lượt, không 409, 60 khung khác nhau trong 14 ngày
    const stub = await startBookingStub({ now: () => NOW, scorer: exactScorer, scoreDelayMs: 20, properties: [{ id: 7, name: 'Căn stub', address: 'x', area: 80, price: PRICE, status: 'AVAILABLE' }] });
    try {
      const env = { EVAL_USER: stub.user, EVAL_PASSWORD: stub.password, WEBHOOK_SECRET: stub.secret };
      const outPrefix = path.join(tmp, 'full');
      const full = capture();
      const code = await run(['--api', stub.url, '--repeat', '3', '--concurrency', '5', '--poll-ms', '15', '--timeout-s', '10', '--out', outPrefix], env, full.io);
      assert.equal(code, 0, `chạy trọn bộ phải thoát 0: ${full.error.join(' ')}`);
      assert.equal(stub.created.length, 60, '60 lượt đều tạo được');
      assert.deepEqual(stub.stats.rejected, { 400: 0, 409: 0, 429: 0 }, 'không lượt nào bị 400, 409 hay 429');
      assert.equal(new Set(stub.created.map((l) => l.viewingTime)).size, 60, '60 khung giờ đôi một khác nhau');
      const limit = NOW.getTime() + 14 * 24 * 3600000;
      assert.ok(stub.created.every((l) => Date.parse(l.viewingTime) >= NOW.getTime() && Date.parse(l.viewingTime) <= limit), 'mọi khung nằm trong 14 ngày');
      assert.ok(stub.created.every((l) => l.secretSent), 'mọi lượt gửi X-Webhook-Secret');
      assert.ok(stub.created.every((l) => l.source === 'eval-fe24' && l.name.startsWith('[EVAL]') && l.email.endsWith('@eval.invalid')), 'lead mẫu mang source, tên, email quy ước');
      assert.equal(new Set(stub.created.map((l) => l.phone)).size, 60, 'mỗi lượt một số điện thoại');
      assert.ok(stub.created.every((l) => l.budget === Math.round(PRICE * cases.find((c) => c.id === caseIdOf(l)).ratio)), 'budget = round(giá × ratio)');
      const saved = JSON.parse(fs.readFileSync(`${outPrefix}.json`, 'utf8'));
      assert.equal(saved.results.length, 60);
      assert.ok(saved.results.every((r) => r.status === 'SCORED' && r.level === r.label));
      const md = fs.readFileSync(`${outPrefix}.md`, 'utf8');
      assert.ok(md.includes('60/60 (100,0%)') && md.includes('Cùng mức ở mọi lần chạy | 20/20 (100,0%)'));
      assert.ok(full.log.join('\n').includes('DELETE FROM leads WHERE source'), 'in sẵn câu SQL dọn lead');
    } finally { await stub.close(); }

    // 3.4 Chỉ còn 30 khung trống: dừng trước khi tạo lead nào, nêu số khung thiếu
    const tight = await startBookingStub({ now: () => NOW, freeSlots: 30, scorer: exactScorer });
    try {
      assert.equal(tight.freeSlotCount(), 30);
      const short = capture();
      const code = await run(['--api', tight.url, '--repeat', '3', '--poll-ms', '15'], { EVAL_USER: tight.user, EVAL_PASSWORD: tight.password, WEBHOOK_SECRET: tight.secret }, short.io);
      assert.notEqual(code, 0);
      assert.equal(tight.stats.postAttempts, 0, 'không được gọi POST /api/viewings lần nào');
      assert.equal(tight.created.length, 0);
      assert.ok(short.error.join('\n').includes('thiếu 30'), 'phải nêu thiếu 30 khung');
      // giảm --repeat thì chạy được (30 lượt vừa 30 khung)
      const fits = capture();
      assert.equal(await run(['--api', tight.url, '--repeat', '1', '--only', cases.slice(0, 5).map((c) => c.id).join(','), '--poll-ms', '15', '--timeout-s', '5', '--out', path.join(tmp, 'tight')], { EVAL_USER: tight.user, EVAL_PASSWORD: tight.password, WEBHOOK_SECRET: tight.secret }, fits.io), 0);
      assert.equal(tight.created.length, 5);
    } finally { await tight.close(); }

    // Lead lỗi và quá hạn chờ được báo riêng, lead còn lại vẫn đo
    const mixed = await startBookingStub({
      now: () => NOW, scoreDelayMs: 20,
      scorer: (lead) => (caseIdOf(lead) === 'warm-01' ? { failed: true } : caseIdOf(lead) === 'cold-01' ? null : exactScorer(lead)),
    });
    try {
      const out = capture();
      const prefix = path.join(tmp, 'mixed');
      const code = await run(['--api', mixed.url, '--only', 'hot-01,warm-01,cold-01', '--poll-ms', '15', '--timeout-s', '1', '--out', prefix], { EVAL_USER: mixed.user, EVAL_PASSWORD: mixed.password, WEBHOOK_SECRET: mixed.secret }, out.io);
      assert.equal(code, 0);
      const byId = Object.fromEntries(JSON.parse(fs.readFileSync(`${prefix}.json`, 'utf8')).results.map((r) => [r.caseId, r.status]));
      assert.deepEqual(byId, { 'hot-01': 'SCORED', 'warm-01': 'FAILED', 'cold-01': 'TIMEOUT' });
      const md = fs.readFileSync(`${prefix}.md`, 'utf8');
      assert.ok(md.includes('## Lượt lỗi hoặc quá hạn chờ') && md.includes('--only warm-01,cold-01'));
    } finally { await mixed.close(); }

    // Sai mật khẩu: dừng trước khi tạo lead
    const locked = await startBookingStub({ now: () => NOW });
    try {
      const bad = capture();
      assert.equal(await run(['--api', locked.url], { EVAL_USER: locked.user, EVAL_PASSWORD: 'sai', WEBHOOK_SECRET: locked.secret }, bad.io), 1);
      assert.equal(locked.stats.postAttempts, 0);
    } finally { await locked.close(); }

    console.log('PASS runner: --dry-run không gọi mạng, từ chối địa chỉ không local, 60 lượt trên stub (60 khung riêng, không 409), thiếu khung dừng trước khi tạo lead, lead lỗi báo riêng');
  } finally {
    globalThis.fetch = realFetch;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
