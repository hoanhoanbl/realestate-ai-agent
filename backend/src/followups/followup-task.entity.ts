import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const FOLLOWUP_TYPES = ['REMINDER', 'FEEDBACK', 'WARM_NUDGE', 'STAFF_NUDGE', 'ATTENDANCE_CHECK', 'ATTENDANCE_ESCALATE', 'HOT_NUDGE', 'COLD_NURTURE', 'EXPIRE_LEAD',
  // FE-43: bậc nhắc của luồng 9 và thư mời hẹn lại. Chưa có đường mã nào nhận các loại này (claim() vẫn chặn
  // viewingId = 0); FE-45 làm ladder, FE-46 làm REBOOK_INVITE.
  'LADDER_REACH', 'LADDER_QUIET', 'LADDER_STALE', 'LADDER_EMAIL', 'REBOOK_INVITE'] as const;
export type FollowupType = typeof FOLLOWUP_TYPES[number];
export const MAUTIC_FOLLOWUPS: FollowupType[] = ['WARM_NUDGE', 'COLD_NURTURE'];

export const SCHEDULED_FOLLOWUPS: FollowupType[] = ['REMINDER', 'FEEDBACK', 'ATTENDANCE_CHECK', 'ATTENDANCE_ESCALATE', 'EXPIRE_LEAD', 'STAFF_NUDGE'];
// Gợi ý của AI cho một bậc nhắc, lưu ở result.suggestion (design D5). emailDraft là null khi AI lỗi hoặc nháp bị guardrail bỏ.
export interface LadderSuggestion {
  action: 'CALL' | 'SEND_EMAIL' | 'OFFER_VIEWING' | 'WAIT';
  reason: string;
  emailDraft: string | null;
}
export interface FollowupResult { mauticContactId?: number; suggestion?: LadderSuggestion }
export type TaskState = 'CLAIMED' | 'ACTION_STARTED' | 'ACTION_DONE' | 'COMPLETED' | 'FAILED' | 'REVIEW';

@Entity('followup_tasks')
export class FollowupTask {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column({ name: 'task_key', length: 200 }) taskKey: string;
  @Column({ name: 'lead_id' }) leadId: number;
  @Column({ name: 'viewing_id' }) viewingId: number;
  @Column({ name: 'viewing_time', type: 'timestamptz' }) viewingTime: Date;
  @Column({ type: 'varchar', length: 30 }) type: FollowupType;
  @Column({ type: 'varchar', length: 30 }) state: TaskState;
  @Column({ length: 120 }) owner: string;
  @Column({ length: 64 }) token: string;
  @Column({ name: 'lease_until', type: 'timestamptz' }) leaseUntil: Date;
  @Column({ name: 'available_at', type: 'timestamptz' }) availableAt: Date;
  @Column({ type: 'jsonb', default: {} }) result: FollowupResult;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
