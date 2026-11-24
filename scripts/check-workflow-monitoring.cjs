// FE-50: kiểm luồng 6b có thử lại khi lỗi (LH-53) và Error workflow báo Telegram song song với email (LH-52).
// Chạy: node scripts/check-workflow-monitoring.cjs  (không cần n8n, backend hay mạng)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows', f), 'utf8'));
const next = (wf, from) => (wf.connections[from]?.main ?? []).map((g) => g.map((e) => e.node));

// ---- Luồng 6b: đúng 5 node gọi Postgres và pgvector bật retry 3 lần cách 5 giây
const f6b = load('luong-6b-nap-tri-thuc.json');
const retried = f6b.nodes.filter((n) => n.retryOnFail).map((n) => n.name).sort();
assert.deepEqual(retried, ['Thống kê', 'Xoá bản cũ', 'Đọc căn nhà', 'Đọc tài liệu', 'Lưu vào pgvector'].sort());
for (const n of f6b.nodes.filter((x) => x.retryOnFail)) {
  assert.equal(n.maxTries, 3, n.name);
  assert.equal(n.waitBetweenTries, 5000, n.name);
}

// ---- Error workflow: email và Telegram chạy song song, hỏng một bên không chặn bên kia
const ew = load('error-workflow.json');
const get = (name) => ew.nodes.find((n) => n.name === name);
assert.deepEqual(next(ew, 'Tóm tắt lỗi'), [['Email báo lỗi', 'Có Telegram?']]);
assert.deepEqual(next(ew, 'Có Telegram?')[0], ['Gửi Telegram']);
assert.equal(get('Email báo lỗi').onError, 'continueRegularOutput');
const tg = get('Gửi Telegram');
assert.equal(tg.onError, 'continueRegularOutput');
assert.equal(tg.retryOnFail, true);
assert(!/parse_mode/.test(tg.parameters.jsonBody), 'Văn bản thuần: không dùng parse_mode');
assert(/\$env\.TELEGRAM_BOT_TOKEN/.test(tg.parameters.url) && /\$env\.TELEGRAM_SALE_CHAT_ID/.test(tg.parameters.jsonBody), 'Dùng biến môi trường đã có, không thêm credential');
assert(!tg.credentials, 'Gửi Telegram không dùng credential mới');
const cond = get('Có Telegram?').parameters.conditions.conditions[0].leftValue;
assert(/TELEGRAM_BOT_TOKEN/.test(cond) && /TELEGRAM_SALE_CHAT_ID/.test(cond), 'Thiếu một trong hai biến thì bỏ qua Telegram');

// chạy biểu thức nội dung tin với một lỗi mẫu
const env = { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_SALE_CHAT_ID: '-100123' };
const sum = { workflow: 'Luồng 1b', node: 'Email chốt lịch', message: 'x'.repeat(900), url: 'https://n8n.test/execution/9' };
const $ = () => ({ first: () => ({ json: sum }) });
const body = new Function('$env', '$', `return ${tg.parameters.jsonBody.replace(/^=\{\{/, '').replace(/\}\}$/, '')};`)(env, $);
const msg = JSON.parse(body);
assert.equal(msg.chat_id, '-100123');
assert(msg.text.includes('Luồng 1b') && msg.text.includes('Email chốt lịch') && msg.text.includes('https://n8n.test/execution/9'));
assert(msg.text.length < 4096, 'Tin Telegram không quá 4096 ký tự');
console.log('PASS: luồng 6b có retry 5 node; Error workflow báo email và Telegram độc lập');
