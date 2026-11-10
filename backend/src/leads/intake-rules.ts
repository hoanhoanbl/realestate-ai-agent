import { BadRequestException } from '@nestjs/common';

// Dùng chung cho API, truy vấn dữ liệu cũ và migration, không nhận email làm khoá khách.
export function normalizePhone(value: string): string {
  if (typeof value !== 'string' || !/^[+\d\s.()-]+$/.test(value)) {
    throw new BadRequestException('Số điện thoại không hợp lệ');
  }
  const phone = value.replace(/[\s.()-]/g, '').replace(/^\+84/, '0');
  if (!/^\d{8,15}$/.test(phone))
    throw new BadRequestException('Số điện thoại phải có 8–15 chữ số');
  return phone;
}

// Cộng giờ làm việc: Việt Nam UTC+7, mỗi ngày 08:00–21:00, kể cả cuối tuần. Không phụ thuộc TZ của máy chủ.
export function addWorkingHours(from: Date, hours: number): Date {
  const local = new Date(from.getTime() + 7 * 3600000);
  let remaining = hours * 3600000;
  while (remaining > 0) {
    const start = new Date(local);
    start.setUTCHours(8, 0, 0, 0);
    const end = new Date(local);
    end.setUTCHours(21, 0, 0, 0);
    if (local < start) local.setTime(start.getTime());
    if (local >= end) {
      local.setUTCDate(local.getUTCDate() + 1);
      local.setUTCHours(8, 0, 0, 0);
      continue;
    }
    const used = Math.min(remaining, end.getTime() - local.getTime());
    local.setTime(local.getTime() + used);
    remaining -= used;
  }
  return new Date(local.getTime() - 7 * 3600000);
}

// Hạn phản hồi đầu tiên của sale: 2 giờ làm việc.
export function responseDeadline(from: Date): Date {
  return addWorkingHours(from, 2);
}

export const INTAKE_LOCK_NAMESPACE = 1002;
// Toàn bộ intake/chuyển sale/công tắc nhận khách dùng cùng khoá giao dịch để lượt chia không bị tranh chấp.
export const ASSIGNMENT_LOCK_SQL = 'SELECT pg_advisory_xact_lock(1002, 0)';
// Fallback cho lead cũ chưa backfill; chọn id nhỏ nhất nếu dữ liệu cũ trùng, không tự gộp/xoá.
export const NORMALIZED_PHONE_SQL = `COALESCE(l.phone_normalized,
  regexp_replace(regexp_replace(l.phone, '[[:space:].()\\-]', '', 'g'), '^\\+84', '0'))`;
