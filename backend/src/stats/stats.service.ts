import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LEAD_STATUSES } from '../leads/lead.constants';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
  ) {}

  async getStats() {
    const total = await this.leadRepository.count();

    const hot = await this.leadRepository.count({
      where: { level: 'HOT' },
    });

    const warm = await this.leadRepository.count({
      where: { level: 'WARM' },
    });

    const cold = await this.leadRepository.count({
      where: { level: 'COLD' },
    });

    return {
      total,
      hot,
      warm,
      cold,
    };
  }

  // Phễu bán hàng cho trang Tổng quan của admin
  async getFunnel() {
    const rows: { status: string; count: string }[] = await this.leadRepository
      .createQueryBuilder('l')
      .select('l.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('l.status')
      .getRawMany();

    const byStatus: Record<string, number> = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
    for (const r of rows) byStatus[r.status] = Number(r.count);
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const pendingApproval = await this.leadRepository.count({
      where: { status: 'NEW', automationStatus: 'COMPLETED' },
    });
    const failedAutomation = await this.leadRepository.count({
      where: { automationStatus: 'FAILED' },
    });
    const today: { count: string }[] = await this.leadRepository.manager.query(
      `SELECT COUNT(*) AS count
         FROM viewings v JOIN leads l ON l.id = v.lead_id
        WHERE l.status IN ('NEW', 'CONFIRMED')
          AND (v.viewing_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`,
    );

    return {
      total,
      byStatus,
      // tỉ lệ chốt = số khách đã ký / tổng số khách (%), làm tròn 1 chữ số
      conversionRate: total > 0 ? Math.round((byStatus.SIGNED / total) * 1000) / 10 : 0,
      pendingApproval,
      failedAutomation,
      viewingsToday: Number(today[0]?.count ?? 0),
    };
  }
}
