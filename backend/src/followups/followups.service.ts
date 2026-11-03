import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { FollowupTask, type FollowupType } from './followup-task.entity';
import { ActionDoneDto, ClaimFollowupDto, FailFollowupDto, ResolveFollowupDto } from './followup.dto';
import { isFollowupDue, type FollowupSnapshot } from './followup-policy';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { LeadsService } from '../leads/leads.service';

const LEASE_MS = 30 * 60_000;
const RETRY_MS = 6 * 3_600_000;
const EVENTS: Record<FollowupType, string> = {
  REMINDER: 'REMINDER_SENT', FEEDBACK: 'FEEDBACK_ASKED', WARM_NUDGE: 'WARM_NURTURE_STARTED', STAFF_NUDGE: 'STAFF_NUDGE_SENT',
};

@Injectable()
export class FollowupsService {
  private readonly logger = new Logger(FollowupsService.name);
  constructor(private readonly db: DataSource, private readonly leads: LeadsService) {}

  private async snapshot(m: EntityManager, leadId: number, type: FollowupType): Promise<(FollowupSnapshot & { viewing_id: number }) | undefined> {
    const rows = await m.query(`SELECT l.status,l.level,l.consent_marketing,l.created_at,v.id AS viewing_id,v.viewing_time,
      (EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='REMINDER_SENT'
        AND (e.note IS NULL OR e.note NOT LIKE 'L2 REMINDER:%')
        AND e.created_at >= COALESCE((SELECT max(r.created_at) FROM lead_events r WHERE r.lead_id=l.id AND r.type='VIEWING_RESCHEDULED'),'-infinity'::timestamptz))
        OR EXISTS(SELECT 1 FROM followup_tasks t WHERE t.lead_id=l.id AND t.type='REMINDER' AND t.state='COMPLETED' AND t.viewing_id=v.id AND t.viewing_time=v.viewing_time)) AS reminder_sent,
      EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='FEEDBACK_ASKED') AS feedback_asked,
      (SELECT max(e.created_at) FROM lead_events e WHERE e.lead_id=l.id AND e.type='FEEDBACK_ASKED') AS feedback_asked_at,
      EXISTS(SELECT 1 FROM feedbacks f WHERE f.lead_id=l.id AND f.submitted_at IS NOT NULL) AS has_feedback,
      EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type IN ('WARM_NUDGE_SENT','WARM_NURTURE_STARTED')) AS nurture_started,
      EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='STAFF_NUDGE_SENT') AS staff_nudged,
      EXISTS(SELECT 1 FROM lead_events e WHERE e.lead_id=l.id AND e.type='FOLLOWUP_FAILED' AND e.note LIKE $2 AND e.created_at>now()-interval '6 hours') AS cooling_down
      FROM leads l JOIN LATERAL (SELECT * FROM viewings WHERE lead_id=l.id ORDER BY id DESC LIMIT 1) v ON true
      WHERE l.id=$1`, [leadId, `${type}:%`]);
    return rows[0];
  }

  async claim(dto: ClaimFollowupDto) {
    return this.db.transaction(async m => {
      // Every operation locks the lead before the task: two executions cannot acquire the same work.
      await m.query('SELECT id FROM leads WHERE id=$1 FOR UPDATE', [dto.leadId]);
      const s = await this.snapshot(m, dto.leadId, dto.type);
      const now = new Date();
      const key = dto.type === 'REMINDER'
        ? `${dto.type}:${dto.leadId}:${dto.viewingId}:${new Date(dto.viewingTime).toISOString()}`
        : `${dto.type}:${dto.leadId}`;
      const repo = m.getRepository(FollowupTask);
      let task = await repo.findOne({ where: { taskKey: key }, lock: { mode: 'pessimistic_write' } });
      if (task?.state === 'COMPLETED' || task?.state === 'REVIEW') return { claimed: false, reason: task.state };
      if (task && task.owner !== dto.owner && task.leaseUntil > now) return { claimed: false, reason: 'Tác vụ đang được execution khác xử lý' };
      if (task?.state === 'ACTION_STARTED') {
        task.state = 'REVIEW'; task.error = 'Không xác định dịch vụ ngoài đã nhận tác vụ hay chưa; không tự gửi lại';
        await repo.save(task);
        await m.getRepository(LeadEvent).save({ leadId: task.leadId, type: 'FOLLOWUP_FAILED', note: `${task.type}: REVIEW: ${task.error}` });
        return { claimed: false, reason: 'REVIEW' };
      }
      if (task && task.availableAt > now) return { claimed: false, reason: 'Đang chờ thử lại' };
      if (task?.state !== 'ACTION_DONE' && (!s || s.viewing_id !== dto.viewingId || new Date(s.viewing_time).getTime() !== new Date(dto.viewingTime).getTime()))
        return { claimed: false, reason: 'Lịch đã thay đổi hoặc không tồn tại' };
      // ACTION_DONE resumes only database finalization, even if the lead has progressed meanwhile.
      if (task?.state !== 'ACTION_DONE' && (!s || !isFollowupDue(s, dto.type, now))) return { claimed: false, reason: 'Không còn đủ điều kiện' };
      task ??= repo.create({ taskKey: key, leadId: dto.leadId, viewingId: dto.viewingId,
        viewingTime: new Date(dto.viewingTime), type: dto.type, result: {} });
      if (task.owner !== dto.owner || task.state === 'FAILED' || !task.token) task.token = randomUUID();
      task.owner = dto.owner;
      if (task.state !== 'ACTION_DONE') task.state = 'CLAIMED';
      task.leaseUntil = new Date(now.getTime() + LEASE_MS); task.availableAt = now; task.error = null;
      await repo.save(task);
      return { claimed: true, taskId: task.id, token: task.token, resume: task.state === 'ACTION_DONE' };
    });
  }

