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
}

