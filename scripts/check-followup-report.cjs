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
const breakdowns = { version: 1, asOf: '2026-11-12T03:00:00Z', sales: [{ userId: 1, name: '<script>sale</script>', assignedLeads: 3, activeLeads: 2, respondedOnTime: 1, overdueUnanswered: 1, viewedLeads: 1, depositLeads: 1, signedLeads: 0 }], properties: [{ propertyId: 1, name: '<img src=x onerror=alert(1)>', scheduledViewings: 2, uniqueVisitors: 1, attendedCustomers: 1, cancelledViewings: 0, noShowViewings: 0, feedbackCount: 1, averageRating: 2, interestedCustomers: 0, depositContracts: 1, signedContracts: 0, reasons: { PRICE: 1 } }], dataQuality: { unmappedFeedbacks: 0, unparsedAssignments: 0 } };
const cur = { new_leads: 3, confirmed: 2, viewed: 1, no_show: 0, deposits: 0, signed: 0, lost: 2, expired: 2, feedbacks: 0, avg_rating: null, sources_breakdown: { facebook: 2, direct: 1 }, campaign_warm: 1, campaign_cold: 0, hot_followup: 1 };
const prev = { ...cur, expired: 1, sources_breakdown: { facebook: 1, direct: 2 } };
const calculated = new Function('$', '$input', node('Tính phễu và cảnh báo').parameters.jsCode)(
  name => ({ first: () => ({ json: name === 'Kỳ báo cáo' ? period : name === 'Số liệu tuần trước' ? prev : name === 'Hiệu suất sale và căn nhà' ? breakdowns : cur }) }),
  { first: () => ({ json: prev }) },
)[0].json;
assert.equal(calculated.report.delta.expired, 1);
assert.equal(calculated.report.sources.facebook.current, 2);
assert.equal(calculated.report.sources.facebook.delta, 1);
assert.equal(calculated.report.campaigns.warm_nurtured, 1);
assert.equal(calculated.report.breakdowns, breakdowns);
assert(!('assignees' in calculated.report), 'No per-sale comparison with previous period');
const result = { ...calculated, analysis: { headline: 'Test', insights: [], recommendations: [], aiUsed: false } };
const email = new Function('$', '$input', node('Soạn email báo cáo').parameters.jsCode)(
  name => ({ first: () => ({ json: name === 'Kiểm tra AI' ? result : { webUrl: 'http://localhost:3000' } }) }),
  { first: () => ({ json: { id: 1 } }) },
)[0].json;
assert.ok(email.html.includes('Quá hạn không xử lý (EXPIRED)'));
assert.ok(email.html.includes('Nguồn khách:'));
assert.ok(email.html.includes('Chiến dịch nuôi dưỡng (Mautic):'));
assert.ok(email.html.includes('Hiệu suất sale'));
assert.ok(email.html.includes('Hiệu quả từng căn nhà'));
assert.ok(email.html.includes('&lt;script&gt;sale&lt;/script&gt;'));
assert(!email.html.includes('<img src=x'));
assert(!email.html.includes('Khách mới theo người phụ trách'));
assert.throws(() => new Function('$', '$input', node('Tính phễu và cảnh báo').parameters.jsCode)(
  name => ({ first: () => ({ json: name === 'Hiệu suất sale và căn nhà' ? {} : {} }) }), { first: () => ({ json: prev }) },
), /không hợp lệ/);
const names = new Set(workflow.nodes.map(n => n.name));
assert.equal(names.size, workflow.nodes.length);
for (const [name, connections] of Object.entries(workflow.connections)) {
  assert(names.has(name));
  for (const groups of Object.values(connections)) for (const group of groups) for (const edge of group) assert(names.has(edge.node));
}
assert.equal(workflow.connections['Số liệu tuần trước'].main[0][0].node, 'Hiệu suất sale và căn nhà');
assert.equal(node('Hiệu suất sale và căn nhà').parameters.url.includes('/api/reports/breakdowns'), true);
console.log('PASS: FE-23 & L4 sources, campaigns, expiry delta and report email; SQL fixture available with --sql.');
