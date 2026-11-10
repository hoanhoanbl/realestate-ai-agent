import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'MANAGER' | 'SALE';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20 })
  role: UserRole;

  @Column({ name: 'push_token', type: 'text', nullable: true })
  pushToken: string | null;

  @Column({ name: 'telegram_chat_id', type: 'varchar', length: 40, nullable: true })
  telegramChatId: string | null;

  @Column({ name: 'accepting_leads', default: true })
  acceptingLeads: boolean;

  @Column({ name: 'last_assigned_at', type: 'timestamptz', nullable: true })
  lastAssignedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
