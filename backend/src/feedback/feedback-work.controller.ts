import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FeedbackWorkService } from './feedback-work.service';
import { FinishFeedbackAlertDto, RecordFeedbackWorkDto, ResolveFeedbackAlertDto, StartFeedbackAlertDto } from './feedback-work.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';
import type { AuthUser } from '../auth/auth.types';

@Controller('feedback-work')
export class FeedbackWorkController {
  constructor(private readonly service: FeedbackWorkService) {}
  @Get() @UseGuards(JwtAuthGuard)
  list(@Req() req: { user: AuthUser }, @Query('filter') filter?: string) { return this.service.list(req.user, filter); }
  @Get('lead/:leadId') @UseGuards(JwtAuthGuard)
  lead(@Req() req: { user: AuthUser }, @Param('leadId', ParseIntPipe) id: number) { return this.service.list(req.user, 'ALL', id); }
  @Post(':id/result') @UseGuards(JwtAuthGuard)
  record(@Req() req: { user: AuthUser }, @Param('id', ParseIntPipe) id: number, @Body() dto: RecordFeedbackWorkDto) { return this.service.record(id, dto, req.user); }
  @Get('context/:feedbackId') @UseGuards(WebhookSecretGuard)
  context(@Param('feedbackId', ParseIntPipe) id: number) { return this.service.context(id); }
  @Get('alerts/due') @UseGuards(WebhookSecretGuard)
  due() { return this.service.due(); }
  @Post('alerts/start') @UseGuards(WebhookSecretGuard)
  start(@Body() dto: StartFeedbackAlertDto) { return this.service.start(dto); }
  @Post('alerts/:id/finish') @UseGuards(WebhookSecretGuard)
  finish(@Param('id', ParseIntPipe) id: number, @Body() dto: FinishFeedbackAlertDto) { return this.service.finish(id, dto); }
  @Get('alerts/review') @UseGuards(JwtAuthGuard)
  review(@Req() req: { user: AuthUser }) { return this.service.review(req.user); }
  @Post('alerts/:id/resolve') @UseGuards(JwtAuthGuard)
  resolve(@Req() req: { user: AuthUser }, @Param('id', ParseIntPipe) id: number, @Body() dto: ResolveFeedbackAlertDto) { return this.service.resolve(id, dto, req.user); }
}
