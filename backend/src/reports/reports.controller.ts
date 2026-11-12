import { Body, Controller, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WebhookSecretGuard } from '../auth/webhook-secret.guard';
import type { AuthUser } from '../auth/auth.types';
import { ReportBreakdownsService } from './report-breakdowns.service';
import { ReportBreakdownsDto } from './dto/report-breakdowns.dto';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly breakdowns: ReportBreakdownsService,
  ) {}

  // --- Cho n8n ---

  @Post('breakdowns')
  @UseGuards(WebhookSecretGuard)
  getBreakdowns(@Body() dto: ReportBreakdownsDto) {
    return this.breakdowns.get(dto.periodStart, dto.periodEnd);
  }

  @Post()
  @UseGuards(WebhookSecretGuard)
  create(@Body() dto: CreateReportDto) {
    return this.reportsService.create(dto);
  }

  // --- Chỉ quản lý ---

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  findAll() {
    return this.reportsService.findAll();
  }

  // phải khai báo trước ':id'
  @Post('run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  run(@Req() req: { user: AuthUser }) {
    return this.reportsService.requestNow(req.user.name);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reportsService.findOne(id);
  }
}
