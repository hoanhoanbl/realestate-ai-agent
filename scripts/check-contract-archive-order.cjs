// FE-49: kiểm luồng 3 lưu bản đã ký TRƯỚC các thư sau ký, ở cả hai đường "đã ký lần 1" và "lần 2".
// Chạy: node scripts/check-contract-archive-order.cjs  (không cần n8n, backend hay mạng)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows/luong-3-hop-dong.json'), 'utf8'));
const get = (name) => {
  const node = wf.nodes.find((n) => n.name === name);
  assert(node, `Thiếu node "${name}"`);
  return node;
};

const SAVE = 'Lưu bản đã ký';
const MAILS = ['Email xác nhận đã ký', 'Email báo đã ký'];
const CHECK = 'Báo lỗi lưu trữ?';
const STOP = 'Dừng vì lưu lỗi';
const SIGNED_IFS = ['Đã ký lần 1?', 'Đã ký lần 2?'];

// Cạnh của đồ thị: tên node -> các node đứng ngay sau (mọi đầu ra)
const next = (name) =>
  Object.values(wf.connections[name] ?? {}).flatMap((outputs) => outputs.flat().map((c) => c.node));
const outputTargets = (name, index) => (wf.connections[name]?.main?.[index] ?? []).map((c) => c.node);

// Các node tới được từ `starts`, không đi qua node `blocked`
const reach = (starts, blocked) => {
  const seen = new Set();
  const stack = [...starts];
  while (stack.length) {
    const n = stack.pop();
    if (n === blocked || seen.has(n)) continue;
    seen.add(n);
    stack.push(...next(n));
  }
  return seen;
};

// 1. Node lưu: POST /archive, thử 3 lần, lỗi thì đi tiếp (để thư vẫn gửi)
const save = get(SAVE);
assert.equal(save.parameters.method, 'POST');
assert(/\/api\/contracts\/\{\{[^}]*contractId[^}]*\}\}\/archive$/.test(save.parameters.url), `URL lưu sai: ${save.parameters.url}`);
assert.equal(save.parameters.genericAuthType, 'httpHeaderAuth', 'Phải gửi X-Webhook-Secret qua credential header');
assert.equal(save.retryOnFail, true);
assert.equal(save.maxTries, 3);
assert.equal(save.onError, 'continueRegularOutput', 'Lưu lỗi thì luồng vẫn đi tiếp để khách và sale nhận thư');

// 2. Cả hai đường "đã ký" đi vào node lưu, không có đường nào vào thư mà không qua nó
for (const ifName of SIGNED_IFS) {
  assert.deepEqual(outputTargets(ifName, 0), [SAVE], `${ifName} (đã ký) phải đi vào "${SAVE}"`);
}
assert.deepEqual(outputTargets(SAVE, 0), [MAILS[0]], `"${SAVE}" phải nối tới "${MAILS[0]}"`);
const signedStarts = SIGNED_IFS.flatMap((n) => outputTargets(n, 0));
const withoutSave = reach(signedStarts, SAVE);
for (const mail of MAILS) {
  assert(!withoutSave.has(mail), `Có đường tới "${mail}" mà không qua "${SAVE}"`);
}
// ... và ngược lại: qua node lưu thì tới được cả hai thư
const withSave = reach(signedStarts, null);
for (const mail of MAILS) assert(withSave.has(mail), `"${mail}" không còn được nối vào luồng`);

// 3. Thứ tự thư: xác nhận rồi báo sale, sau đó mới kiểm lỗi lưu
assert.deepEqual(outputTargets(MAILS[0], 0), [MAILS[1]]);
assert.deepEqual(outputTargets(MAILS[1], 0), [CHECK]);

// 4. Kiểm lỗi lưu: lưu hỏng thì dừng ở trạng thái lỗi (Stop and Error), lưu tốt thì kết thúc
assert.deepEqual(outputTargets(CHECK, 0), [STOP], 'Lưu lỗi phải tới node dừng vì lỗi');
assert.deepEqual(outputTargets(CHECK, 1), [], 'Lưu tốt thì kết thúc bình thường');
assert.equal(get(STOP).type, 'n8n-nodes-base.stopAndError');
assert(get(STOP).parameters.errorMessage.includes('Lưu lại bản đã ký'), 'Thông báo lỗi phải chỉ cách xử lý cho quản lý');
const cond = get(CHECK).parameters.conditions.conditions[0].leftValue;
assert(cond.includes(`$('${SAVE}')`) && cond.includes('.ok !== true'), 'Điều kiện phải coi mọi kết quả khác ok:true là lỗi');

// 5. Nhánh hết hạn không lưu gì; hai thư sau ký không bật continueOnFail (lỗi thư phải làm execution lỗi)
assert(!reach(outputTargets('Đã ký lần 2?', 1), null).has(SAVE), 'Nhánh hết hạn không được gọi lưu trữ');
for (const mail of MAILS) {
  assert(get(mail).onError === undefined && !get(mail).continueOnFail, `"${mail}" không được nuốt lỗi`);
}

// 6. Luồng này dùng Error workflow để báo quản lý
assert(wf.settings.errorWorkflow, 'Thiếu errorWorkflow trong settings');

// 7. Mọi tham chiếu trong connections trỏ tới node có thật
const names = new Set(wf.nodes.map((n) => n.name));
for (const [from, outs] of Object.entries(wf.connections)) {
  assert(names.has(from), `connections có node không tồn tại: ${from}`);
  for (const c of Object.values(outs).flat(2)) assert(names.has(c.node), `${from} nối tới node không tồn tại: ${c.node}`);
}

console.log('PASS check-contract-archive-order');
