import { DataSource } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { FollowupTask } from './followup-task.entity';
import { FollowupsService } from './followups.service';
import { LeadIntakeService } from '../leads/lead-intake.service';
import { LeadsService } from '../leads/leads.service';
import { FOLLOWUP_SELECTOR_SQL } from './followup-sql';
import { StatsService } from '../stats/stats.service';
import { FeedbackService } from '../feedback/feedback.service';

const url = process.env.FE33_TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  'FE-38: PostgreSQL theo khách, buổi xem và phiên nhận việc',
  () => {
    let db: DataSource;
    let intake: LeadIntakeService;
    let followups: FollowupsService;
    let leads: LeadsService;
    let manager: User;
    let sale: User;
    const input = (n: number) => ({
      name: `Khách ${n}`,
      phone: `090${String(n).padStart(7, '0')}`,
      source: 'hotline',
    });
    beforeAll(async () => {
      const target = new URL(url!);
      if (
        !['127.0.0.1', 'localhost'].includes(target.hostname) ||
        target.port !== '55433' ||
        target.pathname !== '/fe33_test'
      )
        throw new Error('Chỉ dùng DB tạm localhost:55433/fe33_test');
      db = new DataSource({
        type: 'postgres',
        url,
        synchronize: true,
        entities: [
          Lead,
          LeadEvent,
          User,
          Property,
          Viewing,
          ChatLog,
          Feedback,
          FollowupTask,
        ],
      });
      await db.initialize();
      leads = new LeadsService(
        db.getRepository(Lead),
        db.getRepository(LeadEvent),
        db.getRepository(Viewing),
        db.getRepository(Property),
        { callWebhook: async () => ({}) } as any,
      );
      intake = new LeadIntakeService(db.getRepository(Lead));
      followups = new FollowupsService(db, leads);
    });
    afterAll(async () => {
      if (db?.isInitialized) await db.destroy();
    });
    beforeEach(async () => {
      await db.query(
        'TRUNCATE leads,lead_events,users,properties,viewings,chat_logs,feedbacks,followup_tasks RESTART IDENTITY',
      );
      manager = await db
        .getRepository(User)
        .save({
          name: 'Manager',
          email: 'manager@example.test',
          role: 'MANAGER',
          passwordHash: 'test',
        });
      sale = await db
        .getRepository(User)
        .save({
          name: 'Sale',
          email: 'sale@example.test',
          role: 'SALE',
          passwordHash: 'test',
        });
    });
    async function overdue(n: number) {
      const { lead } = await intake.create(input(n));
      const at = new Date(Date.now() - 3 * 3600000);
      await db
        .getRepository(Lead)
        .update(lead.id, {
          assignedAt: at,
          responseDueAt: new Date(Date.now() - 1000),
        });
      return {
        lead,
        at,
        dto: {
          leadId: lead.id,
          viewingId: 0,
          viewingTime: at.toISOString(),
          type: 'STAFF_NUDGE' as const,
          owner: 'test-exec',
        },
      };
    }
    it('khách chưa email/chưa lịch/quá hạn được chọn, hoàn tất chỉ một lần theo phiên', async () => {
      const { lead, dto } = await overdue(1);
      expect(await db.query(FOLLOWUP_SELECTOR_SQL)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'STAFF_NUDGE',
            lead_id: lead.id,
            viewing_id: 0,
          }),
        ]),
      );
      const task = await followups.claim(dto);
      expect(task.claimed).toBe(true);
      expect((await followups.start(task.taskId!, task.token!)).allowed).toBe(
        true,
      );
      await followups.actionDone(task.taskId!, { token: task.token! });
      await followups.complete(task.taskId!, task.token!);
      await followups.complete(task.taskId!, task.token!);
      expect(
        await db.getRepository(LeadEvent).countBy({ type: 'RESPONSE_OVERDUE' }),
      ).toBe(1);
      expect((await followups.claim(dto)).claimed).toBe(false);
    });
    it('nhân viên ghi chú trong lúc giữ tác vụ thì không gửi cảnh báo', async () => {
      const { lead, dto } = await overdue(1);
      const task = await followups.claim(dto);
      await intake.addNote(lead.id, 'Đã liên hệ', sale);
      expect((await followups.start(task.taskId!, task.token!)).allowed).toBe(
        false,
      );
    });
    it('chuyển sale vô hiệu phiên cũ, phiên mới quá hạn được báo lại', async () => {
      const { lead, dto } = await overdue(1);
      const task = await followups.claim(dto);
      const moved = await intake.reassign(
        lead.id,
        { assignedUserId: manager.id },
        manager,
      );
      expect((await followups.start(task.taskId!, task.token!)).allowed).toBe(
        false,
      );
      await db
        .getRepository(Lead)
        .update(lead.id, { responseDueAt: new Date(Date.now() - 1000) });
      const next = await followups.claim({
        ...dto,
        viewingTime: moved.assignedAt!.toISOString(),
      });
      expect(next.claimed).toBe(true);
      expect(next.taskId).not.toBe(task.taskId);
    });
    it('cảnh báo cũ đã gửi vẫn hoàn tất metadata sau chuyển sale, không chặn phiên mới', async () => {
      const { lead, dto } = await overdue(1);
      const task = await followups.claim(dto);
      await followups.start(task.taskId!, task.token!);
      await followups.actionDone(task.taskId!, { token: task.token! });
      const moved = await intake.reassign(
        lead.id,
        { assignedUserId: manager.id },
        manager,
      );
      await followups.complete(task.taskId!, task.token!);
      await db
        .getRepository(Lead)
        .update(lead.id, { responseDueAt: new Date(Date.now() - 1000) });
      expect(
        (
          await followups.claim({
            ...dto,
            viewingTime: moved.assignedAt!.toISOString(),
          })
        ).claimed,
      ).toBe(true);
    });
    it('lead chưa có hạn (dữ liệu cũ), đã phản hồi hoặc đã ký không được báo nhầm', async () => {
      const { lead } = await overdue(1);
      await db
        .getRepository(Lead)
        .update(lead.id, { firstResponseAt: new Date() });
      await intake.create(input(2));
      const third = await overdue(3);
      await db.getRepository(Lead).update(third.lead.id, { status: 'SIGNED' });
      expect(
        (await db.query(FOLLOWUP_SELECTOR_SQL)).filter(
          (r: any) => r.type === 'STAFF_NUDGE',
        ),
      ).toHaveLength(0);
    });
    it('nhắc lịch theo đúng viewing id; lịch cũ hoàn tất không chặn lịch mới', async () => {
      const { lead } = await intake.create({
        ...input(1),
        email: 'customer@example.test',
      });
      await db.getRepository(Lead).update(lead.id, { status: 'CONFIRMED' });
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
      const old = await db
        .getRepository(Viewing)
        .save({
          leadId: lead.id,
          propertyId: property.id,
          viewingTime: new Date(Date.now() - 86400000),
          status: 'CANCELLED',
        });
      const current = await db
        .getRepository(Viewing)
        .save({
          leadId: lead.id,
          propertyId: property.id,
          viewingTime: new Date(Date.now() + 3600000),
          status: 'NEW',
        });
      // Dùng task đã hoàn tất để mô phỏng nhắc buổi cũ; event legacy của buổi đầu cũng không chặn buổi sau.
      await db
        .getRepository(LeadEvent)
        .save({ leadId: lead.id, type: 'REMINDER_SENT', note: 'legacy' });
      const rows = await db.query(FOLLOWUP_SELECTOR_SQL);
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'REMINDER', viewing_id: current.id }),
        ]),
      );
      const task = await followups.claim({
        leadId: lead.id,
        viewingId: current.id,
        viewingTime: current.viewingTime.toISOString(),
        type: 'REMINDER',
        owner: 'test',
      });
      expect(task.claimed).toBe(true);
      expect(
        (
          await followups.claim({
            leadId: lead.id,
            viewingId: old.id,
            viewingTime: old.viewingTime.toISOString(),
            type: 'REMINDER',
            owner: 'test-old',
          })
        ).claimed,
      ).toBe(false);
    });
    it('thống kê đếm khách theo nguồn và sale, không theo số buổi xem', async () => {
      await intake.create(input(1));
      await intake.create(input(2));
      const stats = await new StatsService(db.getRepository(Lead)).getStats();
      expect(stats.total).toBe(2);
      expect(stats.bySource).toEqual([{ source: 'hotline', count: 2 }]);
      expect(stats.byAssignee).toEqual([{ assignedUserId: sale.id, count: 2 }]);
    });
    it('checkpoint nhắc 3 ngày của bản cũ chỉ hoàn tất metadata, không chặn cảnh báo 2 giờ mới', async () => {
      const { lead, dto } = await overdue(1);
      const oldTime = new Date(Date.now() + 3600000);
      const old = await db
        .getRepository(FollowupTask)
        .save({
          taskKey: `STAFF_NUDGE:${lead.id}`,
          leadId: lead.id,
          viewingId: 99,
          viewingTime: oldTime,
          type: 'STAFF_NUDGE',
          state: 'ACTION_DONE',
          owner: 'old',
          token: 'a'.repeat(36),
          availableAt: new Date(0),
          leaseUntil: new Date(0),
          result: {},
        });
      const resumed = await followups.claim({
        ...dto,
        viewingId: 99,
        viewingTime: oldTime.toISOString(),
      });
      expect(resumed).toMatchObject({
        claimed: true,
        resume: true,
        taskId: old.id,
      });
      await followups.complete(old.id, resumed.token!);
      expect(
        await db.getRepository(LeadEvent).countBy({ type: 'STAFF_NUDGE_SENT' }),
      ).toBe(1);
      expect((await followups.claim(dto)).claimed).toBe(true);
    });
    it('buổi thứ hai có link và tác vụ cảm nhận riêng; link cũ vẫn hiển thị đúng căn đầu', async () => {
      const { lead } = await intake.create({
        ...input(1),
        email: 'customer@example.test',
      });
      await db.getRepository(Lead).update(lead.id, { status: 'VIEWED' });
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
      const first = await db
        .getRepository(Viewing)
        .save({
          leadId: lead.id,
          propertyId: properties[0].id,
          viewingTime: new Date(Date.now() - 3 * 86400000),
          status: 'ATTENDED',
        });
      const feedbacks = new FeedbackService(
        db.getRepository(Feedback),
        db.getRepository(Viewing),
        db.getRepository(Property),
        leads,
        { callWebhook: async () => ({}) } as any,
      );
      const oldToken = 'a'.repeat(32);
      await db
        .getRepository(Feedback)
        .save({
          leadId: lead.id,
          token: oldToken,
          rating: 5,
          interest: 'OTHER',
          submittedAt: new Date(Date.now() - 2 * 86400000),
        });
      await db
        .getRepository(LeadEvent)
        .save({ leadId: lead.id, type: 'FEEDBACK_ASKED', note: 'legacy' });
      const second = await db
        .getRepository(Viewing)
        .save({
          leadId: lead.id,
          propertyId: properties[1].id,
          viewingTime: new Date(Date.now() - 3 * 3600000),
          status: 'ATTENDED',
        });
      const links = await Promise.all([
        feedbacks.createLink(lead.id, second.id),
        feedbacks.createLink(lead.id, second.id),
      ]);
      expect(links[0].token).toBe(links[1].token);
      expect(links[0].token).not.toBe(oldToken);
      expect(await feedbacks.getPublic(oldToken)).toMatchObject({
        propertyName: properties[0].name,
        submitted: true,
      });
      expect(await feedbacks.getPublic(links[0].token)).toMatchObject({
        propertyName: properties[1].name,
        submitted: false,
      });
      expect(await db.query(FOLLOWUP_SELECTOR_SQL)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'FEEDBACK', viewing_id: second.id }),
        ]),
      );
      const task = await followups.claim({
        leadId: lead.id,
        viewingId: second.id,
        viewingTime: second.viewingTime.toISOString(),
        type: 'FEEDBACK',
        owner: 'test',
      });
      expect(task.claimed).toBe(true);
      await followups.start(task.taskId!, task.token!);
      await followups.actionDone(task.taskId!, { token: task.token! });
      await followups.complete(task.taskId!, task.token!);
      expect(
        (await db.query(FOLLOWUP_SELECTOR_SQL)).filter(
          (r: any) => r.type === 'FEEDBACK',
        ),
      ).toHaveLength(0);
      expect((await feedbacks.createLink(lead.id, first.id)).token).toBe(
        oldToken,
      );
    });
  },
);
