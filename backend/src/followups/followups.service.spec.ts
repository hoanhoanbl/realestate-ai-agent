import { FollowupsService } from './followups.service';
import { FollowupTask } from './followup-task.entity';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { isFollowupDue, type FollowupSnapshot } from './followup-policy';

const now = new Date('2026-11-03T08:00:00Z');
const snapshot = (overrides = {}): FollowupSnapshot => ({
  status: 'CONFIRMED', level: 'WARM', consent_marketing: true,
  created_at: new Date(now.getTime() - 4 * 86400000), viewing_time: new Date(now.getTime() + 5 * 3600000),
  reminder_sent: false, feedback_asked: false, feedback_asked_at: null,
  has_feedback: false, nurture_started: false, staff_nudged: false, cooling_down: false,
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
    const s = snapshot({ status: 'VIEWED', viewing_time: new Date(now.getTime() - 3 * 3600000) });
    expect(isFollowupDue(s, 'FEEDBACK', now)).toBe(true);
    expect(isFollowupDue({ ...s, has_feedback: true }, 'FEEDBACK', now)).toBe(false);
  });
  it('requires all WARM nurture conditions', () => {
    const s = snapshot({ status: 'VIEWED', feedback_asked: true, feedback_asked_at: new Date(now.getTime() - 4 * 86400000) });
    expect(isFollowupDue(s, 'WARM_NUDGE', now)).toBe(true);
    for (const change of [{ consent_marketing: false }, { has_feedback: true }, { nurture_started: true }, { level: 'HOT' }, { status: 'SIGNED' }, { cooling_down: true }, { feedback_asked_at: now }])
      expect(isFollowupDue({ ...s, ...change }, 'WARM_NUDGE', now)).toBe(false);
  });
  it('nudges sale only for old NEW HOT/WARM leads', () => {
    expect(isFollowupDue(snapshot({ status: 'NEW' }), 'STAFF_NUDGE', now)).toBe(true);
    expect(isFollowupDue(snapshot({ status: 'NEW', level: 'COLD' }), 'STAFF_NUDGE', now)).toBe(false);
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
        save: async (event: Partial<LeadEvent>) => { events.push(event); return event; },
      } : entity === Lead ? {
        update: async (where: any, values: any) => {
          if (typeof where === 'object' && where.status !== leadStatus) return { affected: 0 };
          if (values.status) leadStatus = values.status;
          if (values.mauticContactId) contactId = values.mauticContactId;
          return { affected: 1 };
        },
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
  it('rechecks consent immediately before a nurture action', async () => {
    current = { ...current, status: 'VIEWED', feedback_asked_at: new Date(now.getTime() - 4 * 86400000) };
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
  it('commits feedback status and event together and notifies L7', async () => {
    current.viewing_time = new Date(now.getTime() - 25 * 3600000);
    const a = await service.claim({ ...dto, type: 'FEEDBACK', viewingTime: new Date(current.viewing_time).toISOString() });
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    await service.complete(a.taskId!, a.token!);
    expect(leadStatus).toBe('VIEWED');
    expect(events.map(e => e.type)).toEqual(['STATUS_CHANGED', 'FEEDBACK_ASKED']);
    expect(notify).toHaveBeenCalledWith(22);
  });
  it('persists the Mautic ID and requires confirmation for manual resolution', async () => {
    current = { ...current, status: 'VIEWED', feedback_asked_at: new Date(now.getTime() - 4 * 86400000) };
    const a = await service.claim({ ...dto, type: 'WARM_NUDGE' });
    await service.start(a.taskId!, a.token!);
    await expect(service.actionDone(a.taskId!, { token: a.token! })).rejects.toThrow();
    await service.fail(a.taskId!, { token: a.token!, error: 'Lost response' });
    await service.resolve(a.taskId!, { token: a.token!, resolution: 'delivered', mauticContactId: 42 });
    expect(contactId).toBe(42);
    expect(tasks[0].state).toBe('COMPLETED');
  });
  it('does not mark a rescheduled future viewing as VIEWED after an old feedback send', async () => {
    current.viewing_time = new Date(now.getTime() - 25 * 3600000);
    const a = await service.claim({ ...dto, type: 'FEEDBACK', viewingTime: new Date(current.viewing_time).toISOString() });
    await service.start(a.taskId!, a.token!);
    await service.actionDone(a.taskId!, { token: a.token! });
    current.viewing_time = new Date(now.getTime() + 5 * 3600000);
    await service.complete(a.taskId!, a.token!);
    expect(leadStatus).toBe('CONFIRMED');
    expect(events.map(e => e.type)).toEqual(['FEEDBACK_ASKED']);
  });
});
