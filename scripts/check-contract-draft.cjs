// FE-48: kiểm node "Soạn hợp đồng" của luồng 3 khi hợp đồng có giá thoả thuận.
// Chạy: node scripts/check-contract-draft.cjs  (không cần n8n, backend hay mạng)
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const wf = JSON.parse(fs.readFileSync(path.join(__dirname, '../n8n-workflows/luong-3-hop-dong.json'), 'utf8'));
const get = (name) => {
  const node = wf.nodes.find((n) => n.name === name);
  assert(node, `Thiếu node "${name}"`);
  return node;
};

// SQL phải đọc cột giá thoả thuận
assert(/c\.agreed_price/.test(get('Lấy dữ liệu hợp đồng').parameters.query), 'SQL phải lấy c.agreed_price');

// Hai email có dòng giá dùng priceRowsHtml (một dòng khi không có giá thoả thuận, hai dòng khi có)
for (const [mail, src] of [['Email quản lý duyệt', 'Gộp rà soát'], ['Email khách ký', 'Soạn hợp đồng']]) {
  assert(get(mail).parameters.html.includes(`$('${src}').first().json.priceRowsHtml`), `${mail} phải hiện dòng giá qua priceRowsHtml`);
}
assert(/giá thoả thuận/.test(get('AI rà soát').parameters.text), 'Prompt AI rà soát phải nói về giá thoả thuận');

// Chạy node soạn với dữ liệu mẫu. DateTime giả cố định ngày để so chuỗi.
const code = get('Soạn hợp đồng').parameters.jsCode;
const fakeNow = { setZone: () => fakeNow, toFormat: () => '20/11/2026', plus: () => fakeNow };
const DateTime = { now: () => fakeNow };
const draft = (row) => {
  const input = { first: () => ({ json: row }) };
  return new Function('$input', 'DateTime', code)(input, DateTime)[0].json;
};
const base = {
  contract_id: 7, status: 'DRAFTING', deposit_amount: '100000000', property_price: '3000000000', agreed_price: null,
  created_by: 'Bình', lead_id: 5, name: 'Lan', email: 'lan@example.test', phone: '0900000001',
  property_name: 'Nhà A', property_address: '1 Lê Lợi', property_area: '80',
};
const money = (n) => Number(n).toLocaleString('vi-VN') + ' đồng';
const lines = (r) => r.content.split('\n');

// 1. Không có giá thoả thuận: soạn y như bản cũ
{
  const r = draft(base);
  assert(lines(r).includes(`Giá niêm yết: ${money(3000000000)}.`));
  assert(lines(r).includes(`Tiền đặt cọc: ${money(100000000)} (3.3% giá niêm yết).`));
  assert(!/thoả thuận|đối chiếu/.test(r.content + r.flags.join(' ') + r.priceRowsHtml), 'Không có giá thoả thuận thì không nhắc giá thoả thuận');
  assert.equal(r.price, 3000000000);
  assert.equal(r.priceText, money(3000000000));
  assert.deepEqual(r.flags, []);
  assert.equal((r.priceRowsHtml.match(/<tr>/g) || []).length, 1, 'Một dòng giá trong email');
  assert(r.priceRowsHtml.includes('Giá niêm yết') && r.priceRowsHtml.includes(money(3000000000)));
  // agreed_price undefined (SQL cũ) cũng coi là không có
  const { agreed_price, ...old } = base;
  assert.equal(draft(old).content, r.content);
}

// 2. Có giá thoả thuận: hai dòng giá, phần trăm theo giá thoả thuận, văn bản và email dùng giá đó
{
  const r = draft({ ...base, agreed_price: '2850000000' });
  const l = lines(r);
  const i = l.indexOf(`Giá thoả thuận: ${money(2850000000)}.`);
  assert(i >= 0, 'Có dòng giá thoả thuận');
  assert.equal(l[i + 1], `Giá niêm yết (đối chiếu): ${money(3000000000)}.`);
  assert.equal(l[i + 2], `Tiền đặt cọc: ${money(100000000)} (3.5% giá thoả thuận).`);
  assert(!l.includes(`Giá niêm yết: ${money(3000000000)}.`));
  assert.equal(r.price, 2850000000);
  assert.equal(r.priceText, money(2850000000));
  assert.equal(r.pct, 3.5);
  assert.deepEqual(r.flags, [], 'Lệch 5% thì không cảnh báo');
  assert.equal((r.priceRowsHtml.match(/<tr>/g) || []).length, 2, 'Hai dòng giá trong email');
  assert(r.priceRowsHtml.includes('Giá thoả thuận') && r.priceRowsHtml.includes('Giá niêm yết (đối chiếu)'));
}

// 3. Lệch quá 20% (thấp hơn 25% và cao hơn 25%) thì có cảnh báo; đúng 20% thì không
{
  const low = draft({ ...base, agreed_price: '2250000000' });
  assert.equal(low.flags.length, 1);
  assert(/thấp hơn giá niêm yết 25%/.test(low.flags[0]), low.flags[0]);
  const high = draft({ ...base, agreed_price: '3750000000' });
  assert.equal(high.flags.length, 1);
  assert(/cao hơn giá niêm yết 25%/.test(high.flags[0]), high.flags[0]);
  assert.deepEqual(draft({ ...base, agreed_price: '2400000000' }).flags, [], 'Đúng 20% chưa quá');
  assert.deepEqual(draft({ ...base, agreed_price: '3600000000' }).flags, [], 'Đúng 20% chưa quá');
}

// 4. Cảnh báo cọc tính theo giá thoả thuận: cọc 1 triệu trên giá thoả thuận 2,85 tỷ là dưới 1%
{
  const r = draft({ ...base, agreed_price: '2850000000', deposit_amount: '1000000' });
  assert(r.flags.some((f) => /giá thoả thuận, khó ràng buộc/.test(f)), r.flags.join('|'));
}

console.log('PASS: Soạn hợp đồng dùng giá thoả thuận đúng');
