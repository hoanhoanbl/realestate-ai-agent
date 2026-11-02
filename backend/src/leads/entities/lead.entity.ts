import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column('bigint')
  budget: number;

  @Column({ type: 'text', nullable: true })
  needs: string | null;

  @Column({ type: 'integer', nullable: true })
  score: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  level: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'ai_reply', type: 'text', nullable: true })
  aiReply: string | null;

  @Column({ name: 'email_sent', type: 'boolean', nullable: true })
  emailSent: boolean | null;

  @Column({ name: 'staff_notified', type: 'boolean', nullable: true })
  staffNotified: boolean | null;

  @Column({ name: 'automation_status', type: 'varchar', length: 20, default: 'PENDING' })
  automationStatus: string;

  @Column({ name: 'automation_error', type: 'text', nullable: true })
  automationError: string | null;

  @Column({ name: 'event_id', type: 'varchar', length: 100, nullable: true })
  eventId: string | null;

  @Column({ type: 'varchar', length: 50, default: 'NEW' })
  status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string | null;

  @Column({ name: 'mautic_contact_id', type: 'integer', nullable: true })
  mauticContactId: number | null;

  @Column({ name: 'mautic_points', type: 'integer', default: 0 })
  mauticPoints: number;

  @Column({ name: 'consent_marketing', type: 'boolean', default: false })
  consentMarketing: boolean;

  @Column({ name: 'approval_url', type: 'text', nullable: true, select: false })
  approvalUrl: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;
}
