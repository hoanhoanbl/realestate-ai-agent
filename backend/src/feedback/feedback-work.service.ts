import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomBytes } from 'crypto';
import { FeedbackWork, FeedbackWorkAlert, FeedbackWorkHistory } from './feedback-work.entity';
import { FinishFeedbackAlertDto, RecordFeedbackWorkDto, ResolveFeedbackAlertDto, StartFeedbackAlertDto } from './feedback-work.dto';
import { workDecision } from './feedback-work.rules';
import { Feedback } from './entities/feedback.entity';
import { feedbackViewing } from './feedback-scope';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Contract, ACTIVE_CONTRACT_STATUSES } from '../contracts/entities/contract.entity';
import { User } from '../users/entities/user.entity';
import { addWorkingHours } from '../leads/intake-rules';
import { assertNotLosingDeposit, LeadsService } from '../leads/leads.service';
import { assertNoBookingConflict, lockProperty } from '../viewings/booking-rules';
import { assertStaffTime } from '../viewings/viewing-time';
import { N8nService } from '../n8n/n8n.service';
import type { AuthUser } from '../auth/auth.types';
import { closeFeedbackWork } from './feedback-work.lifecycle';

@Injectable()
export class FeedbackWorkService {
  constructor(private readonly db: DataSource, private readonly n8n: N8nService, private readonly leads: LeadsService) {}

  // Called in the same transaction as feedback submission, under the lead lock.
  async create(m: EntityManager, feedback: Feedback) {
    const repo = m.getRepository(FeedbackWork);
    const existing = await repo.findOneBy({ feedbackId: feedback.id });
    if (existing) return existing;
    const viewing = await feedbackViewing(m, feedback);
    const dueAt = addWorkingHours(feedback.submittedAt!, 2);
    const work = await repo.save(repo.create({ feedbackId: feedback.id, leadId: feedback.leadId,
      viewingId: viewing?.id ?? null, dueAt, escalateAt: addWorkingHours(dueAt, 2), completedAt: null }));
    await m.getRepository(LeadEvent).save({ leadId: feedback.leadId, type: 'FEEDBACK_WORK_CREATED', note: `Việc #${work.id}, phản hồi #${feedback.id}` });
    const lead = await m.getRepository(Lead).findOneByOrFail({ id: feedback.leadId });
    if (['LOST', 'SIGNED'].includes(lead.status)) await closeFeedbackWork(m, lead.id, 'Phản hồi đến sau khi khách đã đóng hoặc đã ký');
    return work;
  }

  private authorize(lead: Lead, user: AuthUser) {
    if (user.role !== 'MANAGER' && (user.role !== 'SALE' || lead.assignedUserId !== user.id))
      throw new ForbiddenException('Chỉ sale đang phụ trách hoặc quản lý được xử lý');
  }

