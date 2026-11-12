import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StatsService, TEAM_PERIODS, TeamPeriod } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getStats() {
    return this.statsService.getStats();
  }

  @Get('tasks')
  @UseGuards(JwtAuthGuard)
  getTasks() {
    return this.statsService.getTasks();
  }

  @Get('funnel')
  @UseGuards(JwtAuthGuard)
  getFunnel() {
    return this.statsService.getFunnel();
  }

  // Trang Đội sale: khách đang giữ và kết quả theo kỳ của từng người phụ trách (chỉ quản lý)
  @Get('team')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  getTeam(@Query('period') period: string = 'now') {
    if (!TEAM_PERIODS.includes(period as TeamPeriod)) {
      throw new BadRequestException(`period phải là một trong: ${TEAM_PERIODS.join(', ')}`);
    }
    return this.statsService.getTeam(period as TeamPeriod);
  }
}
