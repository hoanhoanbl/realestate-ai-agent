import {
  LEAD_ACTIVITY_EVENT_TYPES,
  LEAD_EVENT_TYPES,
  LOST_REASONS,
  MANUAL_LOST_REASONS,
  buildViewingConfirmationNote,
  parseViewingConfirmationNote,
} from './lead.constants';
import { FOLLOWUP_TYPES } from '../followups/followup-task.entity';
import { LADDER_QUIET_DAYS, LADDER_REACH_DAYS, LADDER_STALE_DAYS } from '../followups/followup-policy';

describe('FE-43: hằng số nền của hành trình khách', () => {
  describe('lý do mất khách', () => {
    it('lý do chọn tay loại bốn lý do do hệ thống sở hữu', () => {
      for (const system of ['STALE', 'NO_SHOW', 'EXPIRED', 'CUSTOMER_CANCELLED']) {
        expect(LOST_REASONS).toContain(system);
        expect(MANUAL_LOST_REASONS).not.toContain(system);
      }
    });
    it('lý do chi tiết mới chọn tay được', () => {
      for (const reason of ['PRICE_TOO_HIGH', 'CHOSE_OTHER_PROPERTY', 'BOUGHT_ELSEWHERE', 'UNREACHABLE', 'NO_LONGER_NEEDED', 'NOT_INTERESTED', 'OTHER']) {
        expect(MANUAL_LOST_REASONS).toContain(reason);
      }
    });
    it('lý do chọn tay là tập con của mọi lý do và giữ nguyên các giá trị cũ', () => {
      for (const reason of MANUAL_LOST_REASONS) expect(LOST_REASONS).toContain(reason);
      for (const old of ['NO_SHOW', 'NOT_INTERESTED', 'CUSTOMER_CANCELLED', 'EXPIRED', 'OTHER']) expect(LOST_REASONS).toContain(old);
    });
  });

  describe('loại sự kiện và loại việc', () => {
    it('có đủ loại sự kiện mới của design D10, không trùng', () => {
      for (const type of ['CONTACTED', 'CONTACT_ATTEMPTED', 'LADDER_STEP_SENT', 'LADDER_APPROVED', 'LEAD_STALE_CLOSED',
        'REBOOK_INVITE_SENT', 'CONTRACT_PRICE_AGREED', 'CONTRACT_ARCHIVED', 'VIEWING_CONFIRMATION_SENT']) {
        expect(LEAD_EVENT_TYPES).toContain(type);
      }
      expect(new Set(LEAD_EVENT_TYPES).size).toBe(LEAD_EVENT_TYPES.length);
    });
    it('có đủ loại việc mới, kể cả LADDER_EMAIL', () => {
      for (const type of ['LADDER_REACH', 'LADDER_QUIET', 'LADDER_STALE', 'LADDER_EMAIL', 'REBOOK_INVITE']) {
        expect(FOLLOWUP_TYPES).toContain(type);
      }
      expect(new Set(FOLLOWUP_TYPES).size).toBe(FOLLOWUP_TYPES.length);
    });
    it('danh sách hoạt động chỉ chứa loại sự kiện có thật và không có sự kiện tự động', () => {
      for (const type of LEAD_ACTIVITY_EVENT_TYPES) expect(LEAD_EVENT_TYPES).toContain(type);
      expect(LEAD_ACTIVITY_EVENT_TYPES).not.toContain('VIEWING_CONFIRMATION_SENT');
      expect(LEAD_ACTIVITY_EVENT_TYPES).not.toContain('LADDER_STEP_SENT');
      expect(LEAD_ACTIVITY_EVENT_TYPES).toContain('FEEDBACK_WORK_UPDATED');
    });
  });

  describe('bậc nhắc', () => {
    it('ngày 1, 3, 7 cho bậc tiếp cận, 7 cho im lặng, 14 cho đóng STALE', () => {
      expect(LADDER_REACH_DAYS).toEqual([1, 3, 7]);
      expect(LADDER_QUIET_DAYS).toBe(7);
      expect(LADDER_STALE_DAYS).toBe(14);
    });
  });

  describe('ghi chú VIEWING_CONFIRMATION_SENT', () => {
    it('dựng đúng dạng viewing=<id>;time=<ISO UTC> như ví dụ ở design D10', () => {
      expect(buildViewingConfirmationNote(42, new Date('2026-11-20T03:00:00.000Z'))).toBe('viewing=42;time=2026-11-20T03:00:00.000Z');
    });
    it('giờ có múi giờ khác được đổi về UTC, có mili giây', () => {
      expect(buildViewingConfirmationNote(7, '2026-11-20T10:00:00+07:00')).toBe('viewing=7;time=2026-11-20T03:00:00.000Z');
    });
    it('dựng rồi đọc ra đúng mã buổi xem và giờ hẹn', () => {
      const time = new Date('2026-12-01T01:30:00.000Z');
      const parsed = parseViewingConfirmationNote(buildViewingConfirmationNote(99, time));
      expect(parsed?.viewingId).toBe(99);
      expect(parsed?.viewingTime.getTime()).toBe(time.getTime());
    });
    it('ghi chú sai dạng đọc ra null', () => {
      for (const note of [null, undefined, '', 'viewing=42', 'viewing=;time=2026-11-20T03:00:00.000Z', 'viewing=42;time=hôm qua',
        'viewing=0;time=2026-11-20T03:00:00.000Z', 'viewing=42;time=2026-11-20T03:00:00Z', 'viewing=42;time=2026-13-45T03:00:00.000Z',
        ' viewing=42;time=2026-11-20T03:00:00.000Z', 'viewing=42;time=2026-11-20T03:00:00.000Z;x=1']) {
        expect(parseViewingConfirmationNote(note)).toBeNull();
      }
    });
    it('không dựng được ghi chú từ mã hoặc giờ không hợp lệ', () => {
      expect(() => buildViewingConfirmationNote(0, new Date())).toThrow();
      expect(() => buildViewingConfirmationNote(1.5, new Date())).toThrow();
      expect(() => buildViewingConfirmationNote(1, 'không phải giờ')).toThrow();
    });
  });
});
