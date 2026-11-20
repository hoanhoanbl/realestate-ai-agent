import * as path from 'path';
import PDFDocument from 'pdfkit';
import type { Contract } from '../entities/contract.entity';
import type { Lead } from '../../leads/entities/lead.entity';
import type { Property } from '../../properties/entities/property.entity';

// Phông Noto Sans (SIL OFL) để hiển thị đủ dấu tiếng Việt. Thư mục assets nằm cạnh src (và dist) của backend:
// từ src/contracts/archive hoặc dist/contracts/archive lên ba cấp là gốc backend.
const FONT_DIR = path.resolve(__dirname, '../../../assets/fonts');
const REGULAR = path.join(FONT_DIR, 'NotoSans-Regular.ttf');
const BOLD = path.join(FONT_DIR, 'NotoSans-Bold.ttf');

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Chỉ nhận PNG hợp lệ; bất kỳ thứ gì khác trả null để PDF dùng khung trống thay vì làm hỏng cả file
function decodeSignature(dataUrl: string | null | undefined): Buffer | null {
  if (!dataUrl) return null;
  const match = PNG_DATA_URL.exec(dataUrl.trim());
  if (!match) return null;
  const bytes = Buffer.from(match[1], 'base64');
  return bytes.length > PNG_MAGIC.length && bytes.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC) ? bytes : null;
}

const vnd = (n: number | string) => `${Number(n).toLocaleString('vi-VN')} đồng`;

// Giờ ký theo giờ Việt Nam, không phụ thuộc múi giờ của máy chạy backend
function formatVietnamTime(d: Date): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')}:${get('second')} ngày ${get('day')}/${get('month')}/${get('year')} (giờ Việt Nam)`;
}

export type ContractPdfSource = Pick<
  Contract,
  | 'id' | 'title' | 'content' | 'depositAmount' | 'propertyPrice' | 'agreedPrice'
  | 'signerName' | 'signature' | 'signedAt' | 'signedIp'
>;

// Dựng PDF bản đã ký: tiêu đề, thông tin chính, nội dung theo đoạn (tự ngắt trang), trang cuối có khối "Bên B ký".
// Hàm thuần (không đọc DB, không ghi ổ đĩa) nên kiểm được bằng test đơn vị. Thiếu IP, tên căn, chữ ký hay nội dung
// thì vẫn dựng được PDF, phần thiếu để trống hoặc ghi "không có".
export function buildContractPdf(
  contract: ContractPdfSource,
  lead: Pick<Lead, 'name'> | null,
  property: Pick<Property, 'name' | 'address'> | null,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const code = `HD-${String(contract.id).padStart(4, '0')}`;
    const signedAt = contract.signedAt ? new Date(contract.signedAt) : null;
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 64, left: 56, right: 56 },
      info: {
        Title: contract.title || `Hợp đồng đặt cọc ${code}`,
        Author: 'RealEstate AI',
        Subject: `Bản đã ký ${code}`,
        // Giờ ký làm ngày tạo để cùng dữ liệu thì cùng ngày tạo, không phụ thuộc giờ chạy
        CreationDate: signedAt ?? new Date(),
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      doc.registerFont('regular', REGULAR);
      doc.registerFont('bold', BOLD);
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.font('bold').fontSize(16).text((contract.title || 'HỢP ĐỒNG ĐẶT CỌC').toUpperCase(), { align: 'center' });
      doc.font('regular').fontSize(10).fillColor('#444').text(`Số hợp đồng: ${code}`, { align: 'center' });
      doc.moveDown(1).fillColor('#000');

      // Khối thông tin chính
      const info: Array<[string, string]> = [
        ['Khách hàng (Bên B)', lead?.name || '(không có)'],
        ['Căn nhà', property ? `${property.name}${property.address ? `, ${property.address}` : ''}` : '(không có)'],
        ['Giá niêm yết', vnd(contract.propertyPrice)],
      ];
      if (contract.agreedPrice !== null && contract.agreedPrice !== undefined) {
        info.push(['Giá thoả thuận', vnd(contract.agreedPrice)]);
      }
      info.push(['Tiền đặt cọc', vnd(contract.depositAmount)]);
      doc.fontSize(11);
      for (const [label, value] of info) {
        doc.font('bold').text(`${label}: `, { continued: true }).font('regular').text(value);
      }
      doc.moveDown(0.8);
      doc.moveTo(doc.x, doc.y).lineTo(doc.x + width, doc.y).strokeColor('#999').lineWidth(0.5).stroke();
      doc.moveDown(0.8).fillColor('#000');

      // Nội dung: mỗi dòng của văn bản là một đoạn; dòng trống chỉ thêm khoảng cách
      const lines = (contract.content ?? '').replace(/\r\n?/g, '\n').split('\n');
      doc.fontSize(11).font('regular');
      for (const line of lines) {
        if (line.trim() === '') doc.moveDown(0.5);
        else doc.text(line, { align: 'justify', lineGap: 2 });
      }

      // Khối chữ ký ở cuối. Cần khoảng 230 pt; không đủ chỗ thì sang trang mới để khối không bị cắt đôi.
      doc.moveDown(1.5);
      if (doc.y > doc.page.height - doc.page.margins.bottom - 230) doc.addPage();
      doc.font('bold').fontSize(12).text('BÊN B KÝ XÁC NHẬN', { align: 'left' });
      doc.moveDown(0.4);

      const boxX = doc.x;
      const boxY = doc.y;
      const boxW = 220;
      const boxH = 90;
      doc.rect(boxX, boxY, boxW, boxH).strokeColor('#999').lineWidth(0.75).stroke();
      const png = decodeSignature(contract.signature);
      if (png) {
        try {
          doc.image(png, boxX + 4, boxY + 4, { fit: [boxW - 8, boxH - 8], align: 'center', valign: 'center' });
        } catch {
          // PNG có chữ ký byte đúng nhưng nội dung hỏng: để khung trống
        }
      }
      doc.x = boxX;
      doc.y = boxY + boxH + 8;

      doc.font('regular').fontSize(10.5);
      const sign: Array<[string, string]> = [
        ['Người ký', contract.signerName || '(không có)'],
        ['Giờ ký', signedAt ? formatVietnamTime(signedAt) : '(không có)'],
        ['Địa chỉ IP khi ký', contract.signedIp || '(không có)'],
        ['Mã hợp đồng', code],
      ];
      for (const [label, value] of sign) {
        doc.font('bold').text(`${label}: `, { continued: true }).font('regular').text(value);
      }
      doc.moveDown(1);
      doc.fontSize(9).fillColor('#555').text(
        'Bản lưu điện tử do hệ thống RealEstate AI tạo sau khi khách ký. Mã băm SHA-256 của file được ghi trong hệ thống để phát hiện file bị sửa; đây không phải chữ ký số.',
        { align: 'left' },
      );
      doc.end();
    } catch (err) {
      doc.end();
      reject(err);
    }
  });
}
