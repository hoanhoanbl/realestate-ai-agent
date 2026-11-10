import { BadRequestException } from '@nestjs/common';
import {
  assertCustomerSlot,
  assertStaffTime,
  bookableSlots,
  earliestBookableSlot,
  vnDateKey,
  vnTimeKey,
} from './viewing-time';

// Giờ Việt Nam viết kèm +07:00 nên kết quả không đổi theo TZ của máy chạy test
const vn = (s: string) => new Date(`${s}+07:00`);

describe('FE-34: khung giờ xem nhà', () => {
  it.each([
    ['2026-11-10T09:00:00', '2026-11-10T12:00:00'], // buổi sáng
    ['2026-11-10T15:30:00', '2026-11-10T19:00:00'], // làm tròn lên
    ['2026-11-10T17:00:00', '2026-11-11T08:00:00'], // quá 19:00 sang sáng mai
    ['2026-11-10T22:00:00', '2026-11-11T11:00:00'], // ban đêm tính từ 08:00
    ['2026-11-11T02:00:00', '2026-11-11T11:00:00'],
    ['2026-11-10T20:30:00', '2026-11-11T11:00:00'], // 0,5 giờ hôm nay + 2,5 giờ sáng mai = 10:30 → 11:00
  ])('đặt lúc %s thì khung sớm nhất là %s', (now, earliest) => {
    expect(earliestBookableSlot(vn(now))).toEqual(vn(earliest));
  });

  const now = vn('2026-11-10T09:00:00');
  const reject = (time: string, msg: RegExp) => {
    expect(() => assertCustomerSlot(vn(time), now)).toThrow(BadRequestException);
    expect(() => assertCustomerSlot(vn(time), now)).toThrow(msg);
  };

  it('khách: nhận khung hợp lệ, kể cả khung cuối 19:00', () => {
    expect(() => assertCustomerSlot(vn('2026-11-10T12:00:00'), now)).not.toThrow();
    expect(() => assertCustomerSlot(vn('2026-11-11T19:00:00'), now)).not.toThrow();
  });

  it('khách: chặn ngoài giờ xem', () => {
    reject('2026-11-11T03:00:00', /08:00–19:00/);
    reject('2026-11-11T20:00:00', /08:00–19:00/);
    reject('2026-11-11T19:30:00', /08:00–19:00/);
  });

  it('khách và bot: chặn giờ không tròn', () => {
    reject('2026-11-11T10:30:00', /tròn giờ/);
  });

  it('khách: chặn sớm hơn khung sớm nhất, báo khung sớm nhất', () => {
    reject('2026-11-10T11:00:00', /12:00 10\/11\/2026/);
  });

  it('khách: chặn xa hơn 14 ngày', () => {
    expect(() => assertCustomerSlot(vn('2026-11-24T09:00:00'), now)).not.toThrow();
    reject('2026-12-01T09:00:00', /14 ngày/);
  });

  it('nhân viên: không cần tròn giờ, không giới hạn 3 giờ và 14 ngày, nhưng vẫn trong giờ xem', () => {
    const at14 = vn('2026-11-10T14:00:00');
    expect(() => assertStaffTime(vn('2026-11-10T15:30:00'), at14)).not.toThrow();
    expect(() => assertStaffTime(vn('2026-12-20T10:15:00'), at14)).not.toThrow();
    expect(() => assertStaffTime(vn('2026-11-10T20:00:00'), at14)).toThrow(/08:00–19:00/);
    expect(() => assertStaffTime(vn('2026-11-10T13:00:00'), at14)).toThrow(/tương lai/);
  });

  it('danh sách khung: bắt đầu từ khung sớm nhất, mỗi ngày 08:00–19:00, tới 14 ngày', () => {
    const slots = bookableSlots(now);
    expect(slots[0]).toEqual(vn('2026-11-10T12:00:00'));
    const today = slots.filter((s) => vnDateKey(s) === '2026-11-10').map(vnTimeKey);
    expect(today).toEqual(['12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']);
    const tomorrow = slots.filter((s) => vnDateKey(s) === '2026-11-11');
    expect(tomorrow).toHaveLength(12);
    // Khung cuối không quá 14 ngày sau "bây giờ" (24/11 09:00)
    expect(slots[slots.length - 1]).toEqual(vn('2026-11-24T09:00:00'));
    for (const s of slots) expect(() => assertCustomerSlot(s, now)).not.toThrow();
  });
});
