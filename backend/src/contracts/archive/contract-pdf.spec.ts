import * as zlib from 'zlib';
import { buildContractPdf, ContractPdfSource } from './contract-pdf';

// PNG 1x1 hợp lệ dựng bằng zlib để test không cần file ngoài
function tinyPng(): string {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // 8 bit
  ihdr[9] = 2; // RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 0, 0, 0]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const ALL_VIETNAMESE =
  'ăâđêôơư ÀÁẠẢÃ àáạảã ẰẮẶẲẴ ằắặẳẵ ẦẤẬẨẪ ầấậẩẫ ÈÉẸẺẼ èéẹẻẽ ỀẾỆỂỄ ềếệểễ ÌÍỊỈĨ ìíịỉĩ ' +
  'ÒÓỌỎÕ òóọỏõ ỒỐỘỔỖ ồốộổỗ ỜỚỢỞỠ ờớợởỡ ÙÚỤỦŨ ùúụủũ ỪỨỰỬỮ ừứựửữ ỲÝỴỶỸ ỳýỵỷỹ Đ đ';

const base = (over: Partial<ContractPdfSource> = {}): ContractPdfSource => ({
  id: 7,
  title: 'Hợp đồng đặt cọc căn nhà',
  content: `ĐIỀU 1. ${ALL_VIETNAMESE}\n\nĐIỀU 2. Tiền cọc 100.000.000 đồng.`,
  depositAmount: 100_000_000,
  propertyPrice: 3_000_000_000,
  agreedPrice: null,
  signerName: 'Nguyễn Thị Lan',
  signature: tinyPng(),
  signedAt: new Date('2026-11-20T03:15:00Z'),
  signedIp: '203.0.113.9',
  ...over,
});

// Mỗi trang là một đối tượng "/Type /Page" (khác "/Type /Pages")
const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;

describe('buildContractPdf (FE-49)', () => {
  const lead = { name: 'Nguyễn Thị Lan' };
  const property = { name: 'Nhà A', address: '1 Lê Lợi, Quận 1' };

  it('trả buffer PDF hợp lệ có đủ phần đầu và cuối file', async () => {
    const pdf = await buildContractPdf(base(), lead, property);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-8).toString()).toContain('%%EOF');
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(1);
  });

  it('chuỗi chứa mọi dấu tiếng Việt vẫn dựng được và nhúng phông Noto Sans', async () => {
    const pdf = await buildContractPdf(base(), lead, property);
    expect(pdf.toString('latin1')).toMatch(/NotoSans/);
  });

  it('hợp đồng dài ra nhiều trang', async () => {
    const long = Array.from({ length: 160 }, (_, i) => `Khoản ${i + 1}. ${ALL_VIETNAMESE}`).join('\n');
    const pdf = await buildContractPdf(base({ content: long }), lead, property);
    expect(pageCount(pdf)).toBeGreaterThan(2);
  });

  it('thiếu IP, tên căn, tên khách, nội dung và giờ ký thì vẫn dựng được', async () => {
    await expect(
      buildContractPdf(base({ signedIp: null, content: null, signedAt: null, signerName: null, title: null }), null, null),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('có giá thoả thuận thì dựng được và khác bản không có (thêm một dòng giá)', async () => {
    const without = await buildContractPdf(base(), lead, property);
    const withPrice = await buildContractPdf(base({ agreedPrice: 2_800_000_000 }), lead, property);
    expect(withPrice.subarray(0, 5).toString()).toBe('%PDF-');
    expect(withPrice.equals(without)).toBe(false);
  });

  it('chữ ký không phải PNG hợp lệ thì dùng khung trống, không ném lỗi', async () => {
    const bad = [
      'data:image/png;base64,KioqKioqKioq', // base64 hợp lệ nhưng không phải PNG
      'data:image/png;base64,iVBORw0KGgo=', // đúng chữ ký PNG nhưng thân hỏng
      'data:image/jpeg;base64,/9j/4AAQ',
      'không phải data url',
      '',
      null,
    ];
    for (const signature of bad) {
      await expect(buildContractPdf(base({ signature }), lead, property)).resolves.toBeInstanceOf(Buffer);
    }
  });

  it('cùng dữ liệu thì cùng ngày tạo trong file (không phụ thuộc giờ chạy)', async () => {
    const pdf = (await buildContractPdf(base(), lead, property)).toString('latin1');
    expect(pdf).toContain("D:20261120031500Z");
  });
});
