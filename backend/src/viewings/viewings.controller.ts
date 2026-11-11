import { Body, Controller, Get, Headers, Logger, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AttendanceDto, RescheduleRequestDto, UpdateViewingDto } from './dto/update-viewing.dto';
import type { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ViewingsService } from './viewings.service';
import { CreateViewingDto } from './dto/create-viewing.dto';
import { Viewing } from './entities/viewing.entity';
import { Lead } from '../leads/entities/lead.entity';
import { BookingThrottlerGuard } from './booking-throttler.guard';
import { ChatLogsService } from '../chat-logs/chat-logs.service';

@Controller('viewings')
export class ViewingsController {
  private readonly logger = new Logger(ViewingsController.name);

  constructor(
    private readonly viewingsService: ViewingsService,
    private readonly chatLogs: ChatLogsService,
  ) {}

  @Post()
  @UseGuards(BookingThrottlerGuard)
  async create(
    @Body() createViewingDto: CreateViewingDto,
    @Headers('x-webhook-secret') secret?: string,
  ): Promise<{ viewing: Viewing; lead: Lead }> {
    const { chatId, ...booking } = createViewingDto;
    const result = await this.viewingsService.create(booking);
    // Endpoint công khai: chỉ n8n (có secret) mới được gắn chat; khách ngoài gửi chatId thì bỏ qua
    const expected = process.env.WEBHOOK_SECRET;
    if (chatId && expected && secret === expected) {
      await this.chatLogs.linkChat(chatId, result.lead.id).catch((err: Error) =>
        this.logger.error(`Không gắn được chat vào lead ${result.lead.id}: ${err.message}`),
      );
    }
    return result;
  }

  // Công khai: danh sách khung giờ của một căn để form đặt lịch hiện khung đã kín
  @Get('slots')
  getSlots(@Query('propertyId', ParseIntPipe) propertyId: number) {
    return this.viewingsService.getSlots(propertyId);
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
