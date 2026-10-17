import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Báo cáo kinh doanh hằng tuần do n8n (luồng 4) tạo
@Entity('weekly_reports')
export class WeeklyReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  // Số liệu tuần này, tuần trước, phễu chuyển đổi
  @Column({ type: 'jsonb' })
  metrics: Record<string, unknown>;

  // Phân tích của AI Agent: { headline, insights[], recommendations[], aiUsed }
  @Column({ type: 'jsonb' })
  analysis: Record<string, unknown>;

  // Các cảnh báo bất thường phát hiện bằng quy tắc cố định
  @Column({ type: 'jsonb' })
  alerts: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
