import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Cảm nhận của khách sau buổi xem nhà. Khách mở link có `token` để điền, không cần đăng nhập.
@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'lead_id' })
  leadId: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token: string;

  // 1 đến 5 sao; null cho tới khi khách gửi
  @Column({ type: 'integer', nullable: true })
  rating: number | null;

  // DEPOSIT = muốn đặt cọc, OTHER = muốn xem căn khác, NONE = không quan tâm nữa
  @Column({ type: 'varchar', length: 20, nullable: true })
  interest: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  // Kết quả AI phân tích (do n8n luồng 5 gọi về)
  @Column({ name: 'ai_sentiment', type: 'varchar', length: 20, nullable: true })
  aiSentiment: string | null;

  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary: string | null;

  @Column({ name: 'ai_next_action', type: 'text', nullable: true })
  aiNextAction: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