  private async locked(m: EntityManager, id: number, token: string): Promise<FollowupTask> {
    const repo = m.getRepository(FollowupTask);
    const initial = await repo.findOne({ where: { id } });
    if (!initial) throw new NotFoundException('Tác vụ không tồn tại');
    await m.query('SELECT id FROM leads WHERE id=$1 FOR UPDATE', [initial.leadId]);
    const task = await repo.findOneOrFail({ where: { id }, lock: { mode: 'pessimistic_write' } });
    if (task.token !== token) throw new ConflictException('Execution không còn sở hữu tác vụ');
    return task;
  }

  async start(id: number, token: string) {
    return this.db.transaction(async m => {
      const task = await this.locked(m, id, token);
      if (task.state !== 'CLAIMED' || task.leaseUntil <= new Date()) return { allowed: false, reason: task.state };
      const s = await this.snapshot(m, task.leadId, task.type);
      if (!s || s.viewing_id !== task.viewingId || new Date(s.viewing_time).getTime() !== task.viewingTime.getTime() || !isFollowupDue(s, task.type, new Date()))
        return { allowed: false, reason: 'Khách hoặc lịch không còn đủ điều kiện' };
      task.state = 'ACTION_STARTED';
      task.leaseUntil = new Date(Date.now() + LEASE_MS);
      await m.getRepository(FollowupTask).save(task);
      return { allowed: true };
    });
  }

  async actionDone(id: number, dto: ActionDoneDto) {
    return this.db.transaction(async m => {
      const task = await this.locked(m, id, dto.token);
      if (task.state === 'ACTION_DONE' || task.state === 'COMPLETED') return { ok: true };
      if (task.state !== 'ACTION_STARTED') throw new ConflictException('Tác vụ chưa bắt đầu gửi');
      if (task.type === 'WARM_NUDGE' && !dto.mauticContactId) throw new ConflictException('Thiếu contactId Mautic');
      task.result = dto.mauticContactId ? { mauticContactId: dto.mauticContactId } : {};
      task.state = 'ACTION_DONE';
      await m.getRepository(FollowupTask).save(task);
      return { ok: true };
    });
  }

  async complete(id: number, token: string) {
    const result = await this.db.transaction(async m => {
      const task = await this.locked(m, id, token);
      if (task.state === 'COMPLETED') return { ok: true, leadId: task.leadId, statusChanged: false };
      if (task.state !== 'ACTION_DONE') throw new ConflictException('Chưa xác nhận gửi thành công');
      let statusChanged = false;
      if (task.type === 'FEEDBACK') {
        const current = await this.snapshot(m, task.leadId, task.type);
        if (current && current.viewing_id === task.viewingId && new Date(current.viewing_time).getTime() === task.viewingTime.getTime()) {
          const update = await m.getRepository(Lead).update({ id: task.leadId, status: 'CONFIRMED' }, { status: 'VIEWED' });
          statusChanged = Boolean(update.affected);
        }
        if (statusChanged) await m.getRepository(LeadEvent).save({ leadId: task.leadId, type: 'STATUS_CHANGED', note: 'CONFIRMED -> VIEWED: Đã hỏi cảm nhận sau buổi xem' });
      }
      if (task.result.mauticContactId) await m.getRepository(Lead).update(task.leadId, { mauticContactId: task.result.mauticContactId });
      await m.getRepository(LeadEvent).save({ leadId: task.leadId, type: EVENTS[task.type], note: `L2 ${task.taskKey}` });
      task.state = 'COMPLETED'; task.error = null;
      await m.getRepository(FollowupTask).save(task);
      return { ok: true, leadId: task.leadId, statusChanged };
    });
    if (result.statusChanged) this.leads.notifyFollowupStatusChanged(result.leadId).catch(err => this.logger.warn(String(err)));
    return result;
  }

  async fail(id: number, dto: FailFollowupDto) {
    return this.db.transaction(async m => {
      const task = await this.locked(m, id, dto.token);
      if (task.state === 'COMPLETED') return { state: task.state };
      task.state = task.state === 'ACTION_STARTED' || task.state === 'REVIEW' ? 'REVIEW'
        : task.state === 'ACTION_DONE' ? 'ACTION_DONE' : 'FAILED';
      task.error = dto.error;
      task.availableAt = new Date(Date.now() + RETRY_MS); task.leaseUntil = new Date(0);
      await m.getRepository(FollowupTask).save(task);
      await m.getRepository(LeadEvent).save({ leadId: task.leadId, type: 'FOLLOWUP_FAILED', note: `${task.type}: ${task.state}: ${dto.error}` });
      return { state: task.state };
    });
  }

  // Operator uses this only after checking the external provider's delivery history.
  async resolve(id: number, dto: ResolveFollowupDto) {
    await this.db.transaction(async m => {
      const task = await this.locked(m, id, dto.token);
      if (task.state !== 'REVIEW') throw new ConflictException('Chỉ xử lý thủ công tác vụ REVIEW');
      if (dto.resolution === 'delivered') {
        if (task.type === 'WARM_NUDGE' && !dto.mauticContactId) throw new ConflictException('Cần contactId đã kiểm tra trên Mautic');
        task.result = dto.mauticContactId ? { mauticContactId: dto.mauticContactId } : {};
        task.state = 'ACTION_DONE'; task.availableAt = new Date(0);
      } else {
        task.state = 'FAILED'; task.availableAt = new Date(Date.now() + RETRY_MS);
      }
      task.leaseUntil = new Date(0);
      await m.getRepository(FollowupTask).save(task);
    });
    return dto.resolution === 'delivered' ? this.complete(id, dto.token) : { ok: true };
  }
}
