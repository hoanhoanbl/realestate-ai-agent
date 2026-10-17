import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeeklyReport } from './entities/weekly-report.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { N8nService } from '../n8n/n8n.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(WeeklyReport)
    private readonly reportRepository: Repository<WeeklyReport>,
    private readonly n8nService: N8nService,
  ) {}

  create(dto: CreateReportDto): Promise<WeeklyReport> {
    return this.reportRepository.save(this.reportRepository.create(dto));
  }

  // Danh sách gọn cho trang báo cáo: mỗi báo cáo kèm tiêu đề AI và số cảnh báo
  async findAll() {
    const reports = await this.reportRepository.find({ order: { id: 'DESC' }, take: 52 });
    return reports.map((r) => ({
      id: r.id,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      createdAt: r.createdAt,
      headline: (r.analysis as { headline?: string }).headline ?? null,
      alertCount: r.alerts.length,
    }));
  }

  async findOne(id: number): Promise<WeeklyReport> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException(`Report with id ${id} not found`);
    return report;
  }

  // Quản lý bấm "Tạo báo cáo ngay": nhờ n8n chạy luồng 4 ngoài lịch thứ Hai
  async requestNow(by: string): Promise<{ ok: true }> {
    try {
      await this.n8nService.callWebhook('report-requested', { by });
    } catch {
      throw new BadGatewayException('Không gọi được n8n để tạo báo cáo');
    }
    return { ok: true };
  }
}
