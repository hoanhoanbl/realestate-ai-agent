// FE-36: kiểm tra luồng 6 lưu liên hệ khách và báo sale phụ trách.
// Chạy: node scripts/check-bot-lead-capture.cjs  (không cần n8n, backend hay mạng)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows/luong-6-telegram-agent.json'), 'utf8'));
const node = (name) => {
  const found = workflow.nodes.find((n) => n.name === name);
  assert.ok(found, `thiếu node "${name}"`);
  return found;
};
const text = (name) => JSON.stringify(node(name).parameters);

// Dựng $('Tên node') giống n8n: first() trả json của node
function context(nodes) {
  return (name) => {
    const entry = nodes[name];
    return { isExecuted: entry !== undefined, first: () => ({ json: entry }) };
  };
}
const run = (name, json, nodes) =>
  new Function('$', '$json', node(name).parameters.jsCode)(context(nodes), json)[0].json;

const msg = { chatId: 555, firstName: 'Bình', username: 'binh_tg', text: 'ok xác nhận' };
const cfg = { publicWebUrl: 'https://web.example.test' };
const reply = { chatId: 555, reply: 'Đã ghi nhận', route: 'AGENT', usedFallback: false, escalate: false, reason: '' };
const extract = (steps) =>
  run('Trích liên hệ đã lưu', reply, {
    'Chuẩn hoá tin nhắn': msg,
    'AI Agent tư vấn': steps === undefined ? { output: 'x' } : { output: 'x', intermediateSteps: steps },
  });
const step = (observation, tool = 'Lưu liên hệ khách') => ({ action: { tool, toolInput: {} }, observation });
const lead = { id: 30, name: 'Bình', phone: '0901234567', assignedUserId: 5 };

