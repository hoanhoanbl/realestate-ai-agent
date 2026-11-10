import {
  ConflictException,
  ForbiddenException,
  Module,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { of } from 'rxjs';
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
import { bookableSlots, vnDateKey } from '../viewings/viewing-time';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { UsersController } from '../users/users.controller';

// Chỉ chạy khi bật rõ ràng, trên PostgreSQL tạm riêng. Không dùng .env/database đang chạy.
const databaseUrl = process.env.FE33_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
// Khung giờ khách đặt được (FE-34): chỉ số 0 là khung sớm nhất, mỗi 12 khung xấp xỉ một ngày
const slotIso = (n: number) => bookableSlots(new Date())[n].toISOString();
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
        viewingTime: slotIso(0),
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
        viewings.create({ ...dto, viewingTime: slotIso(12) }),
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
            viewingTime: slotIso(0),
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
            { booking: true },
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
        viewingTime: slotIso(0),
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
          viewingTime: slotIso(12),
        }),
      ).rejects.toThrow(ConflictException);
      expect(await db.getRepository(Lead).count()).toBe(1);
      expect(await db.getRepository(Viewing).count()).toBe(1);
      expect(trigger).toHaveBeenCalledTimes(1);
    });

    describe('FE-34: giờ hẹn bị từ chối thì không lưu gì', () => {
      const setup = async () => {
        const property = await db.getRepository(Property).save({
          name: 'Nhà test', address: 'HCM', price: 3000000000, area: 50, type: 'HOUSE', status: 'AVAILABLE',
        });
        const viewings = new ViewingsService(
          db.getRepository(Viewing), db.getRepository(Lead), db.getRepository(Property),
          {} as any, {} as any, {} as any, service,
        );
        const trigger = jest.spyOn(viewings as any, 'triggerN8nWebhook').mockResolvedValue(undefined);
        const day = vnDateKey(bookableSlots(new Date())[12]);
        const dto = { ...input(1), email: 'a@example.test', budget: 3000000000, propertyId: property.id };
        return { property, viewings, trigger, day, dto };
      };
      const nothingSaved = async () => {
        expect(await db.getRepository(Lead).count()).toBe(0);
        expect(await db.getRepository(Viewing).count()).toBe(0);
        expect(await db.getRepository(LeadEvent).count()).toBe(0);
      };

      it('đặt lúc 03:00 bị từ chối 400, không tạo lead, buổi xem hay sự kiện', async () => {
        const { viewings, trigger, day, dto } = await setup();
        await expect(viewings.create({ ...dto, viewingTime: `${day}T03:00:00+07:00` })).rejects.toThrow(/08:00–19:00/);
        await nothingSaved();
        expect(trigger).not.toHaveBeenCalled();
      });

      it('bot đặt 10:30 bị từ chối vì không tròn giờ, không lưu gì', async () => {
        const { viewings, trigger, day, dto } = await setup();
        await expect(viewings.create({ ...dto, viewingTime: `${day}T10:30:00+07:00` })).rejects.toThrow(/tròn giờ/);
        await nothingSaved();
        expect(trigger).not.toHaveBeenCalled();
      });

      it('nhân viên đổi giờ sang 20:00 bị từ chối, giờ cũ giữ nguyên', async () => {
        const { viewings, day, dto } = await setup();
        const { viewing, lead } = await viewings.create({ ...dto, viewingTime: slotIso(0) });
        const before = viewing.viewingTime;
        await expect(
          (viewings as any).reschedule(viewing, lead, `${day}T20:00:00+07:00`, manager),
        ).rejects.toThrow(/08:00–19:00/);
        const saved = await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id });
        expect(saved.viewingTime).toEqual(before);
        expect(await db.getRepository(LeadEvent).countBy({ type: 'VIEWING_RESCHEDULED' })).toBe(0);
      });

      it('danh sách khung: khung đã có người hẹn bị đánh dấu kín, khung kề sau 60 phút còn trống, không lộ dữ liệu khách', async () => {
        const { property, viewings } = await setup();
        const { lead } = await service.create({ ...input(1), email: 'secret@example.test' });
        await db.getRepository(Lead).update(lead.id, { status: 'CONFIRMED' });
        await db.getRepository(Viewing).save({
          propertyId: property.id, leadId: lead.id, status: 'NEW',
          viewingTime: new Date('2026-11-11T09:00:00+07:00'),
        });
        const now = new Date('2026-11-10T09:00:00+07:00');
        const result = await viewings.getSlots(property.id, now);
        const find = (date: string, time: string) =>
          result.days.find((d) => d.date === date)!.slots.find((s) => s.time === time)!;
        expect(result.days[0].date).toBe('2026-11-10');
        expect(result.days[0].slots[0].time).toBe('12:00');
        expect(find('2026-11-11', '09:00').available).toBe(false);
        expect(find('2026-11-11', '08:00').available).toBe(true);
        expect(find('2026-11-11', '10:00').available).toBe(true);
        expect(find('2026-11-10', '12:00').available).toBe(true);
        const text = JSON.stringify(result);
        expect(text).not.toMatch(/secret@example|Khách 1|0900000001|leadId/);
      });

      it('buổi xem đã kết thúc hoặc của khách đã đóng không chiếm khung', async () => {
        const { property, viewings } = await setup();
        const { lead } = await service.create(input(1));
        await db.getRepository(Viewing).save({
          propertyId: property.id, leadId: lead.id, status: 'CANCELLED',
          viewingTime: new Date('2026-11-11T09:00:00+07:00'),
        });
        const result = await viewings.getSlots(property.id, new Date('2026-11-10T09:00:00+07:00'));
        const slot = result.days.find((d) => d.date === '2026-11-11')!.slots.find((s) => s.time === '09:00')!;
        expect(slot.available).toBe(true);
      });

      it('căn đang giữ cọc hoặc ẩn trả 400, căn không tồn tại trả 404', async () => {
        const { property, viewings } = await setup();
        await db.getRepository(Property).update(property.id, { status: 'RESERVED' });
        await expect(viewings.getSlots(property.id)).rejects.toThrow('Căn nhà này hiện không nhận đặt lịch xem');
        await expect(viewings.getSlots(9999)).rejects.toThrow(/not found/);
      });

      // Khách đã có một buổi xem căn A: status là trạng thái buổi xem, lead là trạng thái lead
      const leadWithViewing = async (propertyId: number, leadStatus: string, viewingStatus: string) => {
        const { lead } = await service.create({ ...input(1), email: 'a@example.test', budget: 3000000000 });
        await db.getRepository(Lead).update(lead.id, { status: leadStatus });
        const viewing = await db.getRepository(Viewing).save({
          propertyId, leadId: lead.id, status: viewingStatus,
          viewingTime: new Date(Date.now() - 86400000),
        });
        return { lead, viewing };
      };
      const otherProperty = () =>
        db.getRepository(Property).save({
          name: 'Nhà B', address: 'HCM', price: 2000000000, area: 40, type: 'HOUSE', status: 'AVAILABLE',
        });

      it('khách đã xem căn A đặt căn B: buổi xem mới trên cùng lead, lead về NEW, buổi xem cũ giữ nguyên', async () => {
        const { property, viewings, trigger, dto } = await setup();
        const propertyB = await otherProperty();
        const { lead, viewing } = await leadWithViewing(property.id, 'VIEWED', 'ATTENDED');
        const result = await viewings.create({ ...dto, propertyId: propertyB.id, viewingTime: slotIso(0) });
        expect(result.lead.id).toBe(lead.id);
        expect(result.lead).toMatchObject({ status: 'NEW', automationStatus: 'PENDING' });
        expect(result.lead.eventId).not.toBe(lead.eventId);
        expect(await db.getRepository(Lead).count()).toBe(1);
        expect(await db.getRepository(Viewing).countBy({ leadId: lead.id })).toBe(2);
        expect((await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id })).status).toBe('ATTENDED');
        const moved = await db.getRepository(LeadEvent).findOneByOrFail({ leadId: lead.id, type: 'STATUS_CHANGED' });
        expect(moved.note).toContain('VIEWED -> NEW');
        expect(trigger).toHaveBeenCalledTimes(1);
      });

      it('khách đã đóng LOST đặt lại: mở lại lead, xoá lý do, có buổi xem mới', async () => {
        const { property, viewings, dto } = await setup();
        const { lead } = await leadWithViewing(property.id, 'LOST', 'CANCELLED');
        await db.getRepository(Lead).update(lead.id, { lostReason: 'CUSTOMER_CANCELLED' });
        const result = await viewings.create({ ...dto, viewingTime: slotIso(0) });
        expect(result.lead).toMatchObject({ id: lead.id, status: 'NEW', lostReason: null });
        expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'LEAD_REOPENED' })).toBe(1);
      });

      it('khách đang làm hợp đồng cọc (DEPOSIT, SIGNED) không tự đặt thêm, không lưu gì thêm', async () => {
        const { property, viewings, trigger, dto } = await setup();
        const propertyB = await otherProperty();
        const { lead } = await leadWithViewing(property.id, 'DEPOSIT', 'ATTENDED');
        for (const status of ['DEPOSIT', 'SIGNED']) {
          await db.getRepository(Lead).update(lead.id, { status });
          await expect(
            viewings.create({ ...dto, propertyId: propertyB.id, viewingTime: slotIso(0) }),
          ).rejects.toThrow(/hợp đồng đặt cọc/);
        }
        expect(await db.getRepository(Viewing).count()).toBe(1);
        expect(trigger).not.toHaveBeenCalled();
      });

      it('khách đang có buổi xem mở: 409 kèm giờ của buổi đó, không lưu gì thêm', async () => {
        const { viewings, trigger, dto } = await setup();
        const propertyB = await otherProperty();
        const first = await viewings.create({ ...dto, viewingTime: slotIso(0) });
        await expect(
          viewings.create({ ...dto, propertyId: propertyB.id, viewingTime: slotIso(12) }),
        ).rejects.toThrow(/Bạn đang có lịch xem lúc \d{2}:00 \d{2}\/\d{2}\/\d{4}/);
        expect(await db.getRepository(Viewing).countBy({ leadId: first.lead.id })).toBe(1);
        expect(trigger).toHaveBeenCalledTimes(1);
      });

      it('hai yêu cầu đặt thêm cùng lúc của khách đã xem chỉ tạo một buổi xem', async () => {
        const { property, viewings, dto } = await setup();
        const propertyB = await otherProperty();
        const { lead } = await leadWithViewing(property.id, 'VIEWED', 'ATTENDED');
        const results = await Promise.allSettled(
          [property.id, propertyB.id].map((propertyId, i) =>
            viewings.create({ ...dto, propertyId, viewingTime: slotIso(i * 12) }),
          ),
        );
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(await db.getRepository(Viewing).countBy({ leadId: lead.id, status: 'NEW' })).toBe(1);
        expect(await db.getRepository(Lead).count()).toBe(1);
      });

      it('webhook viewing-requested mang viewingId của buổi xem mới', async () => {
        const { property } = await setup();
        const post = jest.fn(() => of({ data: {} }));
        const viewings = new ViewingsService(
          db.getRepository(Viewing), db.getRepository(Lead), db.getRepository(Property),
          { post } as any, {} as any, {} as any, service,
        );
        const created = await viewings.create({
          ...input(1), email: 'a@example.test', budget: 3000000000,
          propertyId: property.id, viewingTime: slotIso(0),
        });
        for (let i = 0; i < 50 && post.mock.calls.length === 0; i++) await new Promise((r) => setTimeout(r, 20));
        expect(post).toHaveBeenCalledTimes(1);
        const payload = (post.mock.calls[0] as any[])[1];
        expect(payload).toMatchObject({
          event: 'viewing_requested', leadId: created.lead.id, viewingId: created.viewing.id,
          propertyId: property.id, manageToken: created.viewing.manageToken,
        });
      });

      // ViewingsService thật cùng LeadsService thật (n8n giả), để thử huỷ và không đến qua đúng đường chạy
      const realServices = () => {
        const leadsService = new LeadsService(
          db.getRepository(Lead), db.getRepository(LeadEvent), db.getRepository(Viewing),
          db.getRepository(Property), { callWebhook: jest.fn().mockResolvedValue(undefined) } as any,
        );
        const viewings = new ViewingsService(
          db.getRepository(Viewing), db.getRepository(Lead), db.getRepository(Property),
          {} as any, leadsService, { callWebhook: jest.fn().mockResolvedValue(undefined) } as any, service,
        );
        jest.spyOn(viewings as any, 'triggerN8nWebhook').mockResolvedValue(undefined);
        return { viewings, leadsService };
      };

      it('khách đặt lần đầu rồi tự huỷ: buổi xem CANCELLED, lead về CONSULTING (không LOST), xoá link duyệt', async () => {
        const { dto } = await setup();
        const { viewings } = realServices();
        const created = await viewings.create({ ...dto, viewingTime: slotIso(0) });
        await db.getRepository(Lead).update(created.lead.id, { approvalUrl: 'http://n8n/resume/abc' });
        await viewings.customerCancel(created.viewing.manageToken!);
        const lead = await db.getRepository(Lead).createQueryBuilder('l').addSelect('l.approvalUrl')
          .where('l.id = :id', { id: created.lead.id }).getOneOrFail();
        expect(lead).toMatchObject({ status: 'CONSULTING', lostReason: null, approvalUrl: null });
        expect((await db.getRepository(Viewing).findOneByOrFail({ id: created.viewing.id })).status).toBe('CANCELLED');
        expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'VIEWING_CANCELLED' })).toBe(1);
      });

      it('khách đã xem buổi 1, huỷ buổi 2: lead về VIEWED, buổi 1 vẫn ATTENDED', async () => {
        const { property, dto } = await setup();
        const propertyB = await otherProperty();
        const { lead, viewing: first } = await leadWithViewing(property.id, 'VIEWED', 'ATTENDED');
        const { viewings } = realServices();
        const second = await viewings.create({ ...dto, propertyId: propertyB.id, viewingTime: slotIso(0) });
        await viewings.customerCancel(second.viewing.manageToken!);
        expect(await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).toMatchObject({ status: 'VIEWED', lostReason: null });
        expect((await db.getRepository(Viewing).findOneByOrFail({ id: first.id })).status).toBe('ATTENDED');
      });

      it('không đến buổi 2 sau khi đã xem buổi 1 và không hẹn lại: buổi 2 NO_SHOW, lead về VIEWED', async () => {
        const { property, dto } = await setup();
        const propertyB = await otherProperty();
        const { lead } = await leadWithViewing(property.id, 'VIEWED', 'ATTENDED');
        const { viewings } = realServices();
        const second = await viewings.create({ ...dto, propertyId: propertyB.id, viewingTime: slotIso(0) });
        // Buổi 2 đã được duyệt và đã tới giờ
        await db.getRepository(Lead).update(lead.id, { status: 'CONFIRMED' });
        await db.getRepository(Viewing).update(second.viewing.id, { viewingTime: new Date(Date.now() - 3600000) });
        await viewings.recordAttendance(second.viewing.id, { outcome: 'NO_SHOW', next: 'CLOSE' } as any, manager);
        expect(await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).toMatchObject({ status: 'VIEWED', lostReason: null });
        expect((await db.getRepository(Viewing).findOneByOrFail({ id: second.viewing.id })).status).toBe('NO_SHOW');
        expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'VIEWING_NO_SHOW' })).toBe(1);
      });

      it('khách đặt lần đầu mà không đến và không hẹn lại: lead về CONSULTING', async () => {
        const { dto } = await setup();
        const { viewings } = realServices();
        const created = await viewings.create({ ...dto, viewingTime: slotIso(0) });
        await db.getRepository(Lead).update(created.lead.id, { status: 'CONFIRMED' });
        await db.getRepository(Viewing).update(created.viewing.id, { viewingTime: new Date(Date.now() - 3600000) });
        await viewings.recordAttendance(created.viewing.id, { outcome: 'NO_SHOW', next: 'CLOSE' } as any, manager);
        expect(await db.getRepository(Lead).findOneByOrFail({ id: created.lead.id })).toMatchObject({ status: 'CONSULTING', lostReason: null });
      });

      it('chi tiết lead liệt kê lịch sử các buổi xem, mới nhất trước, kèm tên căn và trạng thái', async () => {
        const { property } = await setup();
        const propertyB = await otherProperty();
        const { lead, viewing: first } = await leadWithViewing(property.id, 'VIEWED', 'ATTENDED');
        const second = await db.getRepository(Viewing).save({
          propertyId: propertyB.id, leadId: lead.id, status: 'NEW', viewingTime: new Date(Date.now() + 86400000),
        });
        await db.getRepository(Lead).update(lead.id, { status: 'NEW' });
        const { leadsService } = realServices();
        const detail = await leadsService.findDetail(lead.id);
        expect(detail.viewing!.id).toBe(second.id);
        expect(detail.viewings.map((v) => [v.id, v.propertyName, v.status])).toEqual([
          [second.id, 'Nhà B', 'NEW'],
          [first.id, 'Nhà test', 'ATTENDED'],
        ]);
      });
    });
  },
);
