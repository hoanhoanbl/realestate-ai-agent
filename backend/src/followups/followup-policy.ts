import type { FollowupType } from './followup-task.entity';

export interface FollowupSnapshot {
  status: string; level: string | null; consent_marketing: boolean;
  created_at: string | Date; viewing_time: string | Date; viewing_status: string;
  reminder_sent: boolean; feedback_asked: boolean; feedback_asked_at: string | Date | null;
  has_feedback: boolean; nurture_started: boolean; staff_nudged: boolean; cooling_down: boolean;
  attendance_check_sent: boolean; attendance_check_at: string | Date | null; attendance_escalated: boolean;
  hot_nudged?: boolean; cold_nurture_started?: boolean;
  lost_reason?: string | null; expired_for_schedule?: boolean;
  email?: string | null;
  assigned_at?: string | Date | null; response_due_at?: string | Date | null; first_response_at?: string | Date | null;
}
export function isFollowupDue(s: FollowupSnapshot, type: FollowupType, now: Date): boolean {
  if (type === 'STAFF_NUDGE') return !s.cooling_down && ['CONSULTING','NEW','CONFIRMED','VIEWED'].includes(s.status) &&
    !!s.assigned_at && !!s.response_due_at && !s.first_response_at && !s.staff_nudged &&
    new Date(s.response_due_at).getTime() <= now.getTime();
  const elapsed = now.getTime() - new Date(s.viewing_time).getTime();
  if (['REMINDER','FEEDBACK','WARM_NUDGE','COLD_NURTURE'].includes(type) && !s.email) return false;
  const hour = 3_600_000;
  if (!s.viewing_time || !Number.isFinite(elapsed) || s.cooling_down) return false;
  const silent = s.status === 'VIEWED' && s.viewing_status === 'ATTENDED' && s.consent_marketing &&
    !s.has_feedback && s.feedback_asked_at !== null &&
    now.getTime() - new Date(s.feedback_asked_at).getTime() > 72 * hour;
  switch (type) {
    case 'REMINDER': return s.status === 'CONFIRMED' && s.viewing_status === 'NEW' && elapsed <= 0 && elapsed >= -24 * hour && !s.reminder_sent;
    case 'FEEDBACK': return !s.feedback_asked && !s.has_feedback &&
      s.status === 'VIEWED' && s.viewing_status === 'ATTENDED' && elapsed > 2 * hour;
    case 'WARM_NUDGE': return silent && s.level === 'WARM' && !s.nurture_started;
    case 'HOT_NUDGE': return silent && s.level === 'HOT' && !s.hot_nudged;
    case 'COLD_NURTURE': return silent && s.level === 'COLD' && !s.cold_nurture_started;
    case 'EXPIRE_LEAD': return elapsed > 0 && (
      (s.status === 'NEW' && s.viewing_status === 'NEW') ||
      // Đã đóng bởi chính tác vụ của giờ hẹn này: chỉ còn thông báo quản lý.
      (s.status === 'LOST' && s.lost_reason === 'EXPIRED' && s.viewing_status === 'CANCELLED' && s.expired_for_schedule === true));
    case 'ATTENDANCE_CHECK': return s.status === 'CONFIRMED' && s.viewing_status === 'NEW' &&
      elapsed > 2 * hour && !s.attendance_check_sent;
    case 'ATTENDANCE_ESCALATE': return s.status === 'CONFIRMED' && s.viewing_status === 'NEW' &&
      !s.attendance_escalated && s.attendance_check_at !== null &&
      now.getTime() - new Date(s.attendance_check_at).getTime() > 24 * hour;
  }
}
