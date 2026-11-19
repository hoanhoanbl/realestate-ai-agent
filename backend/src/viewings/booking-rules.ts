import { ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

// Hai lịch xem cùng một căn phải cách nhau ít nhất 60 phút
export const BOOKING_GAP_MINUTES = 60;

const fmt = (d: Date) => new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

// Nhóm khoá advisory dành cho căn nhà (dạng 2 số: nhóm, id căn) để không đụng khoá khác sau này
export const PROPERTY_LOCK_NAMESPACE = 1001;

// Khoá theo căn trong transaction hiện tại: đặt lịch, đổi giờ, tạo hợp đồng, đổi trạng thái căn chạy lần lượt
export async function lockProperty(em: EntityManager, propertyId: number): Promise<void> {
  await em.query('SELECT pg_advisory_xact_lock($1, $2)', [PROPERTY_LOCK_NAMESPACE, propertyId]);
}

// Lịch "đang chờ" = buổi xem NEW của khách còn NEW/CONFIRMED
export async function assertNoBookingConflict(
  em: EntityManager,
  propertyId: number,
  time: Date,
  excludeViewingId: number | null = null,
): Promise<void> {
  const rows: { viewing_time: Date }[] = await em.query(
    `SELECT v.viewing_time
       FROM viewings v JOIN leads l ON l.id = v.lead_id
      WHERE v.property_id = $1
        AND v.status = 'NEW'
        AND l.status IN ('NEW', 'CONFIRMED')
        AND abs(extract(epoch FROM (v.viewing_time - $2::timestamptz))) < $3 * 60
        AND ($4::int IS NULL OR v.id <> $4)
      LIMIT 1`,
    [propertyId, time.toISOString(), BOOKING_GAP_MINUTES, excludeViewingId],
  );
  if (rows.length > 0) {
    throw new ConflictException(
      `Khung giờ này đã có khách hẹn xem căn này (lúc ${fmt(rows[0].viewing_time)}). Vui lòng chọn giờ cách ít nhất ${BOOKING_GAP_MINUTES} phút.`,
    );
  }
}

// Cùng email đã có lịch đang chờ cho cùng căn thì không đặt thêm
export async function assertNoDuplicateBooking(em: EntityManager, propertyId: number, email: string): Promise<void> {
  const rows: { viewing_time: Date }[] = await em.query(
    `SELECT v.viewing_time
       FROM viewings v JOIN leads l ON l.id = v.lead_id
      WHERE v.property_id = $1
        AND lower(l.email) = lower($2)
        AND v.status = 'NEW'
        AND l.status IN ('NEW', 'CONFIRMED')
      ORDER BY v.id DESC
      LIMIT 1`,
    [propertyId, email.trim()],
  );
  if (rows.length > 0) {
    throw new ConflictException(
      `Bạn đã có lịch xem căn này lúc ${fmt(rows[0].viewing_time)}. Nếu cần đổi giờ, hãy dùng link trong email xác nhận hoặc liên hệ nhân viên.`,
    );
  }
}

// FE-53: hai buổi xem của cùng một sale ở hai căn khác nhau phải cách nhau ít nhất 90 phút (60 phút xem + 30 phút đi lại)
export const SALE_GAP_MINUTES = 90;

// Nhóm khoá advisory theo sale. Thứ tự khoá toàn hệ thống: căn (1001) → chia sale (1002) → lead (FOR UPDATE) → sale (1003)
export const SALE_LOCK_NAMESPACE = 1003;

// Khoá theo sale trong transaction hiện tại: tạo buổi xem, đổi giờ, hẹn xem tiếp, chuyển sale của cùng sale chạy lần lượt
export async function lockSale(em: EntityManager, saleId: number): Promise<void> {
  await em.query('SELECT pg_advisory_xact_lock($1, $2)', [SALE_LOCK_NAMESPACE, saleId]);
}

export interface SaleConflict {
  viewingId: number;
  viewingTime: Date;
  propertyName: string;
  saleName: string;
}

// Buổi xem làm sale bận lúc `time`: lead do sale phụ trách, căn khác, cách dưới 90 phút.
// ATTENDED tính theo giờ hẹn (không xét trạng thái lead); NEW chỉ tính khi lead còn NEW/CONFIRMED
// (cùng điều kiện "đang chờ" với luật theo căn); CANCELLED và NO_SHOW không tính.
export async function findSaleConflict(
  em: EntityManager,
  saleId: number,
  time: Date,
  opts: { propertyId: number; excludeViewingId?: number | null },
): Promise<SaleConflict | null> {
  const rows: { id: number; viewing_time: Date; property_name: string; sale_name: string }[] = await em.query(
    `SELECT v.id, v.viewing_time, p.name AS property_name, u.name AS sale_name
       FROM viewings v
       JOIN leads l ON l.id = v.lead_id
       JOIN properties p ON p.id = v.property_id
       JOIN users u ON u.id = l.assigned_user_id
      WHERE l.assigned_user_id = $1
        AND v.property_id <> $2
        AND (v.status = 'ATTENDED' OR (v.status = 'NEW' AND l.status IN ('NEW', 'CONFIRMED')))
        AND abs(extract(epoch FROM (v.viewing_time - $3::timestamptz))) < $4 * 60
        AND ($5::int IS NULL OR v.id <> $5)
      ORDER BY v.viewing_time, v.id
      LIMIT 1`,
    [saleId, opts.propertyId, time.toISOString(), SALE_GAP_MINUTES, opts.excludeViewingId ?? null],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { viewingId: r.id, viewingTime: r.viewing_time, propertyName: r.property_name, saleName: r.sale_name };
}

export function saleConflictMessage(c: SaleConflict, context: 'schedule' | 'reassign'): string {
  const base = `Sale ${c.saleName} đã có lịch xem căn ${c.propertyName} lúc ${fmt(c.viewingTime)}`;
  return context === 'reassign'
    ? `${base}; chọn sale khác hoặc đổi giờ trước.`
    : `${base}. Hãy đổi giờ hoặc nhờ quản lý chuyển sale.`;
}

// Ném 409 khi sale bận. `schedule`: duyệt, đổi giờ, hẹn lại, hẹn xem tiếp; `reassign`: chuyển sale.
export async function assertSaleFree(
  em: EntityManager,
  saleId: number,
  time: Date,
  opts: { propertyId: number; excludeViewingId?: number | null },
  context: 'schedule' | 'reassign' = 'schedule',
): Promise<void> {
  const conflict = await findSaleConflict(em, saleId, time, opts);
  if (conflict) throw new ConflictException(saleConflictMessage(conflict, context));
}

// Duyệt (web admin hoặc nút trong thông báo): kiểm sale phụ trách với buổi xem NEW mới nhất của lead.
// Chỉ đọc, không khoá: duyệt không đổi giờ hay chủ lead (design D4).
export async function assertSaleFreeForApproval(em: EntityManager, leadId: number): Promise<void> {
  const rows: { id: number; property_id: number; viewing_time: Date; assigned_user_id: number | null }[] = await em.query(
    `SELECT v.id, v.property_id, v.viewing_time, l.assigned_user_id
       FROM viewings v JOIN leads l ON l.id = v.lead_id
      WHERE v.lead_id = $1 AND v.status = 'NEW'
      ORDER BY v.id DESC
      LIMIT 1`,
    [leadId],
  );
  const v = rows[0];
  if (!v || !v.assigned_user_id || !v.viewing_time) return;
  await assertSaleFree(em, v.assigned_user_id, new Date(v.viewing_time), {
    propertyId: v.property_id,
    excludeViewingId: v.id,
  });
}

// Chuyển sale khi người cũ đang dẫn buổi xem: hệ thống không lưu ai dẫn buổi đã điểm danh, mà tính bận theo
// người phụ trách lead hiện tại. Chuyển lead trong lúc buổi còn ảnh hưởng lịch (dưới 90 phút kể từ giờ hẹn)
// sẽ kéo lịch bận của sale cũ sang sale mới, nên chặn tới hết khoảng đó. Sau mốc này buổi xem không còn
// ảnh hưởng lịch nào (giờ mới luôn ở tương lai), nên chuyển thoải mái.
export async function assertNotMidVisit(em: EntityManager, leadId: number, saleId: number | null): Promise<void> {
  if (!saleId) return;
  const rows: { viewing_time: Date; property_name: string; sale_name: string }[] = await em.query(
    `SELECT v.viewing_time, p.name AS property_name, u.name AS sale_name
       FROM viewings v
       JOIN properties p ON p.id = v.property_id
       JOIN users u ON u.id = $2
      WHERE v.lead_id = $1 AND v.status = 'ATTENDED'
        AND v.viewing_time > now() - make_interval(mins => $3)
      ORDER BY v.viewing_time DESC
      LIMIT 1`,
    [leadId, saleId, SALE_GAP_MINUTES],
  );
  if (rows.length === 0) return;
  const r = rows[0];
  const until = new Date(new Date(r.viewing_time).getTime() + SALE_GAP_MINUTES * 60000);
  throw new ConflictException(
    `Sale ${r.sale_name} đang dẫn buổi xem căn ${r.property_name} lúc ${fmt(r.viewing_time)}. Chuyển người phụ trách sau ${fmt(until)}.`,
  );
}
