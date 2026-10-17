import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackAiResultDto, SubmitFeedbackDto } from './dto/feedback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';

@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // --- Công khai (khách mở link trong email) ---

  @Get(':token')
  getPublic(@Param('token') token: string) {
    return this.feedbackService.getPublic(token);
  }

  @Post(':token')
  submit(@Param('token') token: string, @Body() dto: SubmitFeedbackDto) {
    return this.feedbackService.submit(token, dto);
  }

  // --- Cho n8n ---

  @Post('link/:leadId')
  @UseGuards(WebhookSecretGuard)
  createLink(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.feedbackService.createLink(leadId);
  }

  @Put(':id/ai-result')
  @UseGuards(WebhookSecretGuard)
  saveAiResult(@Param('id', ParseIntPipe) id: number, @Body() dto: FeedbackAiResultDto) {
    return this.feedbackService.saveAiResult(id, dto);
  }

  // --- Cho admin ---

  @Get('lead/:leadId')
  @UseGuards(JwtAuthGuard)
  findByLead(@Param('leadId', ParseIntPipe) leadId: number) {
    return this.feedbackService.findByLead(leadId);
  }
}
