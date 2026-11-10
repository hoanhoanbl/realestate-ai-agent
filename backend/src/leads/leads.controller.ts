import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadIntakeService } from './lead-intake.service';
import { AssignLeadDto, CreateLeadDto, LeadNoteDto } from './dto/create-lead.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';
import { UpdateAutomationStatusDto } from './dto/update-automation-status.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { CreateLeadEventDto } from './dto/create-lead-event.dto';
import { AdminStatusDto } from './dto/admin-status.dto';
import { UpdateMauticDto } from './dto/update-mautic.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService, private readonly intake: LeadIntakeService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateLeadDto, @Req() req: { user: AuthUser }) {
    return this.intake.create(dto, req.user);
  }

  @Post('intake')
  @UseGuards(WebhookSecretGuard)
  receive(@Body() dto: CreateLeadDto) {
    return this.intake.create(dto);
  }

  // Đặt trước :id để không bị ParseIntPipe coi "lookup" là id.
  @Get('lookup')
  @UseGuards(JwtAuthGuard)
  async lookup(@Query('phone') phone: string) {
    return { lead: await this.intake.lookup(phone) };
  }

  @Put(':id/assignee')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  reassign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignLeadDto, @Req() req: { user: AuthUser }) {
    return this.intake.reassign(id, dto, req.user);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard)
  note(@Param('id', ParseIntPipe) id: number, @Body() dto: LeadNoteDto, @Req() req: { user: AuthUser }) {
    return this.intake.addNote(id, dto.note, req.user);
  }

  // --- Cho người dùng đăng nhập (web admin, app) ---

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('level') level?: string): Promise<Lead[]> {
    return this.leadsService.findAll(level);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leadsService.findDetail(id);
  }

  @Get(':id/events')
  @UseGuards(JwtAuthGuard)
  findEvents(@Param('id', ParseIntPipe) id: number): Promise<LeadEvent[]> {
    return this.leadsService.findEvents(id);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard)
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: { user: AuthUser }) {
    return this.leadsService.approve(id, req.user);
  }

  @Put(':id/admin-status')
  @UseGuards(JwtAuthGuard)
  adminStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: AdminStatusDto,
    @Req() req: { user: AuthUser },
  ): Promise<Lead> {
    return this.leadsService.adminSetStatus(id, data, req.user);
  }

  // --- Cho n8n (header X-Webhook-Secret) ---

  @Put(':id/ai-result')
  @UseGuards(WebhookSecretGuard)
  updateAiResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateAiResultDto,
  ): Promise<Lead> {
    return this.leadsService.updateAiResult(id, data);
  }

  @Put(':id/automation-status')
  @UseGuards(WebhookSecretGuard)
  updateAutomationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateAutomationStatusDto,
  ): Promise<Lead> {
    return this.leadsService.updateAutomationStatus(id, data);
  }

  @Put(':id/status')
  @UseGuards(WebhookSecretGuard)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateLeadStatusDto,
  ): Promise<Lead> {
    return this.leadsService.updateStatus(id, data);
  }

  @Get('by-mautic/:contactId')
  @UseGuards(WebhookSecretGuard)
  findByMautic(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Query('email') email?: string,
  ): Promise<Lead | null> {
    return this.leadsService.findByMauticId(contactId, email);
  }

  @Put(':id/mautic')
  @UseGuards(WebhookSecretGuard)
  updateMautic(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateMauticDto,
  ): Promise<Lead> {
    return this.leadsService.updateMautic(id, data);
  }

  @Post(':id/events')
  @UseGuards(WebhookSecretGuard)
  addEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: CreateLeadEventDto,
  ): Promise<LeadEvent> {
    return this.leadsService.addEvent(id, data);
  }
}
