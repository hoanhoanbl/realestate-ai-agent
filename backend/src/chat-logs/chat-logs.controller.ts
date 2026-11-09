import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';
import { CreateChatLogDto } from './chat-log.dto';
import { ChatLogsService } from './chat-logs.service';

// Luồng 6 (n8n) ghi log mỗi lượt hỏi đáp của bot Telegram
@Controller('chat-logs')
@UseGuards(WebhookSecretGuard)
export class ChatLogsController {
  constructor(private readonly service: ChatLogsService) {}
  @Post() create(@Body() dto: CreateChatLogDto) { return this.service.create(dto); }
}
