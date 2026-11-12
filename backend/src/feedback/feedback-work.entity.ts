import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('feedback_work')
export class FeedbackWork {
  @PrimaryGeneratedColumn() id: number;
  @Index('uq_feedback_work_feedback', { unique: true }) @Column({ name: 'feedback_id' }) feedbackId: number;
  @Index('idx_feedback_work_lead') @Column({ name: 'lead_id' }) leadId: number;
  @Column({ name: 'viewing_id', type: 'integer', nullable: true }) viewingId: number | null;
  @Column({ default: 'PENDING', length: 20 }) status: string;
  @Column({ default: 1 }) version: number;
  @Column({ name: 'due_at', type: 'timestamptz' }) dueAt: Date;
  @Column({ name: 'escalate_at', type: 'timestamptz' }) escalateAt: Date;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

@Entity('feedback_work_history')
export class FeedbackWorkHistory {
  @PrimaryGeneratedColumn() id: number;
  @Index('idx_feedback_work_history_work') @Column({ name: 'work_id' }) workId: number;
  @Column({ name: 'actor_user_id' }) actorUserId: number;
  @Column({ name: 'actor_name' }) actorName: string;
  @Column({ length: 30 }) outcome: string;
  @Column({ type: 'text' }) note: string;
  @Column({ name: 'next_due_at', type: 'timestamptz', nullable: true }) nextDueAt: Date | null;
  @Column({ name: 'next_viewing_id', type: 'integer', nullable: true }) nextViewingId: number | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

// Delivery checkpoints are separate from the staff's business work status.
@Entity('feedback_work_alerts')
@Index('uq_feedback_work_alert', ['workId', 'version', 'kind', 'assigneeId'], { unique: true })
export class FeedbackWorkAlert {
  @PrimaryGeneratedColumn() id: number;
  @Column({ name: 'work_id' }) workId: number;
  @Column() version: number;
  @Column({ length: 20 }) kind: string;
  @Column({ name: 'assignee_id', default: 0 }) assigneeId: number;
  @Column({ length: 20 }) state: string;
  @Column({ length: 64, select: false }) token: string;
  @Column({ name: 'lease_until', type: 'timestamptz' }) leaseUntil: Date;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
