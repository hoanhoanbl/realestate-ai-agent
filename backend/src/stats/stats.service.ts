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

    const bySource: { source: string; count: string }[] = await this.leadRepository.query(
      `SELECT COALESCE(NULLIF(trim(source),''),'direct') AS source,count(*)::text AS count FROM leads GROUP BY 1 ORDER BY 1`);
    const byAssignee: { assignedUserId: number | null; count: string }[] = await this.leadRepository.query(
      `SELECT assigned_user_id AS "assignedUserId",count(*)::text AS count FROM leads GROUP BY 1 ORDER BY 1 NULLS LAST`);
    const overdue: { count: string }[] = await this.leadRepository.query(
      `SELECT count(*)::text AS count FROM leads WHERE status IN ('CONSULTING','NEW','CONFIRMED','VIEWED') AND first_response_at IS NULL AND response_due_at<=now()`);

    return {
      total,
      hot,
      warm,
      cold,
      bySource: bySource.map(row => ({ source: row.source, count: Number(row.count) })),
      byAssignee: byAssignee.map(row => ({ assignedUserId: row.assignedUserId, count: Number(row.count) })),
      overdueResponses: Number(overdue[0]?.count ?? 0),
    };
  }

  // Các nhóm "Việc cần làm" trên trang Tổng quan, mỗi nhóm tối đa 20 khách
  async getTasks() {
    const q = (sql: string) => this.leadRepository.manager.query(sql);
    // Buổi xem gần nhất của mỗi khách (mỗi khách chỉ một dòng viewing)
    const lastViewing = `LEFT JOIN LATERAL (SELECT * FROM viewings WHERE lead_id = l.id ORDER BY id DESC LIMIT 1) v ON true
                         LEFT JOIN properties p ON p.id = v.property_id`;
    const cols = `l.id AS "leadId", l.name AS "leadName", l.phone AS "leadPhone", l.level AS "leadLevel",
                  l.status AS "leadStatus", v.viewing_time AS "viewingTime", p.name AS "propertyName"`;
    // Cảm nhận gần nhất khách đã gửi
    const lastFeedback = `JOIN LATERAL (SELECT * FROM feedbacks WHERE lead_id = l.id AND submitted_at IS NOT NULL
                                         ORDER BY id DESC LIMIT 1) f ON true`;

    const [pendingAttendance, wantsDeposit, notInterested, reservedBackups, customerRequests] = await Promise.all([
      q(`SELECT ${cols} FROM leads l ${lastViewing}
          WHERE l.status = 'CONFIRMED' AND v.status = 'NEW' AND v.viewing_time < now()
          ORDER BY v.viewing_time ASC LIMIT 20`),
      q(`SELECT ${cols}, f.rating, f.comment FROM leads l ${lastFeedback} ${lastViewing}
          WHERE f.interest = 'DEPOSIT' AND l.status = 'VIEWED'
          ORDER BY f.submitted_at DESC LIMIT 20`),
      q(`SELECT ${cols}, f.rating, f.comment FROM leads l ${lastFeedback} ${lastViewing}
          WHERE f.interest = 'NONE' AND l.status NOT IN ('LOST', 'SIGNED')
          ORDER BY f.submitted_at DESC LIMIT 20`),
      q(`SELECT ${cols} FROM leads l ${lastViewing}
          WHERE l.status IN ('NEW', 'CONFIRMED') AND v.status = 'NEW' AND p.status = 'RESERVED'
          ORDER BY v.viewing_time ASC LIMIT 20`),
      q(`SELECT ${cols}, e.note, e.created_at AS "requestedAt" FROM leads l
           JOIN LATERAL (SELECT * FROM lead_events WHERE lead_id = l.id AND type = 'CUSTOMER_RESCHEDULE_REQUESTED'
                          AND created_at > now() - interval '7 days' ORDER BY id DESC LIMIT 1) e ON true
           ${lastViewing}
          WHERE l.status IN ('NEW', 'CONFIRMED')
            -- nhân viên đã đổi giờ sau yêu cầu thì coi như đã xử lý
            AND NOT EXISTS (SELECT 1 FROM lead_events r WHERE r.lead_id = l.id AND r.type = 'VIEWING_RESCHEDULED'
                             AND r.created_at > e.created_at)
          ORDER BY e.created_at DESC LIMIT 20`),
    ]);

    return { pendingAttendance, wantsDeposit, notInterested, reservedBackups, customerRequests };
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
        WHERE l.status IN ('NEW', 'CONFIRMED') AND v.status = 'NEW'
          AND (v.viewing_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
              = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`,
    );

    // Đếm theo sự kiện để khách không đến rồi được hẹn lại vẫn được tính
    const noShow: { count: string }[] = await this.leadRepository.manager.query(
      `SELECT COUNT(DISTINCT lead_id) AS count FROM lead_events WHERE type = 'VIEWING_NO_SHOW'`,
    );

    return {
      total,
      byStatus,
      noShow: Number(noShow[0]?.count ?? 0),
      // tỉ lệ chốt = số khách đã ký / tổng số khách (%), làm tròn 1 chữ số
      conversionRate: total > 0 ? Math.round((byStatus.SIGNED / total) * 1000) / 10 : 0,
      pendingApproval,
      failedAutomation,
      viewingsToday: Number(today[0]?.count ?? 0),
    };
  }
}
