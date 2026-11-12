const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'n8n-workflows', name), 'utf8'));
const worker = read('luong-5-theo-doi-phan-hoi.json');
const l2 = read('luong-2-follow-up.json');
const l5 = read('luong-5-cam-nhan.json');
for (const w of [worker, l2, l5]) {
  const names = new Set(w.nodes.map(n => n.name));
  assert.equal(names.size, w.nodes.length, 'Duplicate node name');
  for (const n of w.nodes) {
    if (n.parameters.jsCode) new Function('$', '$input', '$json', n.parameters.jsCode);
    for (const m of JSON.stringify(n.parameters).matchAll(/\$\('([^']+)'\)/g)) assert(names.has(m[1]), `Missing ${m[1]}`);
    for (const edges of Object.values(w.connections[n.name] || {})) for (const group of edges) for (const e of group) assert(names.has(e.node));
    if (n.onError === 'continueErrorOutput') assert(w.connections[n.name]?.main?.[1]?.length, `${n.name} has no error route`);
  }
}
const node = name => worker.nodes.find(n => n.name === name);
for (const n of worker.nodes.filter(n => ['n8n-nodes-base.httpRequest','n8n-nodes-base.executeWorkflow'].includes(n.type))) assert.equal(n.retryOnFail, false);
const run = (name, json, start = {}) => new Function('$', '$json', node(name).parameters.jsCode)(
  n => ({ first: () => ({ json: { managerEmail: 'manager@example.invalid' } }), item: { json: start } }), json);
const staff = run('Chuẩn bị người nhận', { kind: 'REMIND', assigneeId: 12 });
assert.equal(staff.json.assigneeId, 12); assert(!staff.json.emailTo);
assert.equal(run('Chuẩn bị người nhận', { kind: 'ESCALATE' }).json.emailTo, 'manager@example.invalid');
assert.throws(() => run('Kiểm tra giao thông báo', {}, { kind: 'REMIND' }));
assert.throws(() => run('Kiểm tra giao thông báo', { telegramSent: true }, { kind: 'ESCALATE' }));
for (const channel of ['emailSent','telegramSent','pushSent']) assert(run('Kiểm tra giao thông báo', { [channel]: true }, { kind: 'REMIND' }));
assert(run('Kiểm tra giao thông báo', { emailSent: true }, { kind: 'ESCALATE' }));
assert(l2.connections['Cấu hình'].main[0].some(e => e.node === 'Nhắc việc sau phản hồi'));
assert.equal(l5.nodes.find(n => n.name === 'Lấy cảm nhận').type,'n8n-nodes-base.httpRequest');
assert(l5.nodes.some(n => n.name === 'Nhắc việc sau phản hồi'));
assert(!l5.nodes.some(n => n.name === 'Email nhân viên'));
const emailGate = l5.nodes.find(n => n.name === 'Có email khách?').parameters.conditions.conditions[0].leftValue.slice(3,-2);
for (const [email, expected] of [[null,false],['',false],['invalid',false],['customer@example.invalid',true]])
  assert.equal(new Function('$',`return (${emailGate});`)(()=>({first:()=>({json:{email}})})), expected);
console.log('PASS: L5 work routing, failure checkpoints, current assignee, manager escalation, missing-email branch and L2 integration.');
