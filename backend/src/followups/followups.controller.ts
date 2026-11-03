import { Body, Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';
import { FollowupsService } from './followups.service';
import { ActionDoneDto, ClaimFollowupDto, FailFollowupDto, TaskTokenDto, ResolveFollowupDto } from './followup.dto';

@Controller('followups')
@UseGuards(WebhookSecretGuard)
export class FollowupsController {
  constructor(private readonly service: FollowupsService) {}
  @Post('claim') claim(@Body() dto: ClaimFollowupDto) { return this.service.claim(dto); }
  @Post(':id/start') start(@Param('id', ParseIntPipe) id: number, @Body() dto: TaskTokenDto) { return this.service.start(id, dto.token); }
  @Post(':id/action-done') done(@Param('id', ParseIntPipe) id: number, @Body() dto: ActionDoneDto) { return this.service.actionDone(id, dto); }
  @Post(':id/complete') complete(@Param('id', ParseIntPipe) id: number, @Body() dto: TaskTokenDto) { return this.service.complete(id, dto.token); }
  @Post(':id/fail') fail(@Param('id', ParseIntPipe) id: number, @Body() dto: FailFollowupDto) { return this.service.fail(id, dto); }
  @Post(':id/resolve') resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveFollowupDto) { return this.service.resolve(id, dto); }
}
