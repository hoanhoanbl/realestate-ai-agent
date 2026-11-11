// FE-35: kiểm tra cách sub-workflow thong-bao-nhan-vien chọn người nhận và báo kết quả.
// Chạy: node scripts/check-notification-routing.cjs  (không cần n8n, backend hay mạng)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows/thong-bao-nhan-vien.json'), 'utf8'));
const node = (name) => workflow.nodes.find((n) => n.name === name);

const cfg = { staffEmail: 'staff@example.test', managerEmail: 'manager@example.test', telegramChatId: '-1001', telegramEnabled: true, backendUrl: 'http://backend:8081' };
const target = { id: 5, name: 'Sale An', email: 'an@example.test', role: 'SALE', telegramChatId: '123456789', pushToken: 'ExponentPushToken[abc123]' };

// Dựng $('Tên node') giống n8n: first() và isExecuted
function context(nodes) {
  return (name) => {
    const entry = nodes[name];
    return { isExecuted: entry !== undefined, first: () => ({ json: entry }) };
  };
}
function normalize(input, lookup) {
  const nodes = { 'Cấu hình': cfg, 'Khi được gọi': input };
  if (lookup !== undefined) nodes['Lấy kênh người phụ trách'] = lookup;
  return new Function('$', node('Chuẩn hoá').parameters.jsCode)(context(nodes))[0].json;
}
function summarize(normalized, executed) {
  const nodes = { 'Chuẩn hoá': normalized, ...executed };
  return new Function('$', node('Kết quả').parameters.jsCode)(context(nodes))[0].json;
}
const base = { leadId: 7, level: 'HOT', title: 'Khách mới cần duyệt lịch', fields: [{ label: 'Khách', value: 'Bình' }, { label: 'Giờ', value: '09:00' }] };

