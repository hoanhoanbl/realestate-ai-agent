import * as crypto from 'crypto';

// Link Duyệt / Đổi giờ gửi cho nhân viên qua email, Telegram (FE-35).
// Không lưu gì trong DB: token = base64url(JSON) + '.' + chữ ký HMAC-SHA256 bằng WEBHOOK_SECRET.
// Hạn dùng KHÔNG nằm trong token mà tính theo giờ hẹn hiện tại của buổi xem lúc bấm,
// nên đổi giờ hẹn thì link vẫn đúng hạn mới.
export type StaffAction = 'approve' | 'reschedule';

export interface StaffLinkPayload {
  viewingId: number;
  action: StaffAction;
}

const b64 = (buf: Buffer) => buf.toString('base64url');

function sign(body: string, secret: string): Buffer {
  return crypto.createHmac('sha256', secret).update(body).digest();
}

export function signStaffLink(payload: StaffLinkPayload, secret: string | undefined = process.env.WEBHOOK_SECRET): string {
  if (!secret) throw new Error('Thiếu WEBHOOK_SECRET để ký link nhân viên');
  const body = b64(Buffer.from(JSON.stringify({ v: payload.viewingId, a: payload.action })));
  return `${body}.${b64(sign(body, secret))}`;
}

// Trả null khi token sai định dạng, sai chữ ký hoặc bị sửa. Không phân biệt lý do để không lộ thông tin.
export function verifyStaffLink(token: string, secret: string | undefined = process.env.WEBHOOK_SECRET): StaffLinkPayload | null {
  if (!secret || typeof token !== 'string' || token.length > 300) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  let given: Buffer;
  try {
    given = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  const expected = sign(body, secret);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const viewingId = Number(parsed?.v);
    if (!Number.isSafeInteger(viewingId) || viewingId <= 0) return null;
    if (parsed?.a !== 'approve' && parsed?.a !== 'reschedule') return null;
    return { viewingId, action: parsed.a };
  } catch {
    return null;
  }
}

export function staffLinkUrl(token: string, base: string = process.env.PUBLIC_WEB_URL || 'http://localhost:3000'): string {
  return `${base.replace(/\/$/, '')}/duyet/${token}`;
}

// Lý do từ chối khi tình trạng lịch đã đổi. Thứ tự từ cụ thể đến chung; null = được phép thao tác.
export interface StaffLinkContext {
  action: StaffAction;
  leadStatus: string;
  automationStatus: string;
  viewingStatus: string;
  viewingTime: Date | null;
  isOpenViewing: boolean; // buổi xem này là buổi mới nhất của lead
  now?: Date;
}

export function staffLinkRefusal(c: StaffLinkContext): string | null {
  const now = c.now ?? new Date();
  if (c.viewingStatus === 'CANCELLED') return 'Khách đã huỷ buổi xem này, không còn gì để duyệt.';
  if (c.viewingStatus !== 'NEW') return 'Buổi xem này đã kết thúc, liên kết không còn hiệu lực.';
  if (!c.isOpenViewing) return 'Khách đã có lịch xem mới hơn, liên kết này không còn dùng được.';
  if (c.leadStatus === 'CONFIRMED') return 'Lịch này đã được duyệt rồi.';
  if (c.leadStatus !== 'NEW') return 'Khách không còn ở trạng thái chờ duyệt.';
  if (!c.viewingTime || c.viewingTime.getTime() <= now.getTime()) return 'Đã tới giờ hẹn, liên kết này không còn hiệu lực.';
  if (c.action === 'approve' && c.automationStatus === 'PENDING') {
    return 'AI chưa chấm điểm xong, chưa duyệt được. Thử lại sau ít phút.';
  }
  return null;
}
