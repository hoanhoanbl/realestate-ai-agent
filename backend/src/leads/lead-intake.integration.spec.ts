import {
  ConflictException,
  ForbiddenException,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { LeadIntakeService } from './lead-intake.service';
import { UsersService } from '../users/users.service';
import type { AuthUser } from '../auth/auth.types';
import { ViewingsService } from '../viewings/viewings.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { UsersController } from '../users/users.controller';

// Chỉ chạy khi bật rõ ràng, trên PostgreSQL tạm riêng. Không dùng .env/database đang chạy.
const databaseUrl = process.env.FE33_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
integration(
  'FE-33: PostgreSQL thật, transaction và chia sale đồng thời',
  () => {
    let db: DataSource;
    let service: LeadIntakeService;
    let users: UsersService;
    let manager: AuthUser;
    let sales: User[];
    const input = (n: number) => ({
      name: `Khách ${n}`,
      phone: `090${String(n).padStart(7, '0')}`,
      source: 'telegram',
    });

    beforeAll(async () => {
      const target = new URL(databaseUrl!);
      if (
        !['localhost', '127.0.0.1'].includes(target.hostname) ||
        target.port !== '55433' ||
        target.pathname !== '/fe33_test'
      ) {
        throw new Error('Chỉ được chạy trên localhost:55433/fe33_test');
      }
      db = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        synchronize: true,
        entities: [Lead, LeadEvent, User, Property, Viewing, ChatLog],
      });
      await db.initialize();
      service = new LeadIntakeService(db.getRepository(Lead));
      users = new UsersService(db.getRepository(User));
    });
    afterAll(async () => {
      if (db?.isInitialized) await db.destroy();
    });
    beforeEach(async () => {
      await db.query(
        'TRUNCATE leads, lead_events, users, properties, viewings, chat_logs RESTART IDENTITY',
      );
      const repo = db.getRepository(User);
      const saved = await repo.save(
        repo.create({
          name: 'Quản lý',
          email: 'manager@example.test',
          role: 'MANAGER',
          passwordHash: 'test',
        }),
      );
      manager = {
        id: saved.id,
        name: saved.name,
        email: saved.email,
        role: saved.role,
      };
      sales = await repo.save(
        [1, 2, 3].map((n) =>
          repo.create({
            name: `Sale ${n}`,
            email: `sale${n}@example.test`,
            role: 'SALE',
            passwordHash: 'test',
          }),
        ),
      );
    });

    it('HTTP: guard, lookup trước :id, validation và hợp đồng JSON hoạt động cùng nhau', async () => {
      const jwt = new JwtService({ secret: 'fe33-local-test-only' });
      @Module({
        controllers: [LeadsController, UsersController],
        providers: [
          { provide: LeadIntakeService, useValue: service },
          { provide: LeadsService, useValue: {} },
          { provide: UsersService, useValue: users },
          { provide: JwtService, useValue: jwt },
        ],
      })
      class HttpTestModule {}
      const app = await NestFactory.create(HttpTestModule, { logger: false });
      app.setGlobalPrefix('api');
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, transform: true }),
      );
      await app.init();
      const token = await jwt.signAsync({ sub: manager.id, ...manager });
      const saleToken = await jwt.signAsync({ sub: sales[0].id, ...sales[0] });
      const previousSecret = process.env.WEBHOOK_SECRET;
      process.env.WEBHOOK_SECRET = 'fe33-local-webhook-test';
      try {
        const http = app.getHttpServer();
        await request(http)
          .get('/api/leads/lookup?phone=0900000001')
          .expect(401);
        await request(http)
          .get('/api/leads/lookup?phone=0900000001')
          .auth(token, { type: 'bearer' })
          .expect(200, { lead: null });
        await request(http)
          .post('/api/leads')
          .auth(token, { type: 'bearer' })
          .send({ name: 'Thiếu số' })
          .expect(400);
        const created = await request(http)
          .post('/api/leads')
          .auth(token, { type: 'bearer' })
          .send(input(1))
          .expect(201);
        expect(created.body).toMatchObject({
          created: true,
          lead: { assignedUserId: manager.id, email: null },
        });
        await request(http)
          .post('/api/leads')
          .auth(token, { type: 'bearer' })
          .send(input(1))
          .expect(409);
        await request(http)
          .get('/api/leads/lookup')
          .query({ phone: '+84 900 000 001' })
          .auth(token, { type: 'bearer' })
          .expect(200)
          .expect((res) => expect(res.body.lead.id).toBe(created.body.lead.id));
        await request(http)
          .post('/api/leads/intake')
          .send(input(2))
          .expect(401);
        const received = await request(http)
          .post('/api/leads/intake')
          .set('X-Webhook-Secret', process.env.WEBHOOK_SECRET)
          .send(input(2))
          .expect(201);
        expect(received.body.lead.assignedUserId).toBe(sales[0].id);
        await request(http)
          .put(`/api/leads/${received.body.lead.id}/assignee`)
          .auth(saleToken, { type: 'bearer' })
          .send({ assignedUserId: sales[1].id })
          .expect(403);
        await request(http)
          .post(`/api/leads/${received.body.lead.id}/notes`)
          .auth(saleToken, { type: 'bearer' })
          .send({ note: 'Đã gọi' })
          .expect(201);
        await request(http)
          .get('/api/users/assignees')
          .auth(saleToken, { type: 'bearer' })
          .expect(200);
      } finally {
        if (previousSecret === undefined) delete process.env.WEBHOOK_SECRET;
        else process.env.WEBHOOK_SECRET = previousSecret;
        await app.close();
      }
    });

    it('nhận khách thiếu email/ngân sách, mặc định CONSULTING, có chủ và hạn phản hồi', async () => {
      const result = await service.create(input(1));
      expect(result).toMatchObject({
        created: true,
        reopened: false,
        lead: {
          email: null,
          budget: null,
          status: 'CONSULTING',
          assignedUserId: sales[0].id,
        },
      });
      expect(result.lead.responseDueAt!.getTime()).toBeGreaterThan(
        result.lead.assignedAt!.getTime(),
      );
      expect(await db.getRepository(LeadEvent).find()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'LEAD_CREATED' }),
          expect.objectContaining({ type: 'LEAD_ASSIGNED' }),
        ]),
      );
    });
    it('12 khách đồng thời được chia đều cho ba sale', async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, n) => service.create(input(n))),
      );
      for (const sale of sales)
        expect(
          results.filter((r) => r.lead.assignedUserId === sale.id),
        ).toHaveLength(4);
    });
    it('12 yêu cầu trùng số với nhiều định dạng chỉ tạo một khách, một lượt chia', async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, (_, n) =>
          service.create({
            ...input(1),
            phone: n % 2 ? '+84 900.000-001' : '0900000001',
          }),
        ),
      );
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(await db.getRepository(Lead).count()).toBe(1);
      expect(new Set(results.map((r) => r.lead.assignedUserId)).size).toBe(1);
      expect((await service.create(input(2))).lead.assignedUserId).toBe(
        sales[1].id,
      );
    });
    it('nhập tay mặc định người nhập và tính lượt; khách tiếp theo bỏ qua người vừa nhận', async () => {
      const actor = { ...manager, ...sales[0] } as AuthUser;
      expect((await service.create(input(1), actor)).lead.assignedUserId).toBe(
        sales[0].id,
      );
      expect((await service.create(input(2))).lead.assignedUserId).toBe(
        sales[1].id,
      );
    });
    it('khách cũ giữ thông tin, consent và sale, nhập tay trùng trả 409', async () => {
      const old = await service.create({
        ...input(1),
        consentMarketing: false,
      });
      const result = await service.create({
        ...input(1),
        name: 'Tên khác',
        email: 'other@example.test',
        consentMarketing: true,
      });
      expect(result).toMatchObject({
        created: false,
        lead: {
          id: old.lead.id,
          name: 'Khách 1',
          email: null,
          consentMarketing: false,
          assignedUserId: sales[0].id,
        },
      });
      await expect(service.create(input(1), manager)).rejects.toThrow(
        ConflictException,
      );
      expect(await service.lookup('+84 900 000 001')).toMatchObject({
        id: old.lead.id,
        assignedUserName: sales[0].name,
      });
    });
    it('nhận ra lead cũ chưa backfill; chọn id cũ nhất, không gộp/xoá lịch sử', async () => {
      const repo = db.getRepository(Lead);
      const old = await repo.save(
        repo.create({
          name: 'Khách cũ',
          phone: '+84 900.000-001',
          status: 'NEW',
        }),
      );
      await repo.save(
        repo.create({
          name: 'Bản ghi trùng cũ',
          phone: '0900000001',
          status: 'NEW',
        }),
      );
      expect((await service.create(input(1))).lead.id).toBe(old.id);
      expect(await repo.count()).toBe(2);
    });
    it('SQL nâng cấp chạy lặp được, chuẩn hoá số cũ mà không gộp hay đổi trạng thái', async () => {
      const repo = db.getRepository(Lead);
      const old = await repo.save(
        repo.create({
          name: 'Khách cũ',
          phone: '+84 900.000-001',
          status: 'SIGNED',
        }),
      );
      const sql = readFileSync(resolve('sql/fe-33-intake.sql'), 'utf8');
      await db.query(sql);
      await db.query(sql);
      expect(await repo.findOneByOrFail({ id: old.id })).toMatchObject({
        status: 'SIGNED',
        phoneNormalized: '0900000001',
        assignedUserId: null,
      });
    });
    it('khách LOST quay lại mở CONSULTING, giữ sale cũ đang nhận và đặt lại hạn', async () => {
      const { lead } = await service.create(input(1));
      await db.getRepository(Lead).update(lead.id, {
        status: 'LOST',
        lostReason: 'OTHER',
        firstResponseAt: new Date(),
      });
      const result = await service.create(input(1));
      expect(result).toMatchObject({
        reopened: true,
        lead: {
          status: 'CONSULTING',
          lostReason: null,
          firstResponseAt: null,
          assignedUserId: sales[0].id,
        },
      });
    });
    it('khách LOST chuyển sale khi sale cũ ngừng nhận; khách đang xử lý vẫn giữ chủ', async () => {
      const { lead } = await service.create(input(1));
      await users.updateRouting(
        sales[0].id,
        { acceptingLeads: false },
        manager,
      );
      expect((await service.create(input(1))).lead.assignedUserId).toBe(
        sales[0].id,
      );
      await db.getRepository(Lead).update(lead.id, { status: 'LOST' });
      expect((await service.create(input(1))).lead.assignedUserId).toBe(
        sales[1].id,
      );
    });
    it('bỏ qua sale nghỉ, không ai nhận thì giao quản lý; thiếu cả quản lý thì không lưu lead', async () => {
      await db
        .getRepository(User)
        .update({ role: 'SALE' }, { acceptingLeads: false });
      expect((await service.create(input(1))).lead.assignedUserId).toBe(
        manager.id,
      );
      await db.getRepository(User).delete(manager.id);
      await expect(service.create(input(2))).rejects.toThrow('Chưa có sale');
      expect(await db.getRepository(Lead).count()).toBe(1);
    });
    it('chuyển chủ chỉ dành cho quản lý, reset hạn và ghi tác giả; cùng chủ không gia hạn', async () => {
      const { lead } = await service.create(input(1));
      await expect(
        service.reassign(
          lead.id,
          { assignedUserId: sales[1].id },
          sales[0] as AuthUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      const note = await service.addNote(
        lead.id,
        'Đã gọi khách',
        sales[0] as AuthUser,
      );
      expect(note).toMatchObject({
        type: 'NOTE_ADDED',
        actorUserId: sales[0].id,
      });
      const first = (
        await db.getRepository(Lead).findOneByOrFail({ id: lead.id })
      ).firstResponseAt;
      expect(first).not.toBeNull();
      await service.addNote(lead.id, 'Gọi lần hai', sales[0] as AuthUser);
      expect(
        (await db.getRepository(Lead).findOneByOrFail({ id: lead.id }))
          .firstResponseAt,
      ).toEqual(first);
      expect(
        (
          await service.reassign(
            lead.id,
            { assignedUserId: sales[0].id },
            manager,
          )
        ).firstResponseAt,
      ).toEqual(first);
      expect(
        await service.reassign(
          lead.id,
          { assignedUserId: sales[1].id, note: 'Sale nghỉ' },
          manager,
        ),
      ).toMatchObject({ assignedUserId: sales[1].id, firstResponseAt: null });
      expect(
        await db
          .getRepository(LeadEvent)
          .findOneBy({ type: 'LEAD_REASSIGNED' }),
      ).toMatchObject({ actorUserId: manager.id });
    });
    it('sale khác không ghi chú/sửa routing, không chuyển cho sale đang tắt', async () => {
      const { lead } = await service.create(input(1));
      await expect(
        service.addNote(lead.id, 'Ghi sai khách', sales[1] as AuthUser),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        users.updateRouting(
          sales[1].id,
          { acceptingLeads: false },
          sales[0] as AuthUser,
        ),
      ).rejects.toThrow(ForbiddenException);
      await users.updateRouting(
        sales[1].id,
        { acceptingLeads: false },
        manager,
      );
      await expect(
        service.reassign(lead.id, { assignedUserId: sales[1].id }, manager),
      ).rejects.toThrow('ngừng nhận');
      expect((await users.findAssignees())[0]).not.toHaveProperty(
        'passwordHash',
      );
      expect((await users.findAssignees())[0]).not.toHaveProperty('pushToken');
    });
    it('rollback xoá cả lead, nhật ký và lượt chia khi giao dịch tạo buổi xem thất bại', async () => {
      await expect(
        db.transaction(async (em) => {
          await service.receive(em, input(1));
          throw new Error('lịch không lưu được');
        }),
      ).rejects.toThrow('lịch không lưu được');
      expect(await db.getRepository(Lead).count()).toBe(0);
      expect(await db.getRepository(LeadEvent).count()).toBe(0);
      expect((await service.create(input(2))).lead.assignedUserId).toBe(
        sales[0].id,
      );
    });
    it('intake khách cũ giữ ghi chú mới mà không ghi nhận khách tự nhắn là sale đã phản hồi', async () => {
      const { lead } = await service.create(input(1));
      const result = await service.create({
        ...input(1),
        note: 'Khách muốn được gọi vào ngày mai',
      });
      expect(result).toMatchObject({
        created: false,
        lead: {
          id: lead.id,
          assignedUserId: lead.assignedUserId,
          firstResponseAt: null,
        },
      });
      expect(
        await db
          .getRepository(LeadEvent)
          .findOneBy({ leadId: lead.id, type: 'NOTE_ADDED' }),
      ).toMatchObject({
        note: 'Khách muốn được gọi vào ngày mai',
        actorUserId: null,
      });
      await db.getRepository(Lead).update(lead.id, { status: 'LOST' });
      expect(
        (await service.create({ ...input(1), note: 'Khách quay lại hỏi giá' }))
          .reopened,
      ).toBe(true);
      expect(
        await db
          .getRepository(LeadEvent)
          .countBy({ leadId: lead.id, type: 'NOTE_ADDED' }),
      ).toBe(2);
    });

    it('callback n8n duyệt/đổi giờ cập nhật phản hồi; tự động nhắc lịch không cập nhật', async () => {
      const leads = new LeadsService(
        db.getRepository(Lead),
        db.getRepository(LeadEvent),
        db.getRepository(Viewing),
        db.getRepository(Property),
        {} as any,
      );
      const { lead } = await service.create(input(1));
      await leads.addEvent(lead.id, { type: 'REMINDER_SENT' });
      expect((await leads.findOne(lead.id)).firstResponseAt).toBeNull();
      await db.getRepository(Lead).update(lead.id, { status: 'NEW' });
      const confirmed = await leads.updateStatus(lead.id, {
        status: 'CONFIRMED',
      });
      expect(confirmed.firstResponseAt).toBeInstanceOf(Date);
      await leads.addEvent(lead.id, { type: 'APPROVED' });
      expect((await leads.findOne(lead.id)).firstResponseAt).toEqual(
        confirmed.firstResponseAt,
      );
      const other = await service.create(input(2));
      const rescheduled = await leads.addEvent(other.lead.id, {
        type: 'RESCHEDULE_REQUESTED',
      });
      expect((await leads.findOne(other.lead.id)).firstResponseAt).toEqual(
        rescheduled.createdAt,
      );
    });

    it('hồ sơ CONSULTING đặt buổi xem đầu tiên: giữ lead/sale, bổ sung thông tin thiếu, gọi workflow', async () => {
      const { lead } = await service.create({ ...input(1), source: 'hotline' });
      const property = await db
        .getRepository(Property)
        .save({
          name: 'Nhà test',
          address: 'HCM',
          price: 3000000000,
          area: 50,
          type: 'HOUSE',
          status: 'AVAILABLE',
        });
      const viewings = new ViewingsService(
        db.getRepository(Viewing),
        db.getRepository(Lead),
        db.getRepository(Property),
        {} as any,
        {} as any,
        {} as any,
        service,
      );
      const trigger = jest
        .spyOn(viewings as any, 'triggerN8nWebhook')
        .mockResolvedValue(undefined);
      const dto = {
        ...input(1),
        phone: '+84 900 000 001',
        email: 'customer@example.test',
        budget: 3000000000,
        needs: 'Gần trường học',
        consentMarketing: true,
        propertyId: property.id,
        viewingTime: '2090-11-12T10:00:00+07:00',
      };
      const first = await viewings.create(dto);
      expect(first.lead).toMatchObject({
        id: lead.id,
        assignedUserId: lead.assignedUserId,
        status: 'NEW',
        source: 'hotline',
        email: dto.email,
        needs: dto.needs,
        consentMarketing: false,
        firstResponseAt: null,
      });
      expect(Number(first.lead.budget)).toBe(dto.budget);
      expect(first.lead.assignedAt).toEqual(lead.assignedAt);
      expect(first.lead.responseDueAt).toEqual(lead.responseDueAt);
      expect(first.lead.interestedPropertyIds).toContain(property.id);
      expect(await db.getRepository(Lead).count()).toBe(1);
      expect(first.viewing.leadId).toBe(lead.id);
      expect(trigger).toHaveBeenCalledTimes(1);
      await expect(
        viewings.create({ ...dto, viewingTime: '2090-11-13T10:00:00+07:00' }),
      ).rejects.toThrow(ConflictException);
      expect(await db.getRepository(Viewing).count()).toBe(1);
    });

    it('hai yêu cầu đặt buổi đầu đồng thời không tạo hai lịch hoặc hai lead', async () => {
      const { lead } = await service.create(input(1));
      const properties = await db
        .getRepository(Property)
        .save(
          [1, 2].map((n) => ({
            name: `Nhà ${n}`,
            address: 'HCM',
            price: 3000000000,
            area: 50,
            type: 'HOUSE',
            status: 'AVAILABLE',
          })),
        );
      const viewings = new ViewingsService(
        db.getRepository(Viewing),
        db.getRepository(Lead),
        db.getRepository(Property),
        {} as any,
        {} as any,
        {} as any,
        service,
      );
      jest
        .spyOn(viewings as any, 'triggerN8nWebhook')
        .mockResolvedValue(undefined);
      const results = await Promise.allSettled(
        properties.map((property) =>
          viewings.create({
            ...input(1),
            email: 'customer@example.test',
            budget: 3000000000,
            propertyId: property.id,
            viewingTime: '2090-11-12T10:00:00+07:00',
          }),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      expect(await db.getRepository(Viewing).countBy({ leadId: lead.id })).toBe(
        1,
      );
      expect(await db.getRepository(Lead).count()).toBe(1);
    });

    it('đặt buổi đầu thất bại rollback hồ sơ cũ và ghi chú về trạng thái tư vấn ban đầu', async () => {
      const { lead } = await service.create(input(1));
      await expect(
        db.transaction(async (em) => {
          await service.receive(
            em,
            {
              ...input(1),
              email: 'new@example.test',
              note: 'Không được lưu khi rollback',
            },
            { firstViewingOnly: true },
          );
          throw new Error('Lưu lịch thất bại');
        }),
      ).rejects.toThrow('Lưu lịch thất bại');
      expect(
        await db.getRepository(Lead).findOneByOrFail({ id: lead.id }),
      ).toMatchObject({
        status: 'CONSULTING',
        email: null,
        eventId: lead.eventId,
      });
      expect(
        await db.getRepository(LeadEvent).countBy({ type: 'NOTE_ADDED' }),
      ).toBe(0);
    });

    it('đường đặt lịch cũ dùng chung intake; chặn khách trùng mà không gọi workflow/ghi lịch thứ hai', async () => {
      const property = await db.getRepository(Property).save({
        name: 'Nhà test',
        address: 'HCM',
        price: 3000000000,
        area: 50,
        type: 'HOUSE',
        status: 'AVAILABLE',
      });
      const viewings = new ViewingsService(
        db.getRepository(Viewing),
        db.getRepository(Lead),
        db.getRepository(Property),
        {} as any,
        {} as any,
        {} as any,
        service,
      );
      const trigger = jest
        .spyOn(viewings as any, 'triggerN8nWebhook')
        .mockResolvedValue(undefined);
      const dto = {
        ...input(1),
        email: 'a@example.test',
        budget: 3000000000,
        propertyId: property.id,
        viewingTime: '2090-11-12T10:00:00+07:00',
      };
      const first = await viewings.create(dto);
      expect(first.lead).toMatchObject({
        status: 'NEW',
        assignedUserId: sales[0].id,
        phoneNormalized: '0900000001',
      });
      await expect(
        viewings.create({
          ...dto,
          phone: '+84 900 000 001',
          viewingTime: '2090-11-13T10:00:00+07:00',
        }),
      ).rejects.toThrow(ConflictException);
      expect(await db.getRepository(Lead).count()).toBe(1);
      expect(await db.getRepository(Viewing).count()).toBe(1);
      expect(trigger).toHaveBeenCalledTimes(1);
    });
  },
);
