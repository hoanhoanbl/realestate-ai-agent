import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  buildReportBreakdowns,
  type BreakdownInput,
} from './report-breakdowns';

@Injectable()
export class ReportBreakdownsService {
  constructor(private readonly db: DataSource) {}

  async get(periodStart: string, periodEnd: string) {
    const from = new Date(periodStart),
      to = new Date(periodEnd);
    if (
      !Number.isFinite(+from) ||
      !Number.isFinite(+to) ||
      from >= to ||
      +to - +from > 93 * 86400000
    ) {
      throw new BadRequestException(
        'Kỳ báo cáo phải tăng dần và không quá 93 ngày',
      );
    }
    // A consistent read snapshot; credentials/customer tokens never leave the backend.
    return this.db.transaction('REPEATABLE READ', async (em) => {
      const [{ now }] = await em.query<{ now: Date }[]>(
        'SELECT transaction_timestamp() AS now',
      );
      if (from > now || to > now)
        throw new BadRequestException(
          'Kỳ báo cáo không được nằm trong tương lai',
        );
      const users = await em.query<BreakdownInput['users']>(
        'SELECT id,name,role FROM users ORDER BY id',
      );
      const properties = await em.query<BreakdownInput['properties']>(
        'SELECT id,name,status FROM properties ORDER BY id',
      );
      const leads = await em.query<
        BreakdownInput['leads']
      >(`SELECT id,status,assigned_user_id AS "assignedUserId",
        assigned_at AS "assignedAt",response_due_at AS "responseDueAt",first_response_at AS "firstResponseAt" FROM leads`);
      const assignments = await em.query<BreakdownInput['assignments']>(
        `SELECT id,lead_id AS "leadId",type,note,created_at AS "createdAt"
        FROM lead_events WHERE type IN ('LEAD_ASSIGNED','LEAD_REASSIGNED') AND created_at<=$1 ORDER BY created_at,id`,
        [now],
      );
      const viewings = await em.query<
        BreakdownInput['viewings']
      >(`SELECT id,lead_id AS "leadId",property_id AS "propertyId",
        viewing_time AS "viewingTime",status FROM viewings`);
      const contracts = await em.query<BreakdownInput['contracts']>(
        `SELECT id,lead_id AS "leadId",property_id AS "propertyId",
        created_at AS "createdAt",signed_at AS "signedAt" FROM contracts WHERE
        (created_at >= $1 AND created_at < $2) OR (signed_at >= $1 AND signed_at < $2)`,
        [from, to],
      );
      const feedbacks = await em.query<BreakdownInput['feedbacks']>(
        `SELECT f.id,f.lead_id AS "leadId",f.submitted_at AS "submittedAt",
        f.rating,f.interest,f.comment,v.id AS "viewingId" FROM feedbacks f
        LEFT JOIN LATERAL (SELECT id FROM viewings WHERE lead_id=f.lead_id AND
          CASE WHEN f.token ~ '^v[0-9]+_' THEN split_part(f.token,'_',1)='v'||id::text
          ELSE id=(SELECT min(id) FROM viewings WHERE lead_id=f.lead_id) END LIMIT 1) v ON true
        WHERE f.submitted_at >= $1 AND f.submitted_at < $2`,
        [from, to],
      );
      return buildReportBreakdowns(
        {
          users,
          properties,
          leads,
          assignments,
          viewings,
          contracts,
          feedbacks,
        },
        from,
        to,
        now,
      );
    });
  }
}
