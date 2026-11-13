import { workDecision } from './feedback-work.rules';
import { addWorkingHours } from '../leads/intake-rules';

describe('Theo dõi sau phản hồi: quyết định nghiệp vụ', () => {
  const now = new Date('2026-11-12T03:00:00Z');
  const base = { version: 1, outcome: 'CONTACTED' as const, note: 'Đã trao đổi' };
  it('chỉ hoàn tất đã liên hệ khi sale xác nhận không cần chăm sóc tiếp', () => {
    expect(workDecision({ ...base, complete: true }, now).completes).toBe(true);
    expect(() => workDecision(base, now)).toThrow('hạn liên hệ');
    expect(workDecision({ ...base, nextDueAt: '2026-11-13T03:00:00Z' }, now).completes).toBe(false);
  });
  it.each(['NEEDS_TIME', 'UNREACHABLE'] as const)('%s cần hạn tương lai và không được đánh dấu hoàn tất', outcome => {
    expect(() => workDecision({ ...base, outcome, complete: true }, now)).toThrow();
    expect(() => workDecision({ ...base, outcome, nextDueAt: now.toISOString() }, now)).toThrow();
    expect(workDecision({ ...base, outcome, nextDueAt: '2026-11-13T03:00:00Z' }, now).due?.toISOString()).toBe('2026-11-13T03:00:00.000Z');
  });
  it('hẹn xem phải có căn và giờ; hoàn tất không kèm ngày gọi tiếp', () => {
    expect(() => workDecision({ ...base, outcome: 'NEXT_VIEWING' }, now)).toThrow();
    expect(() => workDecision({ ...base, complete: true, nextDueAt: '2026-11-13T03:00:00Z' }, now)).toThrow();
    expect(() => workDecision({ ...base, note: '  ', complete: true }, now)).toThrow();
    expect(() => workDecision({ ...base, complete: true, propertyId: 1 }, now)).toThrow();
  });
  it('20:30 nhận phản hồi: hạn đầu 09:30 hôm sau, báo quản lý 11:30', () => {
    const due = addWorkingHours(new Date('2026-11-12T20:30:00+07:00'),2);
    expect(due.toISOString()).toBe('2026-11-13T02:30:00.000Z');
    expect(addWorkingHours(due,2).toISOString()).toBe('2026-11-13T04:30:00.000Z');
  });
});
