import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LEAD_STATUSES } from '../leads/lead.constants';

export const TEAM_PERIODS = ['now', 'week', 'month'] as const;
export type TeamPeriod = (typeof TEAM_PERIODS)[number];

const OPEN_STATUSES = ['CONSULTING', 'NEW', 'CONFIRMED', 'VIEWED', 'DEPOSIT'] as const;
const IDLE_DAYS = 7;

export interface TeamOwnerStats {
  id: number | null;
  name: string;
  role: 'SALE' | 'MANAGER' | null;
  acceptingLeads: boolean | null;
  open: Record<(typeof OPEN_STATUSES)[number] | 'total', number>;
  overdue: number;
  idle: number;
  assigned: number;
  attended: number;
  signed: number;
  lost: number;
}

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

  // Trang Đội sale (quản lý): mỗi người phụ trách một dòng. "now" đếm khách đang mở và cờ cần chú ý;
  // "week"/"month" đếm kết quả trong kỳ theo người đang phụ trách. Mốc kỳ tính theo giờ Việt Nam.
  async getTeam(period: TeamPeriod) {
    const q = <T>(sql: string, params: unknown[] = []): Promise<T[]> => this.leadRepository.manager.query(sql, params);
    const TZ = `'Asia/Ho_Chi_Minh'`;
    const from =
      period === 'now'
        ? null
        : (
            await q<{ from: Date }>(
              `SELECT date_trunc('${period}', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ} AS "from"`,
            )
          )[0].from;
    const to = period === 'now' ? null : new Date();
    const open = OPEN_STATUSES.map((s) => `'${s}'`).join(',');

    const zero = (): Omit<TeamOwnerStats, 'id' | 'name' | 'role' | 'acceptingLeads'> => ({
      open: { CONSULTING: 0, NEW: 0, CONFIRMED: 0, VIEWED: 0, DEPOSIT: 0, total: 0 },
      overdue: 0,
      idle: 0,
      assigned: 0,
      attended: 0,
      signed: 0,
      lost: 0,
    });
    const rows = new Map<number | null, TeamOwnerStats>();
    const users = await q<{ id: number; name: string; role: 'SALE' | 'MANAGER'; accepting: boolean }>(
      `SELECT id, name, role, accepting_leads AS accepting FROM users ORDER BY name, id`,
    );
    for (const u of users) {
      rows.set(u.id, { id: u.id, name: u.name, role: u.role, acceptingLeads: u.accepting, ...zero() });
    }
    rows.set(null, { id: null, name: 'Chưa phân công', role: null, acceptingLeads: null, ...zero() });
    const row = (id: number | null) => rows.get(id) ?? rows.get(null)!;

    if (period === 'now') {
      const [byStatus, flags] = await Promise.all([
        q<{ owner: number | null; status: (typeof OPEN_STATUSES)[number]; n: string }>(
          `SELECT assigned_user_id AS owner, status, count(*)::text AS n FROM leads
            WHERE status IN (${open}) GROUP BY 1, 2`,
        ),
        q<{ owner: number | null; overdue: string; idle: string }>(
          `SELECT l.assigned_user_id AS owner,
                  count(*) FILTER (WHERE l.first_response_at IS NULL AND l.response_due_at <= now())::text AS overdue,
                  count(*) FILTER (WHERE GREATEST(l.assigned_at, COALESCE(e.last_event, l.assigned_at))
                                          < now() - interval '${IDLE_DAYS} days')::text AS idle
             FROM leads l
             LEFT JOIN LATERAL (SELECT max(created_at) AS last_event FROM lead_events WHERE lead_id = l.id) e ON true
            WHERE l.status IN (${open}) GROUP BY 1`,
        ),
      ]);
      for (const r of byStatus) {
        const o = row(r.owner);
        o.open[r.status] = Number(r.n);
        o.open.total += Number(r.n);
      }
      for (const r of flags) {
        const o = row(r.owner);
        o.overdue = Number(r.overdue);
        o.idle = Number(r.idle);
      }
    } else {
      const range = [from, to];
      const [assigned, attended, signed, lost] = await Promise.all([
        q<{ owner: number | null; n: string }>(
          `SELECT assigned_user_id AS owner, count(*)::text AS n FROM leads
            WHERE assigned_at >= $1 AND assigned_at < $2 GROUP BY 1`,
          range,
        ),
        q<{ owner: number | null; n: string }>(
          `SELECT l.assigned_user_id AS owner, count(DISTINCT l.id)::text AS n FROM viewings v
             JOIN leads l ON l.id = v.lead_id
            WHERE v.status = 'ATTENDED' AND v.viewing_time >= $1 AND v.viewing_time < $2 GROUP BY 1`,
          range,
        ),
        q<{ owner: number | null; n: string }>(
          `SELECT l.assigned_user_id AS owner, count(DISTINCT c.id)::text AS n FROM contracts c
             JOIN leads l ON l.id = c.lead_id
            WHERE c.status = 'SIGNED' AND c.signed_at >= $1 AND c.signed_at < $2 GROUP BY 1`,
          range,
        ),
        // Thời điểm mất khách lấy từ sự kiện đổi trạng thái "... -> LOST" gần nhất của khách đang ở trạng thái LOST
        q<{ owner: number | null; n: string }>(
          `SELECT l.assigned_user_id AS owner, count(*)::text AS n FROM leads l
             JOIN LATERAL (SELECT max(created_at) AS at FROM lead_events
                            WHERE lead_id = l.id AND type = 'STATUS_CHANGED' AND note LIKE '%-> LOST%') e ON true
            WHERE l.status = 'LOST' AND e.at >= $1 AND e.at < $2 GROUP BY 1`,
          range,
        ),
      ]);
      for (const r of assigned) row(r.owner).assigned = Number(r.n);
      for (const r of attended) row(r.owner).attended = Number(r.n);
      for (const r of signed) row(r.owner).signed = Number(r.n);
      for (const r of lost) row(r.owner).lost = Number(r.n);
    }

    // Mọi sale đều có dòng; quản lý và "Chưa phân công" chỉ hiện khi đang giữ khách hoặc có số trong kỳ
    const active = (o: TeamOwnerStats) =>
      o.open.total + o.assigned + o.attended + o.signed + o.lost > 0 || o.overdue + o.idle > 0;
    const owners = [...rows.values()].filter((o) => (o.role === 'SALE' ? true : active(o)));
    owners.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'vi'));

    const totals = zero();
    for (const o of owners) {
      for (const k of Object.keys(totals.open) as (keyof typeof totals.open)[]) totals.open[k] += o.open[k];
      totals.overdue += o.overdue;
      totals.idle += o.idle;
      totals.assigned += o.assigned;
      totals.attended += o.attended;
      totals.signed += o.signed;
      totals.lost += o.lost;
    }
    return {
      period,
      from,
      to,
      acceptingSales: owners.filter((o) => o.role === 'SALE' && o.acceptingLeads).length,
      totalSales: owners.filter((o) => o.role === 'SALE').length,
      owners,
      totals,
    };
  }
}

// Sale trước, rồi quản lý, cuối cùng là khách chưa có người phụ trách
function rank(o: TeamOwnerStats): number {
  return o.role === 'SALE' ? 0 : o.role === 'MANAGER' ? 1 : 2;
}