  async list(user: AuthUser, filter = 'OPEN', leadId?: number) {
    if (!['OPEN', 'PENDING', 'IN_PROGRESS', 'TODAY', 'OVERDUE', 'COMPLETED', 'ALL'].includes(filter))
      throw new BadRequestException('Bộ lọc không hợp lệ');
    if (!['MANAGER', 'SALE'].includes(user.role)) throw new ForbiddenException();
    if (leadId !== undefined) {
      const lead = await this.db.getRepository(Lead).findOneBy({ id: leadId });
      if (!lead) throw new NotFoundException('Không có khách');
      this.authorize(lead, user);
    }
    const q = this.db.getRepository(FeedbackWork).createQueryBuilder('w')
      .innerJoin(Lead, 'l', 'l.id=w.lead_id').innerJoin(Feedback, 'f', 'f.id=w.feedback_id')
      .leftJoin(Viewing, 'v', 'v.id=w.viewing_id').leftJoin(Property, 'p', 'p.id=v.property_id')
      .leftJoin(User, 'u', 'u.id=l.assigned_user_id')
      .select(['w.id AS id', 'w.feedback_id AS "feedbackId"', 'w.lead_id AS "leadId"', 'w.viewing_id AS "viewingId"',
        'w.status AS status', 'w.version AS version', 'w.due_at AS "dueAt"', 'w.completed_at AS "completedAt"',
        'l.name AS "leadName"', 'l.status AS "leadStatus"', 'l.assigned_user_id AS "assignedUserId"', 'u.name AS "assignedUserName"',
        'p.name AS "propertyName"', 'v.viewing_time AS "viewingTime"', 'f.rating AS rating', 'f.interest AS interest',
        'f.comment AS comment', 'f.ai_summary AS "aiSummary"', 'f.submitted_at AS "submittedAt"',
        "(w.status <> 'COMPLETED' AND l.status NOT IN ('LOST','SIGNED') AND w.due_at <= now()) AS overdue"]);
    if (user.role !== 'MANAGER') q.andWhere('l.assigned_user_id=:owner', { owner: user.id });
    if (leadId !== undefined) q.andWhere('w.lead_id=:leadId', { leadId });
    if (['OPEN', 'TODAY', 'OVERDUE'].includes(filter)) q.andWhere("w.status <> 'COMPLETED' AND l.status NOT IN ('LOST','SIGNED')");
    if (['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(filter)) q.andWhere('w.status=:status', { status: filter });
    if (filter === 'TODAY') q.andWhere("(w.due_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date");
    if (filter === 'OVERDUE') q.andWhere('w.due_at <= now()');
    const rows: { id: number }[] = await q.orderBy('w.due_at', 'ASC').addOrderBy('w.id', 'ASC').limit(200).getRawMany();
    if (!rows.length) return [];
    const history = await this.db.getRepository(FeedbackWorkHistory).createQueryBuilder('h')
      .where('h.work_id IN (:...ids)', { ids: rows.map(r => r.id) }).orderBy('h.id', 'DESC').getMany();
    return rows.map(r => ({ ...r, history: history.filter(h => h.workId === r.id) }));
  }

  async record(id: number, dto: RecordFeedbackWorkDto, user: AuthUser) {
    const decision = workDecision(dto, new Date());
    const result = await this.db.transaction(async m => {
      const initial = await m.getRepository(FeedbackWork).findOneBy({ id });
      if (!initial) throw new NotFoundException('Không có công việc');
      // Match booking/contract lock ordering: property before lead, then work.
      if (dto.outcome === 'NEXT_VIEWING') await lockProperty(m, dto.propertyId!);
      const lead = await m.getRepository(Lead).findOne({ where: { id: initial.leadId }, lock: { mode: 'pessimistic_write' } });
      if (!lead) throw new NotFoundException('Không có khách');
      this.authorize(lead, user);
      const repo = m.getRepository(FeedbackWork);
      const work = await repo.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (work.version !== dto.version || work.status === 'COMPLETED') throw new ConflictException('Việc đã thay đổi; tải lại trước khi ghi kết quả');
      if (['SIGNED', 'LOST'].includes(lead.status)) throw new ConflictException('Khách đã đóng hoặc đã ký');
      let nextViewing: Viewing | null = null;
      const oldStatus = lead.status;
      if (['NOT_BUYING', 'NEXT_VIEWING'].includes(dto.outcome)) {
        assertNotLosingDeposit(lead.status, 'LOST');
        const contracts = await m.getRepository(Contract).createQueryBuilder('c').where('c.lead_id=:id', { id: lead.id })
          .andWhere('c.status IN (:...states)', { states: ACTIVE_CONTRACT_STATUSES }).getCount();
        if (contracts) throw new ConflictException('Cần xử lý hợp đồng còn hiệu lực trước');
      }
      if (dto.outcome === 'NEXT_VIEWING') {
        const time = new Date(dto.viewingTime!);
        assertStaffTime(time);
        const property = await m.getRepository(Property).findOneBy({ id: dto.propertyId! });
        if (!property || property.status !== 'AVAILABLE') throw new ConflictException('Căn nhà hiện không nhận lịch xem');
        if (await m.getRepository(Viewing).existsBy({ leadId: lead.id, status: 'NEW' }))
          throw new ConflictException('Khách đã có lịch đang chờ, hãy xử lý lịch đó trước');
        await assertNoBookingConflict(m, property.id, time);
        nextViewing = await m.getRepository(Viewing).save(m.create(Viewing, { leadId: lead.id, propertyId: property.id,
          viewingTime: time, status: 'NEW', manageToken: randomBytes(16).toString('hex') }));
        lead.status = 'NEW'; lead.approvalUrl = null; lead.automationStatus = 'PENDING'; lead.automationError = null;
        lead.interestedPropertyIds = [...new Set([...(lead.interestedPropertyIds ?? []), property.id])];
        await m.getRepository(Lead).save(lead);
      }
      if (dto.outcome === 'NOT_BUYING') {
        await m.getRepository(Viewing).update({ leadId: lead.id, status: 'NEW' }, { status: 'CANCELLED' });
        lead.status = 'LOST'; lead.lostReason = 'NOT_INTERESTED'; lead.approvalUrl = null;
        await m.getRepository(Lead).save(lead);
      }
      if (lead.status !== oldStatus) await m.getRepository(LeadEvent).save({ leadId: lead.id, type: 'STATUS_CHANGED',
        actorUserId: user.id, note: `${oldStatus} -> ${lead.status}: Theo dõi phản hồi #${work.feedbackId} (bởi ${user.name})` });
      work.status = decision.completes ? 'COMPLETED' : 'IN_PROGRESS';
      work.completedAt = decision.completes ? new Date() : null;
      work.version++;
      if (decision.due) { work.dueAt = decision.due; work.escalateAt = addWorkingHours(decision.due, 2); }
      await repo.save(work);
      await m.getRepository(FeedbackWorkHistory).save({ workId: id, actorUserId: user.id, actorName: user.name,
        outcome: dto.outcome, note: dto.note.trim(), nextDueAt: decision.due, nextViewingId: nextViewing?.id ?? null });
      await m.getRepository(LeadEvent).save({ leadId: lead.id, type: 'FEEDBACK_WORK_UPDATED', actorUserId: user.id,
        note: `Việc #${id}: ${dto.outcome}: ${dto.note.trim()}` });
      if (lead.status === 'LOST') await this.closeForLead(m, lead.id, 'Khách không mua');
      return { work, lead, nextViewing, changed: lead.status !== oldStatus };
    });
    if (result.changed) await this.leads.notifyFollowupStatusChanged(result.lead.id).catch(() => undefined);
    if (result.nextViewing) {
      const v = result.nextViewing, l = result.lead;
      await this.n8n.callWebhook('viewing-requested', { event: 'viewing_requested', eventId: `feedback-work-${id}-viewing-${v.id}`,
        leadId: l.id, name: l.name, email: l.email, phone: l.phone, budget: Number(l.budget), needs: l.needs ?? '', source: l.source,
        propertyId: v.propertyId, viewingId: v.id, viewingTime: v.viewingTime.toISOString(), manageToken: v.manageToken,
        assignedUserId: l.assignedUserId }).catch(async () => {
          await this.db.getRepository(Lead).update({ id: l.id, status: 'NEW' }, { automationStatus: 'FAILED', automationError: 'Đã tạo lịch, chưa gọi được n8n. Duyệt lịch từ trang quản trị.' });
        });
    }
    return result.work;
  }

  async closeForLead(m: EntityManager, leadId: number, reason: string) {
    await closeFeedbackWork(m, leadId, reason);
  }

  async context(feedbackId: number) {
    const f = await this.db.getRepository(Feedback).findOneBy({ id: feedbackId });
    if (!f?.submittedAt) throw new NotFoundException('Chưa có phản hồi');
    const l = await this.db.getRepository(Lead).findOneByOrFail({ id: f.leadId });
    const v = await feedbackViewing(this.db.manager, f);
    const p = v ? await this.db.getRepository(Property).findOneBy({ id: v.propertyId }) : null;
    return { feedback_id: f.id, lead_id: l.id, name: l.name, email: l.email, phone: l.phone, level: l.level, status: l.status,
      rating: f.rating, interest: f.interest, comment: f.comment, property_name: p?.name ?? null, property_address: p?.address ?? null };
  }

  private kindDue(w: FeedbackWork, kind: string, now: Date) {
    return w.status !== 'COMPLETED' && (kind === 'NEW' ? w.version === 1 && w.dueAt > now
      : kind === 'REMIND' ? w.dueAt <= now && w.escalateAt > now : kind === 'ESCALATE' && w.escalateAt <= now);
  }

  async due(leadId?: number) {
    // Close terminal clients before scanning. No customer messages are sent here.
    await this.db.transaction(async m => {
      const closed: { id: number }[] = await m.query("SELECT l.id FROM leads l WHERE l.status IN ('LOST','SIGNED') AND EXISTS (SELECT 1 FROM feedback_work w WHERE w.lead_id=l.id AND w.status<>'COMPLETED') ORDER BY l.id FOR UPDATE OF l");
      for (const l of closed) await this.closeForLead(m, l.id, 'Khách đã đóng hoặc đã ký');
    });
    return this.db.query(`SELECT w.id AS "workId", w.version, COALESCE(l.assigned_user_id,0) AS "assigneeId",
      CASE WHEN w.escalate_at<=now() THEN 'ESCALATE' WHEN w.due_at<=now() THEN 'REMIND' ELSE 'NEW' END AS kind
      FROM feedback_work w JOIN leads l ON l.id=w.lead_id
      WHERE w.status<>'COMPLETED' AND l.status NOT IN ('LOST','SIGNED') AND ($1::int IS NULL OR l.id=$1)
      AND (w.version=1 OR w.due_at<=now()) AND NOT EXISTS (SELECT 1 FROM feedback_work_alerts a WHERE a.work_id=w.id
        AND a.version=w.version AND a.assignee_id=COALESCE(l.assigned_user_id,0)
        AND a.kind=CASE WHEN w.escalate_at<=now() THEN 'ESCALATE' WHEN w.due_at<=now() THEN 'REMIND' ELSE 'NEW' END
        AND (a.state IN ('SENT','REVIEW') OR a.lease_until>now())) ORDER BY w.due_at,w.id LIMIT 200`, [leadId ?? null]);
  }

  async start(dto: StartFeedbackAlertDto) {
    return this.db.transaction(async m => {
      const initial = await m.getRepository(FeedbackWork).findOneBy({ id: dto.workId });
      if (!initial) return { allowed: false };
      const lead = await m.getRepository(Lead).findOne({ where: { id: initial.leadId }, lock: { mode: 'pessimistic_write' } });
      const w = await m.getRepository(FeedbackWork).findOneOrFail({ where: { id: dto.workId }, lock: { mode: 'pessimistic_write' } });
      if (!lead || ['LOST','SIGNED'].includes(lead.status) || (lead.assignedUserId ?? 0) !== dto.assigneeId || w.version !== dto.version || !this.kindDue(w, dto.kind, new Date())) return { allowed: false };
      const repo = m.getRepository(FeedbackWorkAlert);
      let a = await repo.findOneBy({ workId: w.id, version: w.version, kind: dto.kind, assigneeId: dto.assigneeId });
      if (a) {
        if (a.state === 'STARTED' && a.leaseUntil <= new Date()) { a.state = 'REVIEW'; a.error = 'Lần gửi trước chưa xác định kết quả'; await repo.save(a); }
        return { allowed: false };
      }
      a = await repo.save(repo.create({ ...dto, state: 'STARTED', token: randomBytes(32).toString('hex'), leaseUntil: new Date(Date.now() + 30*60_000), error: null }));
      const title = dto.kind === 'NEW' ? 'Cần gọi lại sau phản hồi' : dto.kind === 'REMIND' ? 'Quá hạn chăm sóc sau phản hồi' : 'Báo quản lý: quá hạn chăm sóc sau phản hồi';
      return { allowed: true, alertId: a.id, token: a.token, kind: dto.kind, leadId: lead.id,
        ...(dto.kind === 'ESCALATE' ? {} : { assigneeId: lead.assignedUserId }), title: `[${title}] ${lead.name}`,
        message: `Việc #${w.id}, phản hồi #${w.feedbackId}, khách ${lead.name}, sale #${lead.assignedUserId ?? 'chưa phân công'}. Hạn liên hệ: ${w.dueAt.toISOString()}. Mở hồ sơ để ghi kết quả và hạn gọi tiếp.`,
        actions: [{ label: 'Mở hồ sơ khách', url: `${(process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/,'')}/admin/leads/${lead.id}` }] };
    });
  }

  async finish(id: number, dto: FinishFeedbackAlertDto) {
    return this.db.transaction(async m => {
      const repo = m.getRepository(FeedbackWorkAlert);
      const a = await repo.createQueryBuilder('a').addSelect('a.token').where('a.id=:id', { id }).setLock('pessimistic_write').getOne();
      if (!a || a.token !== dto.token) throw new ConflictException('Không sở hữu lần gửi');
      if (a.state === 'SENT') return { ok: true };
      if (a.state !== 'STARTED') throw new ConflictException('Cần quản lý đối soát lần gửi');
      a.state = dto.delivered ? 'SENT' : 'REVIEW'; a.error = dto.delivered ? null : (dto.error || 'Chưa xác định đã gửi hay chưa');
      await repo.save(a);
      return { ok: true };
    });
  }

  async review(user: AuthUser) {
    if (user.role !== 'MANAGER') throw new ForbiddenException();
    return this.db.getRepository(FeedbackWorkAlert).createQueryBuilder('a').where("a.state='REVIEW' OR (a.state='STARTED' AND a.lease_until<=now())").orderBy('a.id','ASC').limit(200).getMany();
  }

  async resolve(id: number, dto: ResolveFeedbackAlertDto, user: AuthUser) {
    if (user.role !== 'MANAGER') throw new ForbiddenException();
    if (!dto.note.trim()) throw new BadRequestException('Ghi lý do đối soát');
    return this.db.transaction(async m => {
      const a = await m.getRepository(FeedbackWorkAlert).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!a) throw new NotFoundException();
      if (a.state !== 'REVIEW' && !(a.state === 'STARTED' && a.leaseUntil <= new Date())) throw new ConflictException('Lần gửi chưa cần đối soát');
      const w = await m.getRepository(FeedbackWork).findOneByOrFail({ id: a.workId });
      await m.getRepository(LeadEvent).save({ leadId: w.leadId, actorUserId: user.id, type: 'FEEDBACK_ALERT_RESOLVED',
        note: `Thông báo #${a.id}: ${dto.delivered ? 'đã gửi' : 'chưa gửi, cho phép thử lại'}: ${dto.note.trim()}` });
      if (dto.delivered) { a.state = 'SENT'; a.error = null; await m.save(a); }
      else await m.getRepository(FeedbackWorkAlert).delete(a.id);
      return { ok: true };
    });
  }
}
