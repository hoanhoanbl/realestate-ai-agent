import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AttendanceDto, RescheduleRequestDto, UpdateViewingDto } from './dto/update-viewing.dto';
import type { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ViewingsService } from './viewings.service';
import { CreateViewingDto } from './dto/create-viewing.dto';
import { Viewing } from './entities/viewing.entity';
import { Lead } from '../leads/entities/lead.entity';
import { BookingThrottlerGuard } from './booking-throttler.guard';

@Controller('viewings')
export class ViewingsController {
  constructor(private readonly viewingsService: ViewingsService) {}

  @Post()
  @UseGuards(BookingThrottlerGuard)
  create(
    @Body() createViewingDto: CreateViewingDto,
  ): Promise<{ viewing: Viewing; lead: Lead }> {
    return this.viewingsService.create(createViewingDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(): Promise<Viewing[]> {
    return this.viewingsService.findAll();
  }

  @Get('schedule')
  @UseGuards(JwtAuthGuard)
  findSchedule() {
    return this.viewingsService.findSchedule();
  }

  // --- Khách tự quản lý lịch qua link trong email (không đăng nhập) ---

  @Get('manage/:token')
  getManageInfo(@Param('token') token: string) {
    return this.viewingsService.getManageInfo(token);
  }

  @Post('manage/:token/cancel')
  customerCancel(@Param('token') token: string) {
    return this.viewingsService.customerCancel(token);
  }

  @Post('manage/:token/reschedule-request')
  customerRescheduleRequest(@Param('token') token: string, @Body() dto: RescheduleRequestDto) {
    return this.viewingsService.customerRescheduleRequest(token, dto.note);
  }

  // --- Nhân viên ---

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateViewingDto,
    @Req() req: { user: AuthUser },
  ): Promise<Viewing> {
    return this.viewingsService.update(id, dto, req.user);
  }

  @Put(':id/attendance')
  @UseGuards(JwtAuthGuard)
  recordAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AttendanceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.viewingsService.recordAttendance(id, dto, req.user);
  }
}
