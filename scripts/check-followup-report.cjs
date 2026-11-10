const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const workflow = JSON.parse(read('n8n-workflows/luong-4-bao-cao.json'));
const node = name => workflow.nodes.find(n => n.name === name);
if (process.argv.includes('--sql')) {
  const current = node('Số liệu tuần này').parameters.query;
  const previous = node('Số liệu tuần trước').parameters.query;
  process.stdout.write(read('backend/test/followup-report.fixture.sql')
    .replace('-- CURRENT_QUERY', current.trim().replace(/;$/, ''))
    .replace('-- PREVIOUS_QUERY', previous.trim().replace(/;$/, '')));
  return;
}
for (const n of workflow.nodes) if (n.parameters.jsCode) new Function('$', '$input', n.parameters.jsCode);
const period = { label: 'FE30 test' };
const cur = { new_leads: 3, confirmed: 2, viewed: 1, no_show: 0, deposits: 0, signed: 0, lost: 2, expired: 2, feedbacks: 0, avg_rating: null, sources_breakdown: { facebook: 2, direct: 1 }, campaign_warm: 1, campaign_cold: 0, hot_followup: 1 };
const prev = { ...cur, expired: 1, sources_breakdown: { facebook: 1, direct: 2 } };
const calculated = new Function('$', '$input', node('Tính phễu và cảnh báo').parameters.jsCode)(
  name => ({ first: () => ({ json: name === 'Kỳ báo cáo' ? period : cur }) }),
  { first: () => ({ json: prev }) },
)[0].json;
assert.equal(calculated.report.delta.expired, 1);
assert.equal(calculated.report.sources.facebook.current, 2);
assert.equal(calculated.report.sources.facebook.delta, 1);
assert.equal(calculated.report.campaigns.warm_nurtured, 1);
const result = { ...calculated, analysis: { headline: 'Test', insights: [], recommendations: [], aiUsed: false } };
const email = new Function('$', '$input', node('Soạn email báo cáo').parameters.jsCode)(
  name => ({ first: () => ({ json: name === 'Kiểm tra AI' ? result : { webUrl: 'http://localhost:3000' } }) }),
  { first: () => ({ json: { id: 1 } }) },
)[0].json;
assert.ok(email.html.includes('Quá hạn không xử lý (EXPIRED)'));
assert.ok(email.html.includes('Nguồn khách:'));
assert.ok(email.html.includes('Chiến dịch nuôi dưỡng (Mautic):'));
console.log('PASS: FE-23 & L4 sources, campaigns, expiry delta and report email; SQL fixture available with --sql.');
