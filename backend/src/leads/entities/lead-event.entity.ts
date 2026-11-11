import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('lead_events')
export class LeadEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'lead_id' })
  leadId: number;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'actor_user_id', type: 'integer', nullable: true })
  actorUserId: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
