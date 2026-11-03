const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const workflow = JSON.parse(read('n8n-workflows/luong-2-follow-up.json'));
const query = workflow.nodes.find(n => n.name === 'Lấy lead cần follow-up').parameters.query;
if (process.argv.includes('--sql')) {
  const source = read('backend/src/followups/followups.service.ts');
  const snapshot = source.match(/m\.query\(`(SELECT l\.status[\s\S]+?)`, \[leadId,/);
  assert(snapshot, 'Missing snapshot query');
  const fixture = read('backend/test/followup-selection.fixture.sql')
    .replace('-- SELECTOR', query.trim().replace(/;$/, ''))
    .replace('TRUNCATE pg_temp.leads', `PREPARE followup_snapshot(int,text) AS ${snapshot[1]};\nEXECUTE followup_snapshot(1,'REMINDER:%');\nDEALLOCATE followup_snapshot;\nTRUNCATE pg_temp.leads`);
  process.stdout.write(fixture);
  return;
}
assert.equal(query.replace(/\r\n/g, '\n'), read('backend/sql/preview-follow-up.sql').replace(/\r\n/g, '\n'));
const names = new Set(workflow.nodes.map(n => n.name));
assert.equal(names.size, workflow.nodes.length);
for (const node of workflow.nodes) {
  if (node.parameters.jsCode) new Function('$', '$json', '$input', node.parameters.jsCode);
  for (const match of JSON.stringify(node.parameters).matchAll(/\$\('([^']+)'\)/g)) assert(names.has(match[1]), `Missing reference ${match[1]}`);
  for (const groups of Object.values(workflow.connections[node.name] ?? {})) {
    for (const edges of groups) for (const edge of edges) assert(names.has(edge.node), `Missing target ${edge.node}`);
  }
  if (node.onError === 'continueErrorOutput') assert(workflow.connections[node.name]?.main?.[1]?.length, `Missing error route for ${node.name}`);
}
const code = name => workflow.nodes.find(n => n.name === name).parameters.jsCode;
const ctx = { type: 'WARM_NUDGE', name: 'Test', email: 'test@example.invalid' };
const fallback = new Function('$', '$json', code('Kiểm tra nội dung AI'))(() => ({ item: { json: ctx } }), { error: 'AI unavailable' });
assert.equal(fallback.json.usedFallback, true);
assert(fallback.json.body.length <= 250);
const merged = new Function('$input', code('Tổng hợp'))({ all: () => [
  { json: { type: 'REMINDER' } }, { json: { type: 'SKIPPED' } }, { json: { type: 'ERROR' } },
] });
assert.equal(merged[0].json.total, 1);
assert.equal(merged[0].json.failed, 1);
assert.equal(merged[0].json.skipped, 1);
assert.equal(workflow.nodes.find(n => n.name === 'Email khách').retryOnFail, false);
assert(workflow.nodes.find(n => n.name === 'Hoàn tất tác vụ'));
assert(!names.has('Chuyển VIEWED'));
console.log('PASS: L2 node references, error branches, selector, fallback and summary.');
