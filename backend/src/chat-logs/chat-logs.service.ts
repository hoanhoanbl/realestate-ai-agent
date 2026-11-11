import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ChatLog } from './chat-log.entity';
import { CreateChatLogDto } from './chat-log.dto';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Dãy số bắt đầu bằng 0 hoặc +84, dài 9-12 chữ số (cho phép dấu cách, chấm, gạch):
// số điện thoại, CCCD. Giá tiền (3000000000) không bắt đầu bằng 0 nên được giữ.
const LONG_NUMBER = /(?<!\d)(?:\+84|0)(?:[\s.-]?\d){8,11}(?!\d)/g;

// Che email và dãy số dài trước khi lưu log (Nghị định 13: không giữ dữ liệu cá nhân khi không cần)
export function maskPii(text: string): string {
  return String(text ?? '')
    .replace(EMAIL, '[email]')
    .replace(LONG_NUMBER, '[số]');
}

export const CHAT_HISTORY_LIMIT = 200;

export interface LeadChatLogView {
  id: number;
  createdAt: Date;
  route: string;
  question: string;
  reply: string;
  escalated: boolean;
}

@Injectable()
export class ChatLogsService {
  constructor(@InjectRepository(ChatLog) private readonly repo: Repository<ChatLog>) {}

  async create(dto: CreateChatLogDto): Promise<{ id: number }> {
    const channel = dto.channel || 'telegram';
    // Lượt sau của cuộc chat đã gắn lead thì tự theo lead đó (lượt gắn gần nhất thắng)
    const linked = await this.repo.findOne({
      where: { channel, chatId: dto.chatId, leadId: Not(IsNull()) },
      order: { id: 'DESC' },
      select: { id: true, leadId: true },
    });
    const saved = await this.repo.save(this.repo.create({
      leadId: linked?.leadId ?? null,
      channel,
      chatId: dto.chatId,
      route: dto.route,
      question: maskPii(dto.question),
      reply: maskPii(dto.reply),
      usedFallback: dto.usedFallback ?? false,
      escalated: dto.escalated ?? false,
      staffNotified: dto.staffNotified ?? false,
      executionId: dto.executionId ?? null,
    }));
    return { id: saved.id };
  }

  // Gắn các log chưa có lead của cuộc chat này vào lead; log đã thuộc lead khác giữ nguyên.
  async linkChat(chatId: string, leadId: number, channel = 'telegram'): Promise<number> {
    const result = await this.repo.update(
      { channel, chatId, leadId: IsNull() },
      { leadId },
    );
    return result.affected ?? 0;
  }

  // Cho trang chi tiết lead: cũ trước, không trả chatId và executionId
  async findByLead(leadId: number): Promise<LeadChatLogView[]> {
    const rows = await this.repo.find({
      where: { leadId },
      order: { id: 'DESC' },
      take: CHAT_HISTORY_LIMIT,
    });
    return rows.reverse().map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      route: r.route,
      question: r.question,
      reply: r.reply,
      escalated: r.escalated,
    }));
  }
}
