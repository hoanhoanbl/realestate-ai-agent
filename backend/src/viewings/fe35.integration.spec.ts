import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from './entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { ChatLogsService } from '../chat-logs/chat-logs.service';
import { LeadIntakeService } from '../leads/lead-intake.service';
import { LeadsService } from '../leads/leads.service';
import { UsersService } from '../users/users.service';
import { UsersNotifyController } from '../users/users-notify.controller';
import { ViewingsController } from './viewings.controller';
import { ViewingsService } from './viewings.service';

// FE-35: link Duyệt / Đổi giờ và nơi n8n lấy kênh thông báo. Chỉ chạy trên PostgreSQL tạm, giống FE-33.
const url = process.env.FE33_TEST_DATABASE_URL;
(url ? describe : describe.skip)('FE-35: link nhân viên và kênh thông báo (PostgreSQL thật)', () => {
  let db: DataSource;
  let intake: LeadIntakeService;
  let webhooks: { path: string; payload: any }[];
  let n8nFails = false;
  let app: any;
  let http: any;
  let sale: User;
  const secret = 'fe35-local-webhook-test';
  let previousSecret: string | undefined;

  beforeAll(async () => {
    const target = new URL(url!);
    if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/fe33_test') {
      throw new Error('Chỉ dùng DB tạm localhost:55433/fe33_test');
    }
    db = new DataSource({ type: 'postgres', url, synchronize: true, entities: [Lead, LeadEvent, User, Property, Viewing, ChatLog] });
    await db.initialize();
    webhooks = [];
    const n8n = {
      callWebhook: async (path: string, payload: any) => {
        if (n8nFails) throw new Error('n8n down');
        webhooks.push({ path, payload });
      },
    } as any;
    const leads = new LeadsService(db.getRepository(Lead), db.getRepository(LeadEvent), db.getRepository(Viewing), db.getRepository(Property), n8n);
    intake = new LeadIntakeService(db.getRepository(Lead));
    const viewings = new ViewingsService(
      db.getRepository(Viewing), db.getRepository(Lead), db.getRepository(Property), {} as any, leads, n8n, intake,
    );
    const users = new UsersService(db.getRepository(User));
    @Module({
      imports: [ThrottlerModule.forRoot({ throttlers: [{ name: 'booking', ttl: 1000, limit: 1000 }] })],
      controllers: [ViewingsController, UsersNotifyController],
      providers: [
        { provide: ViewingsService, useValue: viewings },
        { provide: ChatLogsService, useValue: {} },
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: new JwtService({ secret: 'fe35-local-test-only' }) },
      ],
    })
    class HttpTestModule {}
    app = await NestFactory.create(HttpTestModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    previousSecret = process.env.WEBHOOK_SECRET;
    process.env.WEBHOOK_SECRET = secret;
  });
  afterAll(async () => {
    if (previousSecret === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = previousSecret;
    await app?.close();
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(async () => {
    webhooks.length = 0;
    n8nFails = false;
    await db.query('TRUNCATE leads, lead_events, users, properties, viewings, chat_logs RESTART IDENTITY');
    await db.getRepository(User).save({ name: 'Quản lý', email: 'manager@example.test', role: 'MANAGER', passwordHash: 'hash-must-not-leak' });
    sale = await db.getRepository(User).save({
      name: 'Sale An', email: 'an@example.test', role: 'SALE', passwordHash: 'hash-must-not-leak',
      telegramChatId: '123456789', pushToken: 'ExponentPushToken[abc123]',
    });
  });

  // Lead NEW, AI đã chấm, đúng một buổi xem NEW ở tương lai, giao cho sale
  async function booked(n = 1, hoursAhead = 48) {
    const { lead } = await intake.create({ name: `Khách ${n}`, phone: `090${String(n).padStart(7, '0')}`, source: 'direct', email: `k${n}@example.test`, assignedUserId: sale.id });
    await db.getRepository(Lead).update(lead.id, { status: 'NEW', automationStatus: 'COMPLETED', firstResponseAt: null });
    const property = await db.getRepository(Property).save({ name: 'Nhà test', address: '1 Lê Lợi', price: 3000000000, area: 50, type: 'HOUSE', status: 'AVAILABLE' });
    const viewing = await db.getRepository(Viewing).save({
      leadId: lead.id, propertyId: property.id, viewingTime: new Date(Date.now() + hoursAhead * 3600000), status: 'NEW',
    });
    return { lead, viewing, property };
  }
  const links = async (viewingId: number) =>
    (await request(http).post(`/api/viewings/${viewingId}/staff-links`).set('X-Webhook-Secret', secret).expect(200)).body as {
      approveUrl: string; rescheduleUrl: string;
    };
  const tokenOf = (u: string) => u.split('/duyet/')[1];

  it('notify-target: cần secret, trả kênh của người đó và không lộ mật khẩu', async () => {
    await request(http).get(`/api/users/${sale.id}/notify-target`).expect(401);
    const res = await request(http).get(`/api/users/${sale.id}/notify-target`).set('X-Webhook-Secret', secret).expect(200);
    expect(res.body).toEqual({ id: sale.id, name: 'Sale An', email: 'an@example.test', role: 'SALE', telegramChatId: '123456789', pushToken: 'ExponentPushToken[abc123]' });
    expect(JSON.stringify(res.body)).not.toContain('hash-must-not-leak');
    await request(http).get('/api/users/9999/notify-target').set('X-Webhook-Secret', secret).expect(404);
  });

  it('cấp link: cần secret, 404 khi buổi xem không tồn tại, link nằm dưới /duyet', async () => {
    const { viewing } = await booked();
    await request(http).post(`/api/viewings/${viewing.id}/staff-links`).expect(401);
    await request(http).post('/api/viewings/9999/staff-links').set('X-Webhook-Secret', secret).expect(404);
    const l = await links(viewing.id);
    expect(l.approveUrl).toContain('/duyet/');
    expect(tokenOf(l.approveUrl)).not.toBe(tokenOf(l.rescheduleUrl));
  });

  it('xem trước không đổi gì, không trả điện thoại/email; token bị sửa thì 404', async () => {
    const { viewing, lead } = await booked();
    const l = await links(viewing.id);
    const view = await request(http).get(`/api/viewings/staff-links/${tokenOf(l.approveUrl)}`).expect(200);
    expect(view.body).toMatchObject({ action: 'approve', leadName: lead.name, propertyName: 'Nhà test', canAct: true, refusal: null });
    const raw = JSON.stringify(view.body);
    expect(raw).not.toContain('k1@example.test');
    expect(raw).not.toContain('0900000001');
    expect(webhooks).toHaveLength(0);
    expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).status).toBe('NEW');
    const [body, sig] = tokenOf(l.approveUrl).split('.');
    const forged = Buffer.from(JSON.stringify({ v: viewing.id + 1, a: 'approve' })).toString('base64url');
    await request(http).get(`/api/viewings/staff-links/${forged}.${sig}`).expect(404);
    await request(http).post(`/api/viewings/staff-links/${forged}.${sig}/confirm`).expect(404);
    expect(body).toBeTruthy();
    expect(webhooks).toHaveLength(0);
  });

  it('duyệt sau 48 giờ vẫn được; gọi 1b đúng buổi xem, ghi phản hồi đầu tiên; bấm lại khi đã CONFIRMED thì từ chối', async () => {
    const { viewing, lead } = await booked(1, 72);
    await db.query(`UPDATE lead_events SET created_at = now() - interval '48 hours' WHERE lead_id = $1`, [lead.id]);
    const l = await links(viewing.id);
    const res = await request(http).post(`/api/viewings/staff-links/${tokenOf(l.approveUrl)}/confirm`).expect(200);
    expect(res.body).toMatchObject({ ok: true, action: 'approve' });
    expect(webhooks).toEqual([{ path: 'viewing-admin-action', payload: expect.objectContaining({ event: 'approved', leadId: lead.id, viewingId: viewing.id }) }]);
    expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).firstResponseAt).not.toBeNull();
    await db.getRepository(Lead).update(lead.id, { status: 'CONFIRMED' }); // việc luồng 1b làm
    const again = await request(http).post(`/api/viewings/staff-links/${tokenOf(l.approveUrl)}/confirm`).expect(400);
    expect(again.body.message).toMatch(/đã được duyệt/);
    expect(webhooks).toHaveLength(1);
  });

  it('từ chối khi AI chưa chấm, khách đã huỷ, qua giờ hẹn, hoặc đã có buổi xem mới hơn', async () => {
    const a = await booked(1);
    await db.getRepository(Lead).update(a.lead.id, { automationStatus: 'PENDING' });
    const la = await links(a.viewing.id);
    expect((await request(http).post(`/api/viewings/staff-links/${tokenOf(la.approveUrl)}/confirm`).expect(400)).body.message).toMatch(/AI chưa chấm/);

    const b = await booked(2);
    await db.getRepository(Viewing).update(b.viewing.id, { status: 'CANCELLED' });
    const lb = await links(b.viewing.id);
    expect((await request(http).post(`/api/viewings/staff-links/${tokenOf(lb.approveUrl)}/confirm`).expect(400)).body.message).toMatch(/huỷ/);

    const c = await booked(3);
    const lc = await links(c.viewing.id);
    await db.getRepository(Viewing).update(c.viewing.id, { viewingTime: new Date(Date.now() - 60000) });
    expect((await request(http).post(`/api/viewings/staff-links/${tokenOf(lc.approveUrl)}/confirm`).expect(400)).body.message).toMatch(/tới giờ hẹn/);

    const d = await booked(4);
    const ld = await links(d.viewing.id);
    await db.getRepository(Viewing).update(d.viewing.id, { status: 'CANCELLED' });
    await db.getRepository(Viewing).save({ leadId: d.lead.id, propertyId: d.property.id, viewingTime: new Date(Date.now() + 96 * 3600000), status: 'NEW' });
    expect((await request(http).post(`/api/viewings/staff-links/${tokenOf(ld.approveUrl)}/confirm`).expect(400)).body.message).toMatch(/huỷ|mới hơn/);

    const e = await booked(5);
    const second = await db.getRepository(Viewing).save({ leadId: e.lead.id, propertyId: e.property.id, viewingTime: new Date(Date.now() + 96 * 3600000), status: 'NEW' });
    const le = await links(e.viewing.id);
    expect((await request(http).post(`/api/viewings/staff-links/${tokenOf(le.approveUrl)}/confirm`).expect(400)).body.message).toMatch(/mới hơn/);
    expect(second.id).toBeGreaterThan(e.viewing.id);
    expect(webhooks).toHaveLength(0);
  });

  it('đổi giờ: gọi 1b với reschedule_requested, lead vẫn NEW, bấm lại trong 10 phút chỉ một lần', async () => {
    const { viewing, lead } = await booked();
    const l = await links(viewing.id);
    const first = await request(http).post(`/api/viewings/staff-links/${tokenOf(l.rescheduleUrl)}/confirm`).expect(200);
    expect(first.body).toMatchObject({ ok: true, action: 'reschedule' });
    expect(webhooks[0].payload).toMatchObject({ event: 'reschedule_requested', leadId: lead.id, viewingId: viewing.id });
    expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).status).toBe('NEW');
    // luồng 1b ghi sự kiện; mô phỏng bằng cách ghi trực tiếp
    await db.getRepository(LeadEvent).save({ leadId: lead.id, type: 'RESCHEDULE_REQUESTED', note: 'test' });
    const second = await request(http).post(`/api/viewings/staff-links/${tokenOf(l.rescheduleUrl)}/confirm`).expect(200);
    expect(second.body.already).toBe(true);
    expect(webhooks).toHaveLength(1);
  });

  it('n8n lỗi thì trả 502 và không ghi nhận phản hồi đầu tiên', async () => {
    const { viewing, lead } = await booked();
    const l = await links(viewing.id);
    n8nFails = true;
    await request(http).post(`/api/viewings/staff-links/${tokenOf(l.approveUrl)}/confirm`).expect(502);
    expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).firstResponseAt).toBeNull();
  });
});
