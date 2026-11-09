import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const FOLLOWUP_TYPES = ['REMINDER', 'FEEDBACK', 'WARM_NUDGE', 'STAFF_NUDGE', 'ATTENDANCE_CHECK', 'ATTENDANCE_ESCALATE', 'HOT_NUDGE', 'COLD_NURTURE', 'EXPIRE_LEAD'] as const;
export type FollowupType = typeof FOLLOWUP_TYPES[number];
export const MAUTIC_FOLLOWUPS: FollowupType[] = ['WARM_NUDGE', 'COLD_NURTURE'];

export const SCHEDULED_FOLLOWUPS: FollowupType[] = ['REMINDER', 'ATTENDANCE_CHECK', 'ATTENDANCE_ESCALATE', 'EXPIRE_LEAD'];
export type TaskState = 'CLAIMED' | 'ACTION_STARTED' | 'ACTION_DONE' | 'COMPLETED' | 'FAILED' | 'REVIEW';

@Entity('followup_tasks')
export class FollowupTask {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column({ name: 'task_key', length: 200 }) taskKey: string;
  @Column({ name: 'lead_id' }) leadId: number;
  @Column({ name: 'viewing_id' }) viewingId: number;
  @Column({ name: 'viewing_time', type: 'timestamptz' }) viewingTime: Date;
  @Column({ length: 30 }) type: FollowupType;
  @Column({ length: 30 }) state: TaskState;
  @Column({ length: 120 }) owner: string;
  @Column({ length: 64 }) token: string;
  @Column({ name: 'lease_until', type: 'timestamptz' }) leaseUntil: Date;
  @Column({ name: 'available_at', type: 'timestamptz' }) availableAt: Date;
  @Column({ type: 'jsonb', default: {} }) result: { mauticContactId?: number };
  @Column({ type: 'text', nullable: true }) error: string | null;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
