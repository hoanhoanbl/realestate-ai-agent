import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';
import { UpdateAutomationStatusDto } from './dto/update-automation-status.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { CreateLeadEventDto } from './dto/create-lead-event.dto';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
  ) {}

  private checkSecret(webhookSecret?: string): void {
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret || webhookSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  @Get()
  findAll(
    @Query('level') level?: string,
  ): Promise<Lead[]> {
    return this.leadsService.findAll(level);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.leadsService.findDetail(Number(id));
  }

  @Put(':id/ai-result')
  updateAiResult(
    @Param('id') id: string,
    @Body() data: UpdateAiResultDto,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ): Promise<Lead> {
    this.checkSecret(webhookSecret);
    return this.leadsService.updateAiResult(
      Number(id),
      data,
    );
  }

  @Put(':id/automation-status')
  updateAutomationStatus(
    @Param('id') id: string,
    @Body() data: UpdateAutomationStatusDto,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ): Promise<Lead> {
    this.checkSecret(webhookSecret);
    return this.leadsService.updateAutomationStatus(
      Number(id),
      data,
    );
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() data: UpdateLeadStatusDto,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ): Promise<Lead> {
    this.checkSecret(webhookSecret);
    return this.leadsService.updateStatus(Number(id), data);
  }

  @Post(':id/events')
  addEvent(
    @Param('id') id: string,
    @Body() data: CreateLeadEventDto,
    @Headers('x-webhook-secret') webhookSecret?: string,
  ): Promise<LeadEvent> {
    this.checkSecret(webhookSecret);
    return this.leadsService.addEvent(Number(id), data);
  }

  @Get(':id/events')
  findEvents(
    @Param('id') id: string,
  ): Promise<LeadEvent[]> {
    return this.leadsService.findEvents(Number(id));
  }
}