import { BadRequestException } from '@nestjs/common';
import { addWorkingHours } from '../leads/intake-rules';

// ---- Khung giờ xem nhà (FE-34). Mọi phép tính theo giờ Việt Nam UTC+7, không phụ thuộc TZ máy chủ. ----

export const VIEWING_FIRST_HOUR = 8; // khung đầu tiên 08:00
export const VIEWING_LAST_HOUR = 19; // khung cuối cùng 19:00
export const BOOKING_LEAD_HOURS = 3; // khách đặt sớm nhất sau 3 giờ làm việc
export const BOOKING_MAX_DAYS = 14; // khách đặt xa nhất 14 ngày

const HOUR_MS = 3600000;
const VN_OFFSET_MS = 7 * HOUR_MS;

// Đổi sang "giờ Việt Nam đặt trong các trường UTC" để dùng getUTC*/setUTC*
const toVn = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS);
const fromVn = (d: Date) => new Date(d.getTime() - VN_OFFSET_MS);
const pad = (n: number) => String(n).padStart(2, '0');

export function vnDateKey(d: Date): string {
  const v = toVn(d);
  return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
}

export function vnTimeKey(d: Date): string {
  const v = toVn(d);
  return `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`;
}

export function formatVn(d: Date): string {
  const v = toVn(d);
  return `${vnTimeKey(d)} ${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
}

// Khung sớm nhất khách được đặt: cộng 3 giờ làm việc (08:00–21:00), làm tròn lên giờ chẵn,
// quá 19:00 thì sang 08:00 hôm sau.
export function earliestBookableSlot(now: Date): Date {
  const v = toVn(addWorkingHours(now, BOOKING_LEAD_HOURS));
  if (v.getUTCMinutes() || v.getUTCSeconds() || v.getUTCMilliseconds()) {
    v.setUTCHours(v.getUTCHours() + 1, 0, 0, 0);
  }
  if (v.getUTCHours() > VIEWING_LAST_HOUR) {
    v.setUTCDate(v.getUTCDate() + 1);
    v.setUTCHours(VIEWING_FIRST_HOUR, 0, 0, 0);
  } else if (v.getUTCHours() < VIEWING_FIRST_HOUR) {
    v.setUTCHours(VIEWING_FIRST_HOUR, 0, 0, 0);
  }
  return fromVn(v);
}

export function latestBookableTime(now: Date): Date {
  return new Date(now.getTime() + BOOKING_MAX_DAYS * 24 * HOUR_MS);
}

function assertViewingHours(date: Date): void {
  const v = toVn(date);
  const h = v.getUTCHours();
  const afterLast =
    h > VIEWING_LAST_HOUR ||
    (h === VIEWING_LAST_HOUR && (v.getUTCMinutes() || v.getUTCSeconds() || v.getUTCMilliseconds()));
  if (h < VIEWING_FIRST_HOUR || afterLast) {
    throw new BadRequestException(
      `Giờ xem nhà phải trong khoảng ${pad(VIEWING_FIRST_HOUR)}:00–${VIEWING_LAST_HOUR}:00`,
    );
  }
}

// Khách và bot (đặt qua POST /viewings): trong giờ xem, tròn giờ, từ khung sớm nhất, không quá 14 ngày.
export function assertCustomerSlot(date: Date, now: Date = new Date()): void {
  assertViewingHours(date);
  const v = toVn(date);
  if (v.getUTCMinutes() || v.getUTCSeconds() || v.getUTCMilliseconds()) {
    throw new BadRequestException('Giờ xem nhà phải tròn giờ (ví dụ 09:00, 10:00)');
  }
  const earliest = earliestBookableSlot(now);
  if (date < earliest) {
    throw new BadRequestException(
      `Cần đặt trước ít nhất ${BOOKING_LEAD_HOURS} giờ làm việc. Khung sớm nhất còn đặt được: ${formatVn(earliest)}`,
    );
  }
  if (date > latestBookableTime(now)) {
    throw new BadRequestException(`Chỉ nhận đặt lịch trong vòng ${BOOKING_MAX_DAYS} ngày tới`);
  }
}

// Nhân viên đổi giờ: chỉ cần ở tương lai và trong giờ xem.
export function assertStaffTime(date: Date, now: Date = new Date()): void {
  if (date.getTime() < now.getTime()) {
    throw new BadRequestException('viewingTime phải ở trong tương lai');
  }
  assertViewingHours(date);
}

// Mọi khung giờ khách đặt được, từ khung sớm nhất tới 14 ngày tới, theo thứ tự thời gian.
export function bookableSlots(now: Date): Date[] {
  const latest = latestBookableTime(now);
  const slots: Date[] = [];
  const v = toVn(earliestBookableSlot(now));
  while (fromVn(v) <= latest) {
    if (v.getUTCHours() > VIEWING_LAST_HOUR) {
      v.setUTCDate(v.getUTCDate() + 1);
      v.setUTCHours(VIEWING_FIRST_HOUR, 0, 0, 0);
      continue;
    }
    slots.push(fromVn(v));
    v.setUTCHours(v.getUTCHours() + 1);
  }
  return slots;
}

// Chuẩn hoá giờ xem nhà: không kèm múi giờ thì hiểu là giờ Việt Nam (+07:00), và bắt buộc ở tương lai.
export function parseViewingTime(raw: string): { text: string; date: Date } {
  let text = raw.trim();
  if (!text.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(text)) {
    text = `${text}+07:00`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Invalid viewingTime format');
  }
  if (date.getTime() < Date.now()) {
    throw new BadRequestException('viewingTime phải ở trong tương lai');
  }
  return { text, date };
}

// Được ghi nhận "đã xem" / "không đến" từ 30 phút trước giờ hẹn trở đi
export const ATTENDANCE_GRACE_MS = 30 * 60 * 1000;

export function assertViewingStarted(viewingTime: Date | null): void {
  if (viewingTime && Date.now() < viewingTime.getTime() - ATTENDANCE_GRACE_MS) {
    throw new BadRequestException('Chưa đến giờ hẹn, chưa ghi nhận được khách có đến hay không');
  }
}
