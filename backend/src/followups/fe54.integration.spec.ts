import { DataSource, type EntityManager } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { buildViewingConfirmationNote } from '../leads/lead.constants';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { FollowupTask } from './followup-task.entity';
import { FollowupsService } from './followups.service';
import { FOLLOWUP_SELECTOR_SQL, FOLLOWUP_SNAPSHOT_SQL } from './followup-sql';
import { isFollowupDue, type FollowupSnapshot } from './followup-policy';

const url = process.env.FE33_TEST_DATABASE_URL;
const HOUR = 3_600_000;

(url ? describe : describe.skip)('FE-54: reminder confirmation evidence (real PostgreSQL)', () => {
  let db: DataSource, worker: FollowupsService, lead: Lead, viewing: Viewing;

  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/fe33_test') {
      throw new Error('FE-54 chỉ dùng PostgreSQL tạm localhost:55433/fe33_test');
    }
    db = new DataSource({ type: 'postgres', url, synchronize: true,
      entities: [Lead, LeadEvent, User, Property, Viewing, ChatLog, Feedback, FollowupTask] });
    await db.initialize();
    worker = new FollowupsService(db, { notifyFollowupStatusChanged: async () => undefined } as any);
  });
  afterAll(async () => { if (db?.isInitialized) await db.destroy(); });
  beforeEach(async () => {
    await db.query('TRUNCATE followup_tasks,feedbacks,viewings,lead_events,leads,users,properties,chat_logs RESTART IDENTITY CASCADE');
    lead = await db.getRepository(Lead).save({ name: 'Khách FE-54', phone: '0900000054',
      email: 'fe54@example.test', status: 'CONFIRMED', consentMarketing: false });
    const property = await db.getRepository(Property).save({ name: 'Nhà test', address: 'Đà Nẵng',
      price: 3_000_000_000, area: 80, type: 'HOUSE', status: 'AVAILABLE' });
    viewing = await db.getRepository(Viewing).save({ leadId: lead.id, propertyId: property.id,
      viewingTime: new Date(Date.now() + 6 * HOUR), status: 'NEW' });
  });

  const dto = () => ({ leadId: lead.id, viewingId: viewing.id, viewingTime: viewing.viewingTime.toISOString(),
    type: 'REMINDER' as const, owner: 'fe54-worker' });
  async function evidence(overrides: Partial<LeadEvent> = {}) {
    return db.getRepository(LeadEvent).save({ leadId: lead.id, type: 'VIEWING_CONFIRMATION_SENT',
      note: buildViewingConfirmationNote(viewing.id, viewing.viewingTime),
      createdAt: new Date(Date.now() - HOUR), ...overrides });
  }
  async function checkDue(expected: boolean, manager: EntityManager = db.manager) {
    const [snapshot]: FollowupSnapshot[] = await manager.query(FOLLOWUP_SNAPSHOT_SQL, [lead.id, 'REMINDER:%', viewing.id]);
    const [{ now }]: { now: Date }[] = await manager.query('SELECT now() AS now');
    expect(isFollowupDue(snapshot, 'REMINDER', now)).toBe(expected);
    const selected = await manager.query(FOLLOWUP_SELECTOR_SQL);
    expect(selected.some((r: any) => r.type === 'REMINDER' && r.lead_id === lead.id && r.viewing_id === viewing.id)).toBe(expected);
  }

  it('keeps the reminder without successful confirmation, even without marketing consent', async () => {
    await evidence({ type: 'APPROVED', note: 'Nhân viên đã duyệt' });
    await evidence({ type: 'AI_SCORED', note: 'Thư đã nhận yêu cầu của luồng 1' });
    await checkDue(true);
    expect((await worker.claim(dto())).claimed).toBe(true);
  });
  it('suppresses a matching confirmation at selector and claim', async () => {
    await evidence();
    await checkDue(false);
    expect((await worker.claim(dto())).claimed).toBe(false);
    expect(await db.getRepository(FollowupTask).count()).toBe(0);
    expect(await db.getRepository(LeadEvent).countBy({ type: 'REMINDER_SENT' })).toBe(0);
  });
  it.each([
    ['one millisecond inside 24 hours', 24 * HOUR - 1, false],
    ['exactly 24 hours', 24 * HOUR, true],
    ['one millisecond outside 24 hours', 24 * HOUR + 1, true],
  ] as const)('handles confirmation sent %s', async (_name, beforeViewing, due) => {
    await evidence({ createdAt: new Date(viewing.viewingTime.getTime() - beforeViewing) });
    await checkDue(due);
  });
  it.each([null, '', 'viewing=1;time=invalid', 'viewing=1', 'viewing=999;time=2026-01-01T00:00:00.000Z'])
    ('ignores malformed or unrelated note %s without SQL casting errors', async note => {
      await evidence({ note });
      await checkDue(true);
    });
  it('does not suppress a different viewing at the same time, or a different lead', async () => {
    await evidence({ note: buildViewingConfirmationNote(viewing.id + 1, viewing.viewingTime) });
    const other = await db.getRepository(Lead).save({ name: 'Khác', phone: '0900000055', status: 'CONFIRMED' });
    await evidence({ leadId: other.id });
    await checkDue(true);
  });
  it('ignores future-dated evidence', async () => {
    await evidence({ createdAt: new Date(Date.now() + HOUR) });
    await checkDue(true);
  });
  it('requires fresh evidence after rescheduling, even when returning to the reminder window', async () => {
    await evidence();
    await checkDue(false);
    viewing.viewingTime = new Date(viewing.viewingTime.getTime() + HOUR);
    await db.getRepository(Viewing).save(viewing);
    await checkDue(true);
    await evidence();
    await checkDue(false);
  });
  it('matches canonical UTC notes regardless of database session timezone', async () => {
    await evidence();
    await db.transaction(async manager => {
      await manager.query("SET LOCAL TIME ZONE 'America/New_York'");
      await checkDue(false, manager);
    });
  });
  it('rechecks evidence arriving after selection but before claim', async () => {
    await checkDue(true);
    await evidence();
    expect((await worker.claim(dto())).claimed).toBe(false);
  });
  it('rechecks evidence arriving after claim but before start', async () => {
    const claimed = await worker.claim(dto());
    expect(claimed.claimed).toBe(true);
    await evidence();
    expect((await worker.start(claimed.taskId!, claimed.token!)).allowed).toBe(false);
    expect((await db.getRepository(FollowupTask).findOneByOrFail({ id: claimed.taskId! })).state).toBe('CLAIMED');
    expect(await db.getRepository(LeadEvent).countBy({ type: 'REMINDER_SENT' })).toBe(0);
  });
  it('sees confirmation committed while the current transaction was waiting', async () => {
    await db.transaction(async manager => {
      // claim/start mở transaction trước khi chờ khóa. Sự kiện hợp lệ có thể commit
      // trên connection khác sau lúc transaction bắt đầu, trước lúc đọc snapshot.
      await manager.query('SELECT pg_sleep(0.03)');
      await evidence({ createdAt: new Date() });
      await checkDue(false, manager);
    });
  });
  it('still finalizes an email already sent, without sending it again', async () => {
    const claimed = await worker.claim(dto());
    expect((await worker.start(claimed.taskId!, claimed.token!)).allowed).toBe(true);
    await worker.actionDone(claimed.taskId!, { token: claimed.token! });
    await evidence();
    await db.getRepository(FollowupTask).update(claimed.taskId!, { leaseUntil: new Date(0), availableAt: new Date(0) });
    expect((await db.query(FOLLOWUP_SELECTOR_SQL)).some((r: any) => r.type === 'REMINDER' && r.lead_id === lead.id)).toBe(true);
    const recovered = await worker.claim({ ...dto(), owner: 'fe54-recovery' });
    expect(recovered).toMatchObject({ claimed: true, resume: true });
    await worker.complete(recovered.taskId!, recovered.token!);
    await worker.complete(recovered.taskId!, recovered.token!);
    expect(await db.getRepository(LeadEvent).countBy({ type: 'REMINDER_SENT' })).toBe(1);
    expect((await db.getRepository(FollowupTask).findOneByOrFail({ id: claimed.taskId! })).state).toBe('COMPLETED');
  });
});
