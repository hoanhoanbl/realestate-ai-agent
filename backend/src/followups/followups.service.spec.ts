import { FollowupsService } from './followups.service';
import { FollowupTask } from './followup-task.entity';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { isFollowupDue, type FollowupSnapshot } from './followup-policy';

const now = new Date('2026-11-03T08:00:00Z');
const snapshot = (overrides = {}): FollowupSnapshot => ({
  email: 'test@example.invalid',
  status: 'CONFIRMED', viewing_status: 'NEW', level: 'WARM', consent_marketing: true,
  created_at: new Date(now.getTime() - 4 * 86400000), viewing_time: new Date(now.getTime() + 5 * 3600000),
  reminder_sent: false, feedback_asked: false, feedback_asked_at: null,
  has_feedback: false, nurture_started: false, staff_nudged: false, cooling_down: false,
  attendance_check_sent: false, attendance_check_at: null, attendance_escalated: false,
  ...overrides,
});

describe('Follow-up eligibility', () => {
  it.each(['HOT', 'WARM', 'COLD'])('reminds a confirmed %s lead', level => {
    expect(isFollowupDue(snapshot({ level }), 'REMINDER', now)).toBe(true);
  });
  it('does not remind twice or remind a past viewing', () => {
    expect(isFollowupDue(snapshot({ reminder_sent: true }), 'REMINDER', now)).toBe(false);
    expect(isFollowupDue(snapshot({ viewing_time: new Date(now.getTime() - 1) }), 'REMINDER', now)).toBe(false);
  });
  it('asks feedback and excludes an already submitted response', () => {
    const s = snapshot({ status: 'VIEWED', viewing_status: 'ATTENDED', viewing_time: new Date(now.getTime() - 3 * 3600000) });
    expect(isFollowupDue(s, 'FEEDBACK', now)).toBe(true);
    expect(isFollowupDue({ ...s, has_feedback: true }, 'FEEDBACK', now)).toBe(false);
  });
  it('requires all WARM nurture conditions', () => {
    const s = snapshot({ status: 'VIEWED', viewing_status: 'ATTENDED', feedback_asked: true, feedback_asked_at: new Date(now.getTime() - 4 * 86400000) });
    expect(isFollowupDue(s, 'WARM_NUDGE', now)).toBe(true);
    for (const change of [{ viewing_status: 'NEW' }, { consent_marketing: false }, { has_feedback: true }, { nurture_started: true }, { level: 'HOT' }, { status: 'SIGNED' }, { cooling_down: true }, { feedback_asked_at: now }])
      expect(isFollowupDue({ ...s, ...change }, 'WARM_NUDGE', now)).toBe(false);
  });
  it.each(['HOT', 'WARM', 'COLD', null])('escalates overdue %s leads by assignment even without an appointment', level => {
    const s = snapshot({ status: 'CONSULTING', level, viewing_time: null, assigned_at: new Date(now.getTime()-3*3600000), response_due_at: new Date(now.getTime()-1), first_response_at: null });
    expect(isFollowupDue(s, 'STAFF_NUDGE', now)).toBe(true);
    expect(isFollowupDue({ ...s, response_due_at: new Date(now.getTime()+1) }, 'STAFF_NUDGE', now)).toBe(false);
    expect(isFollowupDue({ ...s, first_response_at: now }, 'STAFF_NUDGE', now)).toBe(false);
    expect(isFollowupDue({ ...s, status: 'SIGNED' }, 'STAFF_NUDGE', now)).toBe(false);
    expect(isFollowupDue({ ...s, staff_nudged: true }, 'STAFF_NUDGE', now)).toBe(false);
  });
  it.each([['HOT_NUDGE', 'HOT'], ['COLD_NURTURE', 'COLD']] as const)('routes silent %s with consent and no feedback', (type, level) => {
    const s = snapshot({ status: 'VIEWED', viewing_status: 'ATTENDED', level, feedback_asked_at: new Date(now.getTime() - 73 * 3600000) });
    expect(isFollowupDue(s, type, now)).toBe(true);
    for (const change of [{ consent_marketing: false }, { has_feedback: true }, { status: 'DEPOSIT' }, { viewing_status: 'NEW' }, { feedback_asked_at: new Date(now.getTime() - 72 * 3600000) }, { hot_nudged: true, cold_nurture_started: true }])
      expect(isFollowupDue({ ...s, ...change }, type, now)).toBe(false);
    expect(isFollowupDue({ ...s, level: 'WARM' }, type, now)).toBe(false);
  });
  it('expires only NEW appointments in the past, or resumes its own expiry notice', () => {
    const s = snapshot({ status: 'NEW', viewing_time: new Date(now.getTime() - 1) });
    expect(isFollowupDue(s, 'EXPIRE_LEAD', now)).toBe(true);
    for (const change of [{ status: 'CONFIRMED' }, { status: 'DEPOSIT' }, { viewing_status: 'CANCELLED' }, { viewing_time: now }, { viewing_time: null }, { viewing_time: 'invalid' }])
      expect(isFollowupDue({ ...s, ...change } as FollowupSnapshot, 'EXPIRE_LEAD', now)).toBe(false);
    const closed = { ...s, status: 'LOST', lost_reason: 'EXPIRED', viewing_status: 'CANCELLED' };
    expect(isFollowupDue(closed, 'EXPIRE_LEAD', now)).toBe(false);
    expect(isFollowupDue({ ...closed, expired_for_schedule: true }, 'EXPIRE_LEAD', now)).toBe(true);
  });
  it('asks staff to confirm attendance instead of treating elapsed time as attendance', () => {
    const s = snapshot({ viewing_time: new Date(now.getTime() - 25 * 3600000) });
    expect(isFollowupDue(s, 'FEEDBACK', now)).toBe(false);
    expect(isFollowupDue(s, 'ATTENDANCE_CHECK', now)).toBe(true);
    expect(isFollowupDue({ ...s, attendance_check_sent: true }, 'ATTENDANCE_CHECK', now)).toBe(false);
    expect(isFollowupDue({ ...s, viewing_status: 'CANCELLED' }, 'ATTENDANCE_CHECK', now)).toBe(false);
    expect(isFollowupDue({ ...s, status: 'VIEWED', viewing_status: 'NEW' }, 'FEEDBACK', now)).toBe(false);
  });
  it('escalates only after the current schedule attendance reminder is over 24 hours old', () => {
    const s = snapshot({ attendance_check_at: new Date(now.getTime() - 25 * 3600000) });
    expect(isFollowupDue(s, 'ATTENDANCE_ESCALATE', now)).toBe(true);
    for (const change of [{ attendance_check_at: null }, { attendance_check_at: now }, { attendance_escalated: true }, { viewing_status: 'ATTENDED' }, { status: 'LOST' }])
      expect(isFollowupDue({ ...s, ...change }, 'ATTENDANCE_ESCALATE', now)).toBe(false);
  });
});

