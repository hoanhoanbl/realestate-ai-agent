// FE-35: kiểm tra cấu trúc luồng 1 (không còn chờ 24 giờ) và luồng 1b (theo từng buổi xem, thêm yêu cầu đổi giờ).
// Chạy: node scripts/check-approval-links-workflow.cjs  (không cần n8n, backend hay mạng)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows', f), 'utf8'));
const flow1 = load('luong-1-dat-lich.json');
const flow1b = load('luong-1b-chot-lich-thu-cong.json');
const get = (wf, name) => wf.nodes.find((n) => n.name === name);
const edges = (wf, from) => (wf.connections[from]?.main ?? []).map((group) => group.map((e) => e.node));

// ---- Luồng 1: không còn node chờ, không còn link resume, thông báo gửi theo sale phụ trách
assert(!flow1.nodes.some((n) => n.type === 'n8n-nodes-base.wait'), 'Luồng 1 không được còn node Wait');
assert(!JSON.stringify(flow1).includes('resumeUrl'), 'Luồng 1 không được dùng resumeUrl');
assert(!JSON.stringify(flow1).includes('approvalUrl'), 'Luồng 1 không còn gửi approvalUrl cho backend');
assert(!flow1.nodes.some((n) => n.type === 'n8n-nodes-base.respondToWebhook'), 'Không còn node trả lời link duyệt trong luồng 1');
assert(!flow1.nodes.some((n) => /push_token|exp\.host/.test(JSON.stringify(n.parameters))), 'Push do sub-workflow gửi, không phải luồng 1');
assert(!flow1.nodes.some((n) => /APPROVED|CONFIRMED|APPROVAL_TIMEOUT/.test(JSON.stringify(n.parameters))), 'Duyệt lịch do luồng 1b xử lý, không còn nhánh duyệt trong luồng 1');
for (const mail of ['Email khách HOT', 'Email khách WARM', 'Email khách COLD']) {
  assert.equal(edges(flow1, mail)[0][0], 'Lấy link duyệt', `${mail} phải đi qua bước lấy link`);
}
assert.equal(edges(flow1, 'Lấy link duyệt')[0][0], 'Dữ liệu thông báo');
assert.equal(edges(flow1, 'Thông báo nhân viên')[0][0], 'Lưu kết quả AI');
assert.equal(edges(flow1, 'Ghi log AI_SCORED').flat().length, 0, 'Ghi log AI_SCORED là bước cuối');
const notify = get(flow1, 'Dữ liệu thông báo').parameters.jsCode;
assert(/assigneeId/.test(notify) && !/staffEmail/.test(notify), 'Thông báo phải gửi theo assigneeId, không dùng email cứng');
assert(/staff-links/.test(get(flow1, 'Lấy link duyệt').parameters.url));
assert(!/24 giờ/.test(notify), 'Email báo nhân viên không còn nói hạn 24 giờ');

