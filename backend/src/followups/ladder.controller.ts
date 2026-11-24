import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';
import { TaskTokenDto } from './followup.dto';
import { ConfirmLadderDto, SaveLadderSuggestionDto } from './ladder.dto';
import { LadderService } from './ladder.service';

@Controller('followups')
@UseGuards(WebhookSecretGuard)
export class LadderController {
  constructor(private readonly service: LadderService) {}
  @Get('ladder-due') due() { return this.service.due(); }
  @Get('ladder-email-due') emailDue() { return this.service.emailDue(); }
  @Post(':id/ladder-link') link(@Param('id',ParseIntPipe) id:number) { return this.service.link(id); }
  @Post(':id/ladder-context') context(@Param('id',ParseIntPipe) id:number,@Body() dto:TaskTokenDto) { return this.service.context(id,dto.token); }
  @Post(':id/ladder-suggestion') suggestion(@Param('id',ParseIntPipe) id:number,@Body() dto:SaveLadderSuggestionDto) { return this.service.suggestion(id,dto); }
}

// Kept outside the controller carrying the machine-secret guard: the HMAC link is its credential.
@Controller('followups/ladder-links')
export class LadderLinksController {
  constructor(private readonly service:LadderService) {}
  @Get(':token') @Header('Cache-Control','no-store') preview(@Param('token') token:string) { return this.service.preview(token); }
  @Post(':token/confirm') confirm(@Param('token') token:string,@Body() dto:ConfirmLadderDto) { return this.service.confirm(token,dto); }
}