module.exports = { workflow, extract };
if (require.main === module) {
  // ---- 3.1 công cụ lưu liên hệ
  const tool = node('Lưu liên hệ khách');
  assert.equal(tool.type, 'n8n-nodes-base.httpRequestTool');
  assert.equal(tool.parameters.method, 'POST');
  assert.match(tool.parameters.url, /\/api\/leads\/intake$/);
  assert.ok(workflow.connections['Lưu liên hệ khách'].ai_tool[0].some((c) => c.node === 'AI Agent tư vấn'), 'công cụ chưa nối vào Agent');
  assert.ok(tool.parameters.headerParameters.parameters.some((h) => h.name === 'X-Webhook-Secret'));
  for (const name of ['Lưu liên hệ khách', 'Đặt lịch xem nhà']) {
    const body = node(name).parameters.jsonBody;
    assert.match(body, /chatId: String\(\$\('Chuẩn hoá tin nhắn'\)\.first\(\)\.json\.chatId\)/, `${name}: chatId phải lấy từ n8n`);
    assert.doesNotMatch(body, /\$fromAI\('chatId'/, `${name}: model không được quyết định chatId`);
  }
  const body = tool.parameters.jsonBody;
  assert.doesNotMatch(body, /consentMarketing|email|budget/, 'bot không thu đồng ý marketing, email, ngân sách');
  assert.match(body, /source: 'telegram'/);
  for (const field of ['name', 'phone', 'needs']) assert.match(body, new RegExp(`\\$fromAI\\('${field}'`));
  const agent = node('AI Agent tư vấn').parameters.options;
  assert.equal(agent.returnIntermediateSteps, true);
  for (const phrase of ['Lưu liên hệ khách', 'xác nhận để nhân viên gọi lại', 'KHÔNG hỏi email, ngân sách', 'không bao giờ gọi lại với cùng số', 'KHÔNG nói khách đã có hồ sơ']) {
    assert.ok(agent.systemMessage.includes(phrase), `prompt thiếu: ${phrase}`);
  }

  // ---- 3.2 trích kết quả công cụ
  const created = extract([step(JSON.stringify({ lead, created: true, reopened: false }))]);
  assert.equal(created.captured, true); assert.equal(created.returning, false);
  assert.equal(created.assigneeId, 5); assert.equal(created.leadId, 30);
  assert.equal(created.reply, 'Đã ghi nhận', 'giữ nguyên dữ liệu câu trả lời');
  const reopened = extract([step({ lead, created: false, reopened: true })]);
  assert.equal(reopened.captured, true); assert.equal(reopened.returning, false);
  const existing = extract([step(JSON.stringify({ lead, created: false, reopened: false }))]);
  assert.equal(existing.captured, true); assert.equal(existing.returning, true);
  const unassigned = extract([step(JSON.stringify({ lead: { ...lead, assignedUserId: null }, created: true, reopened: false }))]);
  assert.equal(unassigned.captured, true); assert.equal(unassigned.assigneeId, 0, 'chưa có người phụ trách: quản lý nhận');
  for (const [label, steps] of [
    ['lỗi 400', [step(JSON.stringify({ statusCode: 400, message: 'phone không hợp lệ' }))]],
    ['văn bản thường', [step('Không lưu được')]],
    ['rỗng', [step('')]],
    ['công cụ khác', [step(JSON.stringify({ lead, created: true }), 'Đặt lịch xem nhà')]],
    ['không có bước', []],
    ['thiếu intermediateSteps', undefined],
  ]) {
    const r = extract(steps);
    assert.equal(r.captured, false, `${label}: không được báo sale`);
    assert.equal(r.reply, 'Đã ghi nhận');
  }

  // ---- nội dung báo sale
  const compose = (x) => run('Soạn báo sale khách mới', x, { 'Chuẩn hoá tin nhắn': msg, 'Cấu hình': cfg });
  const n = compose(created);
  assert.equal(n.title, 'Khách Telegram để lại số'); assert.equal(n.assigneeId, 5);
  assert.ok(Object.prototype.hasOwnProperty.call(n, 'assigneeId'), 'phải có khoá assigneeId để sub-workflow gửi đúng người');
  assert.equal(n.actions[0].url, 'https://web.example.test/admin/leads/30');
  assert.ok(n.actions.some((a) => a.url === 'https://t.me/binh_tg'));
  assert.ok(n.fields.some((f) => f.value === '@binh_tg'));
  assert.equal(compose(existing).title, 'Khách cũ nhắn lại');
  assert.equal(compose({ ...created, username: '' }).actions.length, 1);
  assert.equal(compose({ ...unassigned, username: '' }).assigneeId, 0);

  // ---- khôi phục dữ liệu sau khi báo sale
  assert.deepEqual(run('Khôi phục câu trả lời', { telegramSent: true }, { 'Trích liên hệ đã lưu': created }), created);
  assert.equal(node('Báo sale khách mới').onError, 'continueRegularOutput', 'báo sale lỗi không được chặn trả lời khách');
  assert.equal(node('Báo sale khách mới').parameters.options.waitForSubWorkflow, true);
  assert.equal(node('Báo sale khách mới').parameters.workflowId.value, node('Báo nhân viên').parameters.workflowId.value);

  // ---- đường nối và tham chiếu
  const names = new Set(workflow.nodes.map((x) => x.name));
  for (const [from, outputs] of Object.entries(workflow.connections)) {
    assert.ok(names.has(from), `connections: node nguồn không có: ${from}`);
    for (const branches of Object.values(outputs)) for (const branch of branches) for (const c of branch) assert.ok(names.has(c.node), `connections: ${from} nối tới node không có: ${c.node}`);
  }
  for (const x of workflow.nodes) {
    for (const m of JSON.stringify(x.parameters).matchAll(/\$\('((?:[^'\\]|\\.)+)'\)/g)) assert.ok(names.has(m[1]), `${x.name} tham chiếu node không có: ${m[1]}`);
  }
  const to = (from, branch = 0) => workflow.connections[from].main[branch].map((c) => c.node);
  assert.deepEqual(to('Kiểm tra câu trả lời'), ['Trích liên hệ đã lưu']);
  assert.deepEqual(to('Có liên hệ mới?', 0), ['Soạn báo sale khách mới']);
  assert.deepEqual(to('Có liên hệ mới?', 1), ['Cần báo nhân viên?']);
  assert.deepEqual(to('Khôi phục câu trả lời'), ['Cần báo nhân viên?']);
  assert.ok(text('Có liên hệ mới?').includes('$json.captured === true'));
  console.log('FE-36 luồng 6: đạt');
}
