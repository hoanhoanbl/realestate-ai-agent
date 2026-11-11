import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';

// Cho n8n (header X-Webhook-Secret). Tách khỏi UsersController vì controller đó bắt đăng nhập JWT cho cả lớp.
@Controller('users')
export class UsersNotifyController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/notify-target')
  @UseGuards(WebhookSecretGuard)
  notifyTarget(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findNotifyTarget(id);
  }
}
