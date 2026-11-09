import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Đường đi của một tin nhắn trong luồng 6 (bot Telegram tư vấn khách)
export const CHAT_ROUTES = ['COMMAND', 'BLOCKED', 'AGENT', 'STAFF', 'OUT_OF_SCOPE'] as const;
export type ChatRoute = typeof CHAT_ROUTES[number];

// Log từng lượt hỏi đáp của bot để giám sát và rà soát định kỳ.
// Email, số điện thoại trong nội dung được che trước khi lưu (xem maskPii).
@Entity('chat_logs')
export class ChatLog {
  @PrimaryGeneratedColumn() id: number;
  @Column({ length: 20, default: 'telegram' }) channel: string;
  @Index() @Column({ name: 'chat_id', length: 40 }) chatId: string;
  @Column({ length: 20 }) route: ChatRoute;
  @Column({ type: 'text' }) question: string;
  @Column({ type: 'text' }) reply: string;
  @Column({ name: 'used_fallback', default: false }) usedFallback: boolean;
  @Column({ default: false }) escalated: boolean;
  @Column({ name: 'staff_notified', default: false }) staffNotified: boolean;
  @Column({ name: 'execution_id', type: 'varchar', length: 40, nullable: true }) executionId: string | null;
  @Index() @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
