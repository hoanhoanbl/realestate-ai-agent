import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyReport } from './entities/weekly-report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportBreakdownsService } from './report-breakdowns.service';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklyReport])],
  controllers: [ReportsController],
  providers: [ReportsService, ReportBreakdownsService],
})
export class ReportsModule {}
