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

