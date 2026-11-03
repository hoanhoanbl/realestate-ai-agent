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
