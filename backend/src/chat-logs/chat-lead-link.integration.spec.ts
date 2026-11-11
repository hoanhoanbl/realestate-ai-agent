import { Module, NotFoundException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ChatLog } from './chat-log.entity';
import { ChatLogsController } from './chat-logs.controller';
import { ChatLogsService } from './chat-logs.service';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { LeadIntakeService } from '../leads/lead-intake.service';
import { LeadsController } from '../leads/leads.controller';
import { LeadsService } from '../leads/leads.service';
import { ViewingsController } from '../viewings/viewings.controller';
import { ViewingsService } from '../viewings/viewings.service';

// Cùng điều kiện với bộ FE-33: chỉ chạy trên PostgreSQL tạm localhost:55433/fe33_test
const databaseUrl = process.env.FE33_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('FE-36: gắn lịch sử chat Telegram vào lead (PostgreSQL thật)', () => {
  let db: DataSource;
  let chatLogs: ChatLogsService;
  let intake: LeadIntakeService;
  let app: Awaited<ReturnType<typeof NestFactory.create>>;
  let token: string;
  const SECRET = 'fe36-local-webhook-test';
  const previousSecret = process.env.WEBHOOK_SECRET;
  const person = (n: number) => ({ name: `Khách ${n}`, phone: `090${String(n).padStart(7, '0')}`, source: 'telegram' });
  const booking = {
    name: 'Khách đặt lịch', email: 'dat@example.test', phone: '0900000077', budget: 1, propertyId: 1,
    viewingTime: '2030-01-01T10:00:00+07:00',
  };
  const log = (chatId: string, question = 'hỏi') =>
    chatLogs.create({ chatId, route: 'AGENT', question, reply: 'đáp' });
  const leadIdsOf = async (chatId: string) =>
    (await db.query('SELECT lead_id FROM chat_logs WHERE chat_id = $1 ORDER BY id', [chatId])).map(
      (r: { lead_id: number | null }) => r.lead_id,
    );

  beforeAll(async () => {
    const target = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/fe33_test') {
      throw new Error('Chỉ được chạy trên localhost:55433/fe33_test');
    }
    db = new DataSource({
      type: 'postgres', url: databaseUrl, synchronize: true,
      entities: [Lead, LeadEvent, User, Property, Viewing, ChatLog],
    });
    await db.initialize();
    chatLogs = new ChatLogsService(db.getRepository(ChatLog));
    intake = new LeadIntakeService(db.getRepository(Lead));
    const jwt = new JwtService({ secret: 'fe36-local-test-only' });
    // Đặt lịch thật cần n8n/HTTP: dùng bản thay chỉ tạo lead qua intake, đủ kiểm quy tắc secret của controller
    const bookingStub = {
      create: async () => {
        const { lead } = await intake.create({ ...person(77), email: 'a@example.test', budget: 1 });
        return { viewing: { id: 1 }, lead };
      },
    };
    const leadsStub = {
      findOne: async (id: number) => {
        const lead = await db.getRepository(Lead).findOneBy({ id });
        if (!lead) throw new NotFoundException();
        return lead;
      },
    };
    @Module({
      imports: [ThrottlerModule.forRoot({ throttlers: [{ name: 'booking', ttl: 600000, limit: 1000 }] })],
      controllers: [LeadsController, ViewingsController, ChatLogsController],
      providers: [
        { provide: LeadIntakeService, useValue: intake },
        { provide: LeadsService, useValue: leadsStub },
        { provide: ViewingsService, useValue: bookingStub },
        { provide: ChatLogsService, useValue: chatLogs },
        { provide: JwtService, useValue: jwt },
      ],
    })
    class HttpTestModule {}
    process.env.WEBHOOK_SECRET = SECRET;
    app = await NestFactory.create(HttpTestModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    token = await jwt.signAsync({ sub: 1, id: 1, role: 'MANAGER', name: 'Quản lý', email: 'm@example.test' });
  });
  afterAll(async () => {
    if (previousSecret === undefined) delete process.env.WEBHOOK_SECRET;
    else process.env.WEBHOOK_SECRET = previousSecret;
    await app?.close();
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(async () => {
    await db.query('TRUNCATE leads, lead_events, users, properties, viewings, chat_logs RESTART IDENTITY');
    const repo = db.getRepository(User);
    await repo.save(repo.create({ name: 'Quản lý', email: 'manager@example.test', role: 'MANAGER', passwordHash: 'test' }));
  });

  const post = (path: string) => request(app.getHttpServer()).post(path);
  const intakeWith = (body: object, secret = true) => {
    const r = post('/api/leads/intake');
    return (secret ? r.set('X-Webhook-Secret', SECRET) : r).send(body);
  };

  it('6 log rồi để lại số: cả 6 log thuộc lead; chat khác không bị gắn', async () => {
    for (let i = 0; i < 6; i++) await log('chat-1', `câu ${i}`);
    await log('chat-2');
    const res = await intakeWith({ ...person(1), chatId: 'chat-1' }).expect(201);
    expect(await leadIdsOf('chat-1')).toEqual(Array(6).fill(res.body.lead.id));
    expect(await leadIdsOf('chat-2')).toEqual([null]);
  });

  it('log mới của chat đã gắn tự theo lead', async () => {
    await log('chat-1');
    const res = await intakeWith({ ...person(1), chatId: 'chat-1' }).expect(201);
    await log('chat-1');
    expect(await leadIdsOf('chat-1')).toEqual([res.body.lead.id, res.body.lead.id]);
  });

  it('chat đã gắn lead A, liên hệ mới tạo lead B: log cũ vẫn ở A', async () => {
    await log('chat-1');
    const a = await intakeWith({ ...person(1), chatId: 'chat-1' }).expect(201);
    const b = await intakeWith({ ...person(2), chatId: 'chat-1' }).expect(201);
    expect(b.body.lead.id).not.toBe(a.body.lead.id);
    expect(await leadIdsOf('chat-1')).toEqual([a.body.lead.id]);
  });

  // Quyết định (đã sửa spec): chat theo lead đầu tiên; liên hệ thứ hai không chuyển chat sang lead mới
  it('chat đã gắn lead A, liên hệ mới tạo lead B: log viết sau vẫn theo A', async () => {
    await log('chat-1');
    const a = await intakeWith({ ...person(1), chatId: 'chat-1' }).expect(201);
    await intakeWith({ ...person(2), chatId: 'chat-1' }).expect(201);
    await log('chat-1');
    expect(await leadIdsOf('chat-1')).toEqual([a.body.lead.id, a.body.lead.id]);
  });

  // Đúng dạng body mà công cụ "Lưu liên hệ khách" của luồng 6 gửi (chatId là chuỗi, needs có thể rỗng)
  const toolBody = (phone: string, needs = '') => ({ name: 'Bình', phone, needs, source: 'telegram', chatId: '555' });

  it('body của công cụ n8n: tạo lead không consent, gắn chat; số trùng khác định dạng dùng lại lead và không đổi chủ', async () => {
    await log('555', 'cho mình xin tư vấn');
    const first = await intakeWith(toolBody('0901 234 567')).expect(201);
    expect(first.body).toMatchObject({ created: true, lead: { source: 'telegram', consentMarketing: false, status: 'CONSULTING' } });
    expect(await leadIdsOf('555')).toEqual([first.body.lead.id]);
    const again = await intakeWith({ ...toolBody('+84 901-234-567', 'căn 2PN'), name: 'Tên khác' }).expect(201);
    expect(again.body.created).toBe(false);
    expect(again.body.lead.id).toBe(first.body.lead.id);
    expect(again.body.lead.name).toBe('Bình');
    expect(again.body.lead.assignedUserId).toBe(first.body.lead.assignedUserId);
    expect(await db.query('SELECT count(*)::int AS n FROM leads')).toEqual([{ n: 1 }]);
  });

  it('số điện thoại sai ("09012"): 400, không tạo lead, không gắn chat', async () => {
    await log('555');
    await intakeWith(toolBody('09012')).expect(400);
    expect(await db.query('SELECT count(*)::int AS n FROM leads')).toEqual([{ n: 0 }]);
    expect(await leadIdsOf('555')).toEqual([null]);
  });

  it('POST /leads (JWT) bỏ qua chatId trong body', async () => {
    await log('chat-1');
    await post('/api/leads').auth(token, { type: 'bearer' }).send({ ...person(3), chatId: 'chat-1' }).expect(201);
    expect(await leadIdsOf('chat-1')).toEqual([null]);
  });

  it('đặt lịch có secret và chatId thì gắn; không có secret thì đặt bình thường nhưng không gắn', async () => {
    await log('chat-1');
    await post('/api/viewings').send({ ...booking, chatId: 'chat-1' }).expect(201);
    expect(await leadIdsOf('chat-1')).toEqual([null]);
    await db.query('TRUNCATE leads, lead_events, viewings RESTART IDENTITY CASCADE');
    const res = await post('/api/viewings').set('X-Webhook-Secret', SECRET).send({ ...booking, chatId: 'chat-1' }).expect(201);
    expect(await leadIdsOf('chat-1')).toEqual([res.body.lead.id]);
  });

  it('GET /leads/:id/chat-logs: 401 khi chưa đăng nhập, 404 lead lạ, danh sách cũ trước không lộ chatId/executionId', async () => {
    await chatLogs.create({ chatId: 'chat-1', route: 'AGENT', question: 'gọi tôi 0901234567', reply: 'ok', executionId: 'exec-9', escalated: true });
    await log('chat-1', 'câu hai');
    const lead = await intakeWith({ ...person(1), chatId: 'chat-1' }).expect(201);
    const url = `/api/leads/${lead.body.lead.id}/chat-logs`;
    await request(app.getHttpServer()).get(url).expect(401);
    await request(app.getHttpServer()).get('/api/leads/9999/chat-logs').auth(token, { type: 'bearer' }).expect(404);
    const res = await request(app.getHttpServer()).get(url).auth(token, { type: 'bearer' }).expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ question: 'gọi tôi [số]', escalated: true, route: 'AGENT' });
    expect(res.body[1].question).toBe('câu hai');
    expect(JSON.stringify(res.body)).not.toMatch(/chatId|chat-1|executionId|exec-9/);
  });

  it('giới hạn 200 log mới nhất, vẫn xếp cũ trước', async () => {
    const lead = await intakeWith({ ...person(1) }).expect(201);
    await db.query(
      `INSERT INTO chat_logs (lead_id, channel, chat_id, route, question, reply)
       SELECT $1, 'telegram', 'chat-9', 'AGENT', 'q' || g, 'r' FROM generate_series(1, 230) g`,
      [lead.body.lead.id],
    );
    const res = await request(app.getHttpServer())
      .get(`/api/leads/${lead.body.lead.id}/chat-logs`).auth(token, { type: 'bearer' }).expect(200);
    expect(res.body).toHaveLength(200);
    expect(res.body[0].question).toBe('q31');
    expect(res.body[199].question).toBe('q230');
  });
});