describe('Follow-up task lifecycle', () => {
  let tasks: FollowupTask[];
  let events: Partial<LeadEvent>[];
  let service: FollowupsService;
  let current: FollowupSnapshot & { viewing_id: number };
  let notify: jest.Mock;
  let leadStatus: string;
  let contactId: number | undefined;
  const dto = { leadId: 22, viewingId: 6, viewingTime: '2026-11-03T13:00:00.000Z', type: 'REMINDER' as const, owner: 'execution-1' };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    tasks = []; events = []; current = { ...snapshot(), viewing_id: 6 }; leadStatus = 'CONFIRMED'; contactId = undefined;
    const repo = {
      create: (value: Partial<FollowupTask>) => ({ ...value }),
      findOne: async ({ where }: any) => tasks.find(t => where.id ? t.id === where.id : t.taskKey === where.taskKey) ?? null,
      findOneOrFail: async ({ where }: any) => tasks.find(t => t.id === where.id),
      save: async (task: FollowupTask) => { if (!task.id) { task.id = tasks.length + 1; tasks.push(task); } return task; },
    };
    const manager = {
      query: async (sql: string) => sql.startsWith('SELECT id FROM leads') ? [{ id: 22 }] : [current],
      getRepository: (entity: any) => entity === FollowupTask ? repo : entity === LeadEvent ? {
        save: async (event: Partial<LeadEvent>) => {
          events.push(event);
          if (event.type === 'LEAD_EXPIRED') current.expired_for_schedule = true;
          return event;
        },
      } : entity === Lead ? {
        update: async (where: any, values: any) => {
          if (typeof where === 'object' && where.status !== leadStatus) return { affected: 0 };
          if (values.status) { leadStatus = values.status; current.status = values.status; }
          if (values.lostReason) current.lost_reason = values.lostReason;
          if (values.mauticContactId) contactId = values.mauticContactId;
          return { affected: 1 };
        },
      } : entity === Viewing ? {
        update: async (_where: any, values: any) => { current.viewing_status = values.status; return { affected: 1 }; },
      } : null,
    };
    notify = jest.fn().mockResolvedValue(undefined);
    service = new FollowupsService({ transaction: async (fn: any) => fn(manager) } as any, { notifyFollowupStatusChanged: notify } as any);
  });
  afterEach(() => jest.useRealTimers());

  it('allows one owner, reuses claim retries and rejects a second execution', async () => {
    const a = await service.claim(dto);
    const b = await service.claim(dto);
    expect(b).toEqual(a);
    expect((await service.claim({ ...dto, owner: 'execution-2' })).claimed).toBe(false);
    expect(tasks).toHaveLength(1);
  });
  it('closes an expired lead atomically at claim, then sends only one manager notice', async () => {
    leadStatus = 'NEW';
    current = { ...current, status: 'NEW', viewing_time: new Date(now.getTime() - 3600000) };
    const request = { ...dto, type: 'EXPIRE_LEAD' as const, viewingTime: new Date(current.viewing_time).toISOString() };
    const a = await service.claim(request);
    expect(a.claimed).toBe(true);
    expect(leadStatus).toBe('LOST');
    expect(current.lost_reason).toBe('EXPIRED');
    expect(current.viewing_status).toBe('CANCELLED');
    expect(events.filter(e => e.type === 'LEAD_EXPIRED')).toHaveLength(1);
    expect(notify).toHaveBeenCalledWith(22);
    // Lỗi trước gửi vẫn không mở lại lead; nhận lại tác vụ chỉ để báo quản lý.
    await service.fail(a.taskId!, { token: a.token!, error: 'Property service unavailable' });
    jest.setSystemTime(new Date(now.getTime() + 7 * 3600000));
    const b = await service.claim({ ...request, owner: 'retry' });
    expect(b.claimed).toBe(true);
    expect((await service.start(b.taskId!, b.token!)).allowed).toBe(true);
    await service.actionDone(b.taskId!, { token: b.token! });
    await service.complete(b.taskId!, b.token!);
    await service.complete(b.taskId!, b.token!);
    expect(events.filter(e => e.type === 'LEAD_EXPIRED')).toHaveLength(1);
    expect(events.filter(e => e.type === 'LEAD_EXPIRED_NOTIFIED')).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('does not expire a lead approved or rescheduled before claim', async () => {
    expect((await service.claim({ ...dto, type: 'EXPIRE_LEAD' })).claimed).toBe(false);
    current.status = 'NEW'; current.viewing_time = new Date(now.getTime() + 3600000);
    expect((await service.claim({ ...dto, type: 'EXPIRE_LEAD' })).claimed).toBe(false);
    expect(events).toHaveLength(0);
  });
  it.each(['HOT_NUDGE', 'COLD_NURTURE'] as const)('rechecks consent before %s and requires a Mautic ID for COLD', async type => {
    current = { ...current, status: 'VIEWED', viewing_status: 'ATTENDED', level: type === 'HOT_NUDGE' ? 'HOT' : 'COLD', feedback_asked_at: new Date(now.getTime() - 4 * 86400000) };
    const a = await service.claim({ ...dto, type });
    current.consent_marketing = false;
    expect((await service.start(a.taskId!, a.token!)).allowed).toBe(false);
    current.consent_marketing = true;
    await service.start(a.taskId!, a.token!);
    if (type === 'COLD_NURTURE') await expect(service.actionDone(a.taskId!, { token: a.token! })).rejects.toThrow('contactId');
    await service.actionDone(a.taskId!, { token: a.token!, ...(type === 'COLD_NURTURE' ? { mauticContactId: 8 } : {}) });
    await service.complete(a.taskId!, a.token!);
    expect(events[0].type).toBe(type === 'HOT_NUDGE' ? 'HOT_NUDGE_SENT' : 'COLD_NURTURE_STARTED');
  });
  it('rechecks consent immediately before a nurture action', async () => {
    current = { ...current, status: 'VIEWED', viewing_status: 'ATTENDED', feedback_asked_at: new Date(now.getTime() - 4 * 86400000) };
    const a = await service.claim({ ...dto, type: 'WARM_NUDGE' });
    current.consent_marketing = false;
    expect((await service.start(a.taskId!, a.token!)).allowed).toBe(false);
  });
  it('requires an action checkpoint and completes exactly once', async () => {
    const a = await service.claim(dto);
    await expect(service.complete(a.taskId!, a.token!)).rejects.toThrow();
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    await service.complete(a.taskId!, a.token!);
    await service.complete(a.taskId!, a.token!);
    expect(events.filter(e => e.type === 'REMINDER_SENT')).toHaveLength(1);
    expect((await service.claim(dto)).claimed).toBe(false);
  });
  it('puts uncertain sends in REVIEW instead of automatically resending', async () => {
    const a = await service.claim(dto);
    await service.start(a.taskId!, a.token!);
    expect((await service.fail(a.taskId!, { token: a.token!, error: 'SMTP timeout' })).state).toBe('REVIEW');
    jest.setSystemTime(new Date(now.getTime() + 7 * 3600000));
    expect((await service.claim({ ...dto, owner: 'another' })).claimed).toBe(false);
  });
  it('reclaims expired preparation but never replays an expired started send', async () => {
    const a = await service.claim(dto);
    tasks[0].leaseUntil = new Date(0);
    const b = await service.claim({ ...dto, owner: 'another' });
    expect(b.claimed).toBe(true);
    await expect(service.start(a.taskId!, a.token!)).rejects.toThrow();
    await service.start(b.taskId!, b.token!);
    tasks[0].leaseUntil = new Date(0);
    expect((await service.claim({ ...dto, owner: 'third' })).reason).toBe('REVIEW');
  });
  it('resumes metadata finalization without sending again', async () => {
    const a = await service.claim(dto);
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    await service.fail(a.taskId!, { token: a.token!, error: 'Database unavailable' });
    jest.setSystemTime(new Date(now.getTime() + 7 * 3600000));
    const b = await service.claim({ ...dto, owner: 'retry' });
    expect(b.resume).toBe(true);
    await service.complete(b.taskId!, b.token!);
    expect(events.filter(e => e.type === 'REMINDER_SENT')).toHaveLength(1);
  });
  it('creates a separate reminder task when viewing time changes', async () => {
    const a = await service.claim(dto);
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    await service.complete(a.taskId!, a.token!);
    current.viewing_time = new Date(now.getTime() + 6 * 3600000);
    expect((await service.claim({ ...dto, viewingTime: new Date(current.viewing_time).toISOString(), owner: 'reschedule' })).claimed).toBe(true);
    expect(tasks).toHaveLength(2);
  });
  it('records feedback delivery without automatically changing attendance or lead status', async () => {
    current.status = 'VIEWED'; current.viewing_status = 'ATTENDED'; leadStatus = 'VIEWED';
    current.viewing_time = new Date(now.getTime() - 25 * 3600000);
    const a = await service.claim({ ...dto, type: 'FEEDBACK', viewingTime: new Date(current.viewing_time).toISOString() });
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    await service.complete(a.taskId!, a.token!);
    expect(leadStatus).toBe('VIEWED');
    expect(events.map(e => e.type)).toEqual(['FEEDBACK_ASKED']);
    expect(notify).not.toHaveBeenCalled();
  });
  it('persists the Mautic ID and requires confirmation for manual resolution', async () => {
    current = { ...current, status: 'VIEWED', viewing_status: 'ATTENDED', feedback_asked_at: new Date(now.getTime() - 4 * 86400000) };
    const a = await service.claim({ ...dto, type: 'WARM_NUDGE' });
    await service.start(a.taskId!, a.token!);
    await expect(service.actionDone(a.taskId!, { token: a.token! })).rejects.toThrow();
    await service.fail(a.taskId!, { token: a.token!, error: 'Lost response' });
    await service.resolve(a.taskId!, { token: a.token!, resolution: 'delivered', mauticContactId: 42 });
    expect(contactId).toBe(42);
    expect(tasks[0].state).toBe('COMPLETED');
  });
  it('does not mark a rescheduled future viewing as VIEWED after an old feedback send', async () => {
    current.status = 'VIEWED'; current.viewing_status = 'ATTENDED';
    current.viewing_time = new Date(now.getTime() - 25 * 3600000);
    const a = await service.claim({ ...dto, type: 'FEEDBACK', viewingTime: new Date(current.viewing_time).toISOString() });
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    current.viewing_time = new Date(now.getTime() + 5 * 3600000);
    await service.complete(a.taskId!, a.token!);
    expect(leadStatus).toBe('CONFIRMED');
    expect(events.map(e => e.type)).toEqual(['FEEDBACK_ASKED']);
  });
  it.each(['ATTENDANCE_CHECK', 'ATTENDANCE_ESCALATE'] as const)('allows a new %s task after rescheduling and records its own event', async type => {
    current.viewing_time = new Date(now.getTime() - 3 * 3600000);
    current.attendance_check_at = new Date(now.getTime() - 25 * 3600000);
    const request = { ...dto, type, viewingTime: new Date(current.viewing_time).toISOString() };
    const a = await service.claim(request);
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    await service.complete(a.taskId!, a.token!);
    expect(events.map(e => e.type)).toEqual([type === 'ATTENDANCE_CHECK' ? 'ATTENDANCE_CHECK_SENT' : 'ATTENDANCE_ESCALATED']);
    current.viewing_time = new Date(now.getTime() - 4 * 3600000);
    expect((await service.claim({ ...request, viewingTime: new Date(current.viewing_time).toISOString() })).claimed).toBe(true);
    expect(tasks).toHaveLength(2);
    expect(leadStatus).toBe('CONFIRMED');
  });
});
