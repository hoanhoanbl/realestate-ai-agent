// FE-50: kiểm luồng 1b ghi sự kiện VIEWING_CONFIRMATION_SENT đúng chỗ và đúng định dạng ghi chú.
// Chạy: node scripts/check-confirmation-note.cjs  (không cần n8n, backend hay mạng)
// Định dạng ghi chú chốt ở design D10 của change journey-followup-ladder:
//   viewing=<mã buổi xem>;time=<ISO 8601 UTC có mili giây, hậu tố Z>
// Hàm dựng ghi chú của backend (buildViewingConfirmationNote, FE-43) có test riêng; ở đây so với chuỗi mẫu của spec.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const flow = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows/luong-1b-chot-lich-thu-cong.json'), 'utf8'));
const get = (name) => flow.nodes.find((n) => n.name === name);
const next = (from) => (flow.connections[from]?.main ?? []).map((group) => group.map((e) => e.node));

const EVENT_NODES = ['Ghi log VIEWING_CONFIRMATION_SENT', 'Ghi log VIEWING_CONFIRMATION_SENT (đổi giờ)'];

// ---- Cấu trúc: sự kiện ghi ngay SAU thư thành công, không chặn chốt lịch
assert.deepEqual(next('Email chốt lịch'), [[EVENT_NODES[0]]], 'Thư chốt lịch phải nối tới node ghi sự kiện');
assert.deepEqual(next(EVENT_NODES[0]), [['Cập nhật CONFIRMED']], 'Ghi sự kiện xong mới cập nhật CONFIRMED');
assert.deepEqual(next('Email báo giờ mới'), [[EVENT_NODES[1]]], 'Thư báo giờ mới phải nối tới node ghi sự kiện');
assert.equal(next(EVENT_NODES[1]).flat().length, 0, 'Node ghi sự kiện của nhánh đổi giờ là bước cuối');
for (const name of EVENT_NODES) {
  const n = get(name);
  assert(n, `Thiếu node ${name}`);
  assert.equal(n.onError, 'continueRegularOutput', `${name}: lỗi ghi sự kiện không được chặn chốt lịch`);
  assert.equal(n.retryOnFail, true, `${name}: phải thử lại`);
  assert.equal(n.maxTries, 3);
  assert.equal(n.waitBetweenTries, 5000);
  assert.match(n.parameters.url, /\/api\/leads\/.*\/events$/);
}
// thư không khẳng định lịch (đã nhận yêu cầu) ở luồng 1 không được ghi sự kiện này
const flow1 = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows/luong-1-dat-lich.json'), 'utf8'));
assert(!JSON.stringify(flow1).includes('VIEWING_CONFIRMATION_SENT'), 'Luồng 1 không ghi VIEWING_CONFIRMATION_SENT (design D1)');
// nhánh hẹn lại giờ không phải thư xác nhận lịch
assert(!JSON.stringify(flow.connections['Email báo hẹn lại giờ']).includes('VIEWING_CONFIRMATION_SENT'));

// ---- Chạy node "Chuẩn bị" để lấy viewingTimeIso, rồi chạy biểu thức dựng ghi chú
const prepare = get('Chuẩn bị').parameters.jsCode;
const run = (viewingTime, viewingId) => {
  const cfg = { publicWebUrl: 'https://x.test' };
  const k = { leadId: 7, event: 'approved', by: 'Sale A' };
  const q = { viewing_time: viewingTime, viewing_id: viewingId, latest_viewing_id: viewingId, email: 'a@b.test', name: 'A', phone: '0', property_name: 'N', property_address: 'D', status: 'NEW', viewing_status: 'NEW', manage_token: '' };
  const DateTime = { fromISO: () => ({ setZone: () => ({ toFormat: () => 'giờ mẫu' }) }) };
  const $ = (name) => ({ first: () => ({ json: name === 'Chuẩn hoá' ? k : cfg }) });
  const $input = { first: () => ({ json: q }) };
  const out = new Function('$', '$input', 'DateTime', prepare)($, $input, DateTime)[0].json;
  const results = EVENT_NODES.map((name) => {
    const expr = get(name).parameters.jsonBody.replace(/^=\{\{/, '').replace(/\}\}$/, '');
    const $$ = (n) => ({ first: () => ({ json: n === 'Chuẩn bị' ? out : cfg }) });
    return new Function('$', `return (${expr});`)($$);
  });
  return { out, results };
};

// giờ UTC, giờ có offset Postgres trả về dạng chuỗi, và Date
for (const [input, expected] of [
  ['2026-11-20T03:00:00.000Z', 'viewing=42;time=2026-11-20T03:00:00.000Z'],
  ['2026-11-20T10:00:00+07:00', 'viewing=42;time=2026-11-20T03:00:00.000Z'],
  [new Date('2026-11-20T07:00:00.000Z'), 'viewing=42;time=2026-11-20T07:00:00.000Z'],
]) {
  const { out, results } = run(input, 42);
  assert.match(out.viewingTimeIso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'viewingTimeIso phải là ISO UTC có mili giây');
  for (const r of results) {
    assert.equal(r.type, 'VIEWING_CONFIRMATION_SENT');
    assert.equal(r.note, expected);
  }
}
console.log('PASS: luồng 1b ghi VIEWING_CONFIRMATION_SENT sau thư chốt lịch và thư báo giờ mới, ghi chú đúng định dạng');
