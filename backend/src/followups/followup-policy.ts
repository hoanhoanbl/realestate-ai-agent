import type { FollowupType } from './followup-task.entity';

export interface FollowupSnapshot {
  status: string; level: string | null; consent_marketing: boolean;
  created_at: string | Date; viewing_time: string | Date;
  reminder_sent: boolean; feedback_asked: boolean; feedback_asked_at: string | Date | null;
  has_feedback: boolean; nurture_started: boolean; staff_nudged: boolean; cooling_down: boolean;
}
export function isFollowupDue(s: FollowupSnapshot, type: FollowupType, now: Date): boolean {
  const elapsed = now.getTime() - new Date(s.viewing_time).getTime();
  const hour = 3_600_000;
  if (!Number.isFinite(elapsed) || s.cooling_down) return false;
  switch (type) {
    case 'REMINDER': return s.status === 'CONFIRMED' && elapsed <= 0 && elapsed >= -24 * hour && !s.reminder_sent;
    case 'FEEDBACK': return !s.feedback_asked && !s.has_feedback &&
      ((s.status === 'VIEWED' && elapsed > 2 * hour) || (s.status === 'CONFIRMED' && elapsed > 24 * hour));
    case 'WARM_NUDGE': return s.status === 'VIEWED' && s.level === 'WARM' && s.consent_marketing &&
      !s.has_feedback && !s.nurture_started && s.feedback_asked_at !== null &&
      now.getTime() - new Date(s.feedback_asked_at).getTime() > 72 * hour;
    case 'STAFF_NUDGE': return s.status === 'NEW' && ['HOT', 'WARM'].includes(s.level ?? '') &&
      now.getTime() - new Date(s.created_at).getTime() > 72 * hour && !s.staff_nudged;
  }
}