module.exports = { workflow, normalize, summarize };
if (require.main === module) {
  // (a) sale có đủ kênh: chỉ gửi cho người đó
  const a = normalize({ ...base, assigneeId: 5 }, target);
  assert.equal(a.recipient, 'assignee'); assert.equal(a.fallbackToManager, false);
  assert.equal(a.emailTo, 'an@example.test'); assert.equal(a.sendEmail, true);
  assert.equal(a.telegram.chat_id, '123456789'); assert.equal(a.telegramReady, true);
  assert.equal(a.pushToken, 'ExponentPushToken[abc123]'); assert.equal(a.push.to, a.pushToken);
  assert.notEqual(a.telegram.chat_id, cfg.telegramChatId, 'không được đăng vào nhóm chung');

  // (b) sale không có Telegram: email + push, Telegram bỏ qua (không lỗi)
  const b = normalize({ ...base, assigneeId: 5 }, { ...target, telegramChatId: null });
  assert.equal(b.telegramReady, false); assert.equal(b.emailTo, 'an@example.test'); assert.equal(b.recipient, 'assignee');
  const bResult = summarize(b, { 'Email nhân viên': { success: true } });
  assert.equal(bResult.telegramSkipped, true); assert.equal(bResult.telegramSent, false); assert.equal(bResult.telegramError, null);
  assert.equal(bResult.emailSent, true); assert.equal(bResult.pushSkipped, true);

  // (c) chỉ có push, không email, không Telegram: vẫn là người đó, không gửi email
  const c = normalize({ ...base, assigneeId: 5 }, { ...target, email: '', telegramChatId: '' });
  assert.equal(c.recipient, 'assignee'); assert.equal(c.sendEmail, false); assert.ok(c.pushToken);

  // (d) không kênh nào dùng được, hoặc không tìm thấy người: quản lý nhận bằng email
  for (const lookup of [{ ...target, email: '', telegramChatId: null, pushToken: null }, { error: { message: 'Not Found' } }, { ...target, id: 99 }, undefined]) {
    const d = normalize({ ...base, assigneeId: 5 }, lookup);
    assert.equal(d.recipient, 'manager'); assert.equal(d.fallbackToManager, true);
    assert.equal(d.emailTo, 'manager@example.test'); assert.equal(d.telegramReady, false); assert.equal(d.pushToken, '');
  }

  // (d2) lead chưa có người phụ trách: luồng 1 gửi assigneeId = 0 (hoặc null) -> quản lý nhận bằng email, không đăng vào nhóm chung
  for (const none of [0, null]) {
    const d2 = normalize({ ...base, assigneeId: none });
    assert.equal(d2.recipient, 'manager'); assert.equal(d2.fallbackToManager, true); assert.equal(d2.emailTo, 'manager@example.test');
    assert.equal(d2.telegramReady, false); assert.equal(d2.pushToken, '');
  }

  // (e) token push hay chat id sai định dạng bị bỏ
  const e = normalize({ ...base, assigneeId: 5 }, { ...target, pushToken: 'not-a-token', telegramChatId: '@group' });
  assert.equal(e.pushToken, ''); assert.equal(e.telegramReady, false);

  // (f) cách gọi cũ: chỉ emailTo, vẫn đi nhóm Telegram chung, không push
  const f = normalize({ ...base, emailTo: 'manager@example.test' });
  assert.equal(f.recipient, 'legacy'); assert.equal(f.emailTo, 'manager@example.test'); assert.equal(f.telegram.chat_id, '-1001');
  assert.equal(f.sendEmail, true); assert.equal(f.pushToken, ''); assert.equal(f.fallbackToManager, false);
  const f2 = normalize(base);
  assert.equal(f2.emailTo, 'staff@example.test');

  // (g) chế độ update (sửa tin Telegram cũ) không tra người phụ trách và không gửi email
  const g = normalize({ ...base, mode: 'update', assigneeId: 5, telegramChatId: '555', telegramMessageId: 9, statusLine: 'Xong' });
  assert.equal(g.recipient, 'legacy'); assert.equal(g.sendEmail, false); assert.equal(g.telegram.chat_id, '555'); assert.equal(g.telegramMethod, 'editMessageText');

  // (h) kết quả: tên trường người gọi cũ (FE-38) giữ nguyên nghĩa
  const legacyOk = summarize(f, { 'Email nhân viên': { success: true } });
  assert.equal(legacyOk.emailSent, true); assert.equal(legacyOk.telegramSkipped, true); assert.equal(legacyOk.telegramSent, false);
  const legacyTg = summarize(f, { 'Email nhân viên': { success: true }, 'Gửi Telegram': { ok: true, result: { message_id: 3, chat: { id: -1001 } } } });
  assert.equal(legacyTg.telegramSent, true); assert.equal(legacyTg.telegramMessageId, 3);

  // (i) lỗi từng kênh: người gọi cũ vẫn bị báo lỗi khi email hỏng; kiểu mới thì không dừng kênh khác
  assert.throws(() => summarize(f, { 'Email nhân viên': { error: { message: 'SMTP down' } } }), /SMTP down/);
  const mixed = summarize(a, { 'Email nhân viên': { error: { message: 'SMTP down' } }, 'Gửi Telegram': { ok: true, result: { message_id: 4, chat: { id: 123456789 } } }, 'Gửi thông báo đẩy': { data: [{ status: 'ok' }] } });
  assert.equal(mixed.emailSent, false); assert.match(mixed.emailError, /SMTP down/);
  assert.equal(mixed.telegramSent, true); assert.equal(mixed.pushSent, true); assert.equal(mixed.recipient, 'assignee');
  const tgFail = summarize(a, { 'Email nhân viên': { success: true }, 'Gửi Telegram': { ok: false, description: 'chat not found' }, 'Gửi thông báo đẩy': { data: [{ status: 'error', message: 'DeviceNotRegistered' }] } });
  assert.equal(tgFail.emailSent, true); assert.equal(tgFail.telegramSent, false); assert.match(tgFail.telegramError, /chat not found/);
  assert.equal(tgFail.pushSent, false); assert.match(tgFail.pushError, /DeviceNotRegistered/);
  const fallback = summarize(normalize({ ...base, assigneeId: 5 }, undefined), { 'Email nhân viên': { success: true } });
  assert.equal(fallback.fallbackToManager, true); assert.equal(fallback.recipient, 'manager');

  // (j) cấu trúc: mọi kết nối và mọi tham chiếu $('...') trỏ tới node có thật; mã Code biên dịch được
  const names = new Set(workflow.nodes.map((n) => n.name));
  for (const [from, outputs] of Object.entries(workflow.connections)) {
    assert(names.has(from), `Kết nối từ node không tồn tại: ${from}`);
    for (const group of outputs.main) for (const edge of group) assert(names.has(edge.node), `Thiếu node đích ${edge.node}`);
  }
  for (const n of workflow.nodes) {
    if (n.parameters.jsCode) new Function('$', n.parameters.jsCode);
    for (const ref of JSON.stringify(n.parameters).matchAll(/\$\('([^']+)'\)/g)) assert(names.has(ref[1]), `Thiếu node ${ref[1]} (trong ${n.name})`);
  }
  console.log('PASS: FE-35 người nhận theo sale phụ trách, kênh thiếu, dự phòng quản lý, cách gọi cũ và kết quả từng kênh.');
}
