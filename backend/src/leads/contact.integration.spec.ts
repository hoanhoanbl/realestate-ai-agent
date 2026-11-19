import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { of } from 'rxjs';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { LeadsService } from './leads.service';
import { LeadIntakeService } from './lead-intake.service';
import { LeadsController } from './leads.controller';
import { ChatLogsService } from '../chat-logs/chat-logs.service';
import { ViewingsService } from '../viewings/viewings.service';
import { MANUAL_LOST_REASONS, SYSTEM_LOST_REASONS } from './lead.constants';
import type { AuthUser } from '../auth/auth.types';

const url = process.env.FE33_TEST_DATABASE_URL;
(url ? describe : describe.skip)('FE-44: protected HTTP, real PostgreSQL and atomic contact history', () => {
  let db: DataSource, app: INestApplication, base: string, jwt: JwtService;
  let service: LeadsService, intake: LeadIntakeService, viewings: ViewingsService;
  let owner: AuthUser, other: AuthUser, manager: AuthUser, lead: Lead, property: Property;
  const originalSecret = process.env.WEBHOOK_SECRET;
  const asUser = (u: User): AuthUser => ({ id: u.id, name: u.name, email: u.email, role: u.role });

  beforeAll(async () => {
    const target = new URL(url!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/fe33_test') {
      throw new Error('FE-44 chỉ dùng DB disposable localhost:55433/fe33_test');
    }
    db = new DataSource({ type: 'postgres', url, synchronize: true,
      entities: [Lead, LeadEvent, User, Property, Viewing, ChatLog] });
    await db.initialize();
    const n8n = { callWebhook: async () => ({}) } as any;
    service = new LeadsService(db.getRepository(Lead), db.getRepository(LeadEvent), db.getRepository(Viewing), db.getRepository(Property), n8n);
    intake = new LeadIntakeService(db.getRepository(Lead));
    viewings = new ViewingsService(db.getRepository(Viewing), db.getRepository(Lead), db.getRepository(Property), { post: () => of({}) } as any, service, n8n, intake);
    process.env.WEBHOOK_SECRET = 'fe44-disposable-only';
    @Module({
      imports: [JwtModule.register({ secret: 'fe44-test-jwt' })],
      controllers: [LeadsController],
      providers: [
        { provide: LeadsService, useValue: service },
        { provide: LeadIntakeService, useValue: intake },
        { provide: ChatLogsService, useValue: {} },
      ],
    })
    class TestModule {}
    app = await NestFactory.create(TestModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl(); jwt = app.get(JwtService);
  });
  afterAll(async () => {
    await app?.close();
    if (db?.isInitialized) await db.destroy();
    if (originalSecret === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = originalSecret;
  });
  beforeEach(async () => {
    await db.query('TRUNCATE leads,lead_events,users,properties,viewings,chat_logs RESTART IDENTITY');
    const users = db.getRepository(User);
    owner = asUser(await users.save({ name: 'An', email: 'an@example.test', role: 'SALE', passwordHash: 'test' }));
    other = asUser(await users.save({ name: 'Bình', email: 'binh@example.test', role: 'SALE', passwordHash: 'test' }));
    manager = asUser(await users.save({ name: 'Quản lý', email: 'manager@example.test', role: 'MANAGER', passwordHash: 'test' }));
    lead = (await intake.create({ name: 'Khách test', phone: '0901234567', source: 'hotline', assignedUserId: owner.id }, owner)).lead;
    property = await db.getRepository(Property).save({ name: 'Nhà test', address: 'Đà Nẵng', price: 3000000000, area: 50, type: 'HOUSE', status: 'AVAILABLE' });
  });

  const send = (path: string, method: string, body: unknown = {}, actor?: AuthUser, secret?: string) => fetch(base + '/api' + path, {
    method, headers: { 'Content-Type': 'application/json',
      ...(actor ? { Authorization: `Bearer ${jwt.sign({ sub: actor.id, name: actor.name, email: actor.email, role: actor.role })}` } : {}),
      ...(secret ? { 'X-Webhook-Secret': secret } : {}),
    }, body: JSON.stringify(body),
  });
  const stored = () => db.getRepository(Lead).findOneByOrFail({ id: lead.id });
  async function scheduled(status = 'CONFIRMED') {
    await db.getRepository(Lead).update(lead.id, { status });
    return db.getRepository(Viewing).save({ leadId: lead.id, propertyId: property.id,
      viewingTime: new Date(Date.now() - 10 * 60000), status: 'NEW' });
  }
  async function rejectEvent(type: string) {
    // A database failure after the code has made its other writes must roll back EVERYTHING.
    await db.query(`ALTER TABLE lead_events ADD CONSTRAINT fe44_reject_event CHECK (type <> '${type}')`);
  }
  async function removeRejectEvent() { await db.query('ALTER TABLE lead_events DROP CONSTRAINT IF EXISTS fe44_reject_event'); }

  it('requires JWT, rejects another sale, ignores forged actor/time, and stores one original contact', async () => {
    const path = `/leads/${lead.id}/contacted`;
    expect((await send(path, 'POST')).status).toBe(401);
    expect((await send(path, 'POST', {}, other)).status).toBe(403);
    const response = await send(path, 'POST', { actorUserId: other.id, contactedAt: '2000-01-01T00:00:00Z' }, owner);
    expect(response.status).toBe(201);
    const first = await stored();
    expect(first.contactedAt).toBeInstanceOf(Date);
    expect(+first.contactedAt!).toBeGreaterThan(Date.now() - 60000);
    expect(first.firstResponseAt).toEqual(first.contactedAt);
    expect((await send(path, 'POST', {}, owner)).status).toBe(201);
    expect((await stored()).contactedAt).toEqual(first.contactedAt);
    const events = await db.getRepository(LeadEvent).findBy({ leadId: lead.id, type: 'CONTACTED' });
    expect(events).toHaveLength(1); expect(events[0].actorUserId).toBe(owner.id);
  });

  it('records attempts without setting contactedAt; validates results and staff permission', async () => {
    const path = `/leads/${lead.id}/contact-attempts`;
    expect((await send(path, 'POST', { result: 'BUSY' })).status).toBe(401);
    expect((await send(path, 'POST', { result: 'BUSY' }, other)).status).toBe(403);
    for (const body of [{}, { result: 'CONTACTED' }, { result: null }]) {
      expect((await send(path, 'POST', body, owner)).status).toBe(400);
    }
    expect((await send(path, 'POST', { result: 'NO_ANSWER', actorUserId: other.id }, owner)).status).toBe(201);
    const first = await stored();
    expect(first.contactedAt).toBeNull(); expect(first.firstResponseAt).toBeInstanceOf(Date);
    expect((await send(path, 'POST', { result: 'CALL_BACK' }, manager)).status).toBe(201);
    expect((await stored()).firstResponseAt).toEqual(first.firstResponseAt);
    const history = await db.getRepository(LeadEvent).find({ where: { leadId: lead.id, type: 'CONTACT_ATTEMPTED' }, order: { id: 'ASC' } });
    expect(history.map(e => e.actorUserId)).toEqual([owner.id, manager.id]);
    expect(history[0].note).toContain('NO_ANSWER');
  });

  it('uses current assignment permissions and rejects closed/missing leads', async () => {
    await intake.reassign(lead.id, { assignedUserId: other.id }, manager);
    expect((await send(`/leads/${lead.id}/contacted`, 'POST', {}, owner)).status).toBe(403);
    expect((await send(`/leads/${lead.id}/contacted`, 'POST', {}, other)).status).toBe(201);
    await db.getRepository(Lead).update(lead.id, { status: 'LOST' });
    expect((await send(`/leads/${lead.id}/contacted`, 'POST', {}, manager)).status).toBe(400);
    expect((await send(`/leads/${lead.id}/contact-attempts`, 'POST', { result: 'BUSY' }, other)).status).toBe(400);
    await db.getRepository(Lead).update(lead.id, { status: 'SIGNED' });
    expect((await send(`/leads/${lead.id}/contacted`, 'POST', {}, manager)).status).toBe(400);
    expect((await send('/leads/999999/contacted', 'POST', {}, manager)).status).toBe(404);
  });

  it('two simultaneous contact marks write exactly one CONTACTED event', async () => {
    await Promise.all([service.markContacted(lead.id, owner), service.markContacted(lead.id, manager)]);
    expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'CONTACTED' })).toBe(1);
    const first = await stored();
    expect(first.contactedAt).toEqual(first.firstResponseAt);
  });

  it('failed event insertion rolls back contact and first-response times', async () => {
    await rejectEvent('CONTACTED');
    try {
      await expect(service.markContacted(lead.id, owner)).rejects.toThrow();
      expect((await stored()).contactedAt).toBeNull();
      expect((await stored()).firstResponseAt).toBeNull();
    } finally { await removeRejectEvent(); }
  });

  it('attendance atomically reaches the customer once, keeps an earlier time, and rejects a duplicate attendance', async () => {
    const viewing = await scheduled();
    await viewings.recordAttendance(viewing.id, { outcome: 'ATTENDED' }, owner);
    const first = await stored();
    expect(first.status).toBe('VIEWED'); expect(first.contactedAt).toBeInstanceOf(Date);
    const events = await db.getRepository(LeadEvent).findBy({ leadId: lead.id, type: 'CONTACTED' });
    expect(events).toHaveLength(1); expect(events[0].note).toContain(`#${viewing.id}`);
    expect(events[0].actorUserId).toBe(owner.id);
    await expect(viewings.recordAttendance(viewing.id, { outcome: 'ATTENDED' }, owner)).rejects.toThrow();
    const second = await scheduled();
    await viewings.recordAttendance(second.id, { outcome: 'ATTENDED' }, owner);
    expect((await stored()).contactedAt).toEqual(first.contactedAt);
    expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'CONTACTED' })).toBe(1);
  });

  it('a concurrent manual mark and attendance preserve one contact time and one event', async () => {
    const viewing = await scheduled();
    await Promise.all([service.markContacted(lead.id, owner), viewings.recordAttendance(viewing.id, { outcome: 'ATTENDED' }, owner)]);
    expect((await stored()).status).toBe('VIEWED');
    expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'CONTACTED' })).toBe(1);
  });

  it('attendance rolls back both viewing and lead when the status event fails', async () => {
    const viewing = await scheduled();
    await rejectEvent('STATUS_CHANGED');
    try {
      await expect(viewings.recordAttendance(viewing.id, { outcome: 'ATTENDED' }, owner)).rejects.toThrow();
      expect((await stored()).status).toBe('CONFIRMED'); expect((await stored()).contactedAt).toBeNull();
      expect((await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id })).status).toBe('NEW');
      expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'CONTACTED' })).toBe(0);
    } finally { await removeRejectEvent(); }
  });

  it('no-show does not mark the customer reached', async () => {
    const viewing = await scheduled();
    await viewings.recordAttendance(viewing.id, { outcome: 'NO_SHOW', next: 'CLOSE' }, owner);
    expect((await stored()).contactedAt).toBeNull();
    expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'CONTACTED' })).toBe(0);
  });

  it.each([...SYSTEM_LOST_REASONS, 'NOT_INTERESTED', 'UNSUPPORTED'])('both status routes reject reason %s before cancelling any viewing', async reason => {
    const viewing = await scheduled('NEW');
    expect((await send(`/leads/${lead.id}/admin-status`, 'PUT', { status: 'LOST', reason }, owner)).status).toBe(400);
    expect((await send(`/leads/${lead.id}/status`, 'PUT', { status: 'LOST', lostReason: reason }, undefined, 'fe44-disposable-only')).status).toBe(400);
    expect((await stored()).status).toBe('NEW');
    expect((await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id })).status).toBe('NEW');
  });

  it.each(MANUAL_LOST_REASONS)('accepts manual reason %s and cancels the open viewing', async reason => {
    const viewing = await scheduled('NEW');
    const response = await send(`/leads/${lead.id}/admin-status`, 'PUT', { status: 'LOST', reason }, owner);
    expect(response.status).toBe(200);
    expect(await stored()).toMatchObject({ status: 'LOST', lostReason: reason });
    expect((await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id })).status).toBe('CANCELLED');
  });

  it('keeps DEPOSIT protection and rolls back a manual close if its event fails', async () => {
    await db.getRepository(Lead).update(lead.id, { status: 'DEPOSIT' });
    expect((await send(`/leads/${lead.id}/admin-status`, 'PUT', { status: 'LOST', reason: 'OTHER' }, owner)).status).toBe(400);
    const viewing = await scheduled('NEW');
    await rejectEvent('STATUS_CHANGED');
    try {
      await expect(service.adminSetStatus(lead.id, { status: 'LOST', reason: 'PRICE_TOO_HIGH' }, owner)).rejects.toThrow();
      expect((await stored()).status).toBe('NEW');
      expect((await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id })).status).toBe('NEW');
    } finally { await removeRejectEvent(); }
  });
});