// chạy thử "Dữ liệu thông báo" với link của backend và khi backend lỗi
const run = (links, assignedUserId) => {
  const nodes = {
    'Chuẩn hoá': { leadId: 7, name: 'Bình', email: 'b@example.test', phone: '0900000001', budget: 3000000000, needs: 'nhà', propertyId: 1, viewingTime: '2026-11-20T02:00:00.000Z' },
    'Basic LLM Chain': { output: { level: 'HOT', score: 88, reason: 'ngân sách rõ', staffNote: 'gọi sớm' } },
    'Ghép dữ liệu': { property: { name: 'Nhà A', address: '1 Lê Lợi' } },
    Webhook: { body: { source: 'facebook', assignedUserId } },
    'Cấu hình': { staffEmail: 'x', managerEmail: 'm' },
    ...(links ? { 'Lấy link duyệt': links } : {}),
  };
  const $ = (name) => ({ isExecuted: nodes[name] !== undefined, first: () => ({ json: nodes[name] }) });
  const DateTime = { fromISO: () => ({ setZone: () => ({ weekday: 1, toFormat: () => '09:00' }) }) };
  return new Function('$', '$env', 'DateTime', get(flow1, 'Dữ liệu thông báo').parameters.jsCode)($, { PUBLIC_WEB_URL: 'https://nha.example' }, DateTime)[0].json;
};
const withLinks = run({ approveUrl: 'https://nha.example/duyet/a.b', rescheduleUrl: 'https://nha.example/duyet/c.d' }, 5);
assert.equal(withLinks.assigneeId, 5); assert(!('emailTo' in withLinks));
assert.deepEqual(withLinks.actions.map((a) => a.url), ['https://nha.example/duyet/a.b', 'https://nha.example/duyet/c.d', 'https://nha.example/admin/leads/7']);
assert(withLinks.emailHtml.includes('https://nha.example/duyet/a.b') && withLinks.emailHtml.includes('tới giờ hẹn'));
const noAssignee = run({ approveUrl: 'https://nha.example/duyet/a.b', rescheduleUrl: 'https://nha.example/duyet/c.d' }, undefined);
assert.equal(noAssignee.assigneeId, 0, 'chưa có sale phụ trách phải gửi assigneeId=0 để sub-workflow báo quản lý');
const backendDown = run({ error: { message: 'timeout' } }, 5);
assert.deepEqual(backendDown.actions.map((a) => a.label), ['📋 Xem chi tiết'], 'backend lỗi chỉ còn nút xem chi tiết');
assert(!/duyet\//.test(backendDown.emailHtml));

// ---- Luồng 1b: theo từng buổi xem, thêm yêu cầu đổi giờ
const normalize = (body) => new Function('$', get(flow1b, 'Chuẩn hoá').parameters.jsCode)(() => ({ first: () => ({ json: { body } }) }))[0].json;
assert.equal(normalize({ leadId: 3, event: 'approved' }).viewingId, 0, 'web admin không gửi viewingId: lấy buổi xem mới nhất');
assert.equal(normalize({ leadId: 3, event: 'reschedule_requested', viewingId: 12 }).viewingId, 12);
assert.throws(() => normalize({ leadId: 3, event: 'approved', viewingId: -1 }), /viewingId/);
assert.throws(() => normalize({ leadId: 3, event: 'approved', viewingId: 'x' }), /viewingId/);
assert.throws(() => normalize({ leadId: 3, event: 'bogus' }), /event/);
assert(/\$2::int = 0 OR v\.id = \$2::int/.test(get(flow1b, 'Lấy dữ liệu lịch').parameters.query));
assert(/latest_viewing_id/.test(get(flow1b, 'Lấy dữ liệu lịch').parameters.query));
assert.equal(edges(flow1b, 'Chuẩn bị')[0][0], 'Yêu cầu đổi giờ?');
const [yes, no] = edges(flow1b, 'Yêu cầu đổi giờ?');
assert.equal(yes[0], 'Còn chờ đổi giờ?'); assert.equal(no[0], 'Duyệt hay đổi giờ?');
assert.equal(edges(flow1b, 'Còn chờ đổi giờ?')[0][0], 'Email báo hẹn lại giờ');
assert.equal(edges(flow1b, 'Email báo hẹn lại giờ')[0][0], 'Ghi log RESCHEDULE_REQUESTED');
assert(/isLatest/.test(JSON.stringify(get(flow1b, 'Còn chờ duyệt?').parameters)), 'Duyệt phải kiểm tra đây là buổi xem mới nhất');
assert(/isLatest/.test(JSON.stringify(get(flow1b, 'Còn chờ đổi giờ?').parameters)));

// ---- Mọi tham chiếu node và kết nối đều trỏ tới node có thật
for (const wf of [flow1, flow1b]) {
  const names = new Set(wf.nodes.map((n) => n.name));
  for (const [from, out] of Object.entries(wf.connections)) {
    assert(names.has(from), `Kết nối từ node không tồn tại: ${from}`);
    for (const groups of Object.values(out)) for (const group of groups) for (const e of group) assert(names.has(e.node), `Thiếu node đích ${e.node}`);
  }
  for (const n of wf.nodes) {
    if (n.parameters.jsCode) new Function('$', '$json', '$input', '$env', 'DateTime', n.parameters.jsCode);
    for (const ref of JSON.stringify(n.parameters).matchAll(/\$\('([^']+)'\)/g)) assert(names.has(ref[1]), `Thiếu node ${ref[1]} (trong ${n.name})`);
  }
}
console.log('PASS: FE-35 luồng 1 không còn chờ, link do backend cấp, luồng 1b theo từng buổi xem và yêu cầu đổi giờ.');
