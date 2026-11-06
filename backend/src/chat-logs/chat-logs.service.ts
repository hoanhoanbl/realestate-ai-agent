import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class ChatLogsService {
  constructor(@InjectRepository(ChatLog) private readonly repo: Repository<ChatLog>) {}

  async create(dto: CreateChatLogDto): Promise<{ id: number }> {
    const saved = await this.repo.save(this.repo.create({
      channel: dto.channel || 'telegram',
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
}
