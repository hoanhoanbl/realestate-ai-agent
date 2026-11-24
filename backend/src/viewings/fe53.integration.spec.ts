import { ConflictException } from '@nestjs/common';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from './entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { FeedbackWork, FeedbackWorkAlert, FeedbackWorkHistory } from '../feedback/feedback-work.entity';
import { FeedbackWorkService } from '../feedback/feedback-work.service';
import { LeadIntakeService } from '../leads/lead-intake.service';
import { LeadsService } from '../leads/leads.service';
import { ViewingsService } from './viewings.service';
import { findSaleConflict, SALE_GAP_MINUTES } from './booking-rules';
import { bookableSlots, vnDateKey } from './viewing-time';
import type { AuthUser } from '../auth/auth.types';

// FE-53: chống trùng lịch theo sale. Chỉ chạy trên PostgreSQL tạm, giống FE-33 và FE-35.
const url = process.env.FE33_TEST_DATABASE_URL;
(url ? describe : describe.skip)('FE-53: chống trùng lịch theo sale (PostgreSQL thật)', () => {
  let db: DataSource;
  let intake: LeadIntakeService;
  let leads: LeadsService;
  let viewings: ViewingsService;
  let work: FeedbackWorkService;
  let webhooks: { path: string; payload: any }[];
  let manager: User;
  let an: User;
  let binh: User;
  let chi: User;
  let props: Property[]; // A Sơn Trà, B Hải Châu, C Ngũ Hành Sơn, D Liên Chiểu
  let t: Date[]; // sáu khung giờ liên tiếp (cách nhau 60 phút) trong cùng một ngày
  const MIN = 60000;
  const asUser = (u: User): AuthUser => ({ id: u.id, email: u.email, name: u.name, role: u.role });
  const iso = (d: Date) => d.toISOString();

  beforeAll(async () => {
    const target = new URL(url!);
    if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/fe33_test') {
      throw new Error('Chỉ dùng DB tạm localhost:55433/fe33_test');
    }
    db = new DataSource({
      type: 'postgres', url, synchronize: true,
      entities: [Lead, LeadEvent, User, Property, Viewing, ChatLog, Contract, Feedback, FeedbackWork, FeedbackWorkHistory, FeedbackWorkAlert],
    });
    await db.initialize();
    webhooks = [];
    const n8n = { callWebhook: async (path: string, payload: any) => { webhooks.push({ path, payload }); } } as any;
    leads = new LeadsService(db.getRepository(Lead), db.getRepository(LeadEvent), db.getRepository(Viewing), db.getRepository(Property), n8n);
    intake = new LeadIntakeService(db.getRepository(Lead));
    viewings = new ViewingsService(
      db.getRepository(Viewing), db.getRepository(Lead), db.getRepository(Property), { post: () => of({}) } as any, leads, n8n, intake,
    );
    work = new FeedbackWorkService(db, n8n, leads);
    // Một ngày đủ khung liên tiếp (bỏ ngày đầu vì có thể chỉ còn vài khung)
    const byDay = new Map<string, Date[]>();
    for (const s of bookableSlots(new Date())) {
      const k = vnDateKey(s);
      byDay.set(k, [...(byDay.get(k) ?? []), s]);
    }
    const full = [...byDay.values()].filter((d) => d.length >= 6);
    t = full[1].slice(0, 6);
    for (let i = 1; i < t.length; i++) expect(t[i].getTime() - t[i - 1].getTime()).toBe(60 * MIN);
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(async () => {
    webhooks.length = 0;
    await db.query('TRUNCATE feedback_work_alerts, feedback_work_history, feedback_work, feedbacks, contracts, leads, lead_events, users, properties, viewings, chat_logs RESTART IDENTITY');
    const users = db.getRepository(User);
    manager = await users.save({ name: 'Quản lý', email: 'm@example.test', role: 'MANAGER', passwordHash: 'x' });
    an = await users.save({ name: 'An', email: 'an@example.test', role: 'SALE', passwordHash: 'x' });
    binh = await users.save({ name: 'Bình', email: 'binh@example.test', role: 'SALE', passwordHash: 'x' });
    chi = await users.save({ name: 'Chi', email: 'chi@example.test', role: 'SALE', passwordHash: 'x' });
    props = [];
    for (const name of ['Sơn Trà', 'Hải Châu', 'Ngũ Hành Sơn', 'Liên Chiểu']) {
      props.push(await db.getRepository(Property).save({ name, address: `${name}, Đà Nẵng`, price: 3000000000, area: 50, type: 'HOUSE', status: 'AVAILABLE' }));
    }
  });

  let seq = 0;
  // Lead do `sale` phụ trách, có một buổi xem ở căn `prop` lúc `time`
  async function booked(
    sale: User, prop: Property, time: Date,
    opts: { leadStatus?: string; viewingStatus?: string } = {},
  ) {
    seq++;
    const lead = await db.getRepository(Lead).save({
      name: `Khách ${seq}`, phone: `091${String(seq).padStart(7, '0')}`, email: `k${seq}@example.test`, source: 'direct',
      status: opts.leadStatus ?? 'NEW', automationStatus: 'COMPLETED', assignedUserId: sale.id,
    });
    const viewing = await db.getRepository(Viewing).save({
      leadId: lead.id, propertyId: prop.id, viewingTime: time, status: opts.viewingStatus ?? 'NEW',
    });
    return { lead, viewing };
  }
  const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * MIN);
  const conflict = (sale: User, prop: Property, time: Date) => findSaleConflict(db.manager, sale.id, time, { propertyId: prop.id });

  describe('định nghĩa sale bận', () => {
    it('hằng số là 90 phút', () => expect(SALE_GAP_MINUTES).toBe(90));

    it('cách 60 phút thì bận, đúng 90 phút thì rảnh', async () => {
      await booked(an, props[0], t[0]);
      expect(await conflict(an, props[1], at(t[0], 60))).toMatchObject({ saleName: 'An', propertyName: 'Sơn Trà' });
      expect(await conflict(an, props[1], at(t[0], 89))).not.toBeNull();
      expect(await conflict(an, props[1], at(t[0], 90))).toBeNull();
      expect(await conflict(an, props[1], at(t[0], -89))).not.toBeNull();
      expect(await conflict(an, props[1], at(t[0], -90))).toBeNull();
      expect(await conflict(binh, props[1], at(t[0], 60))).toBeNull(); // sale khác không bị ảnh hưởng
    });

    it('buổi đã huỷ và khách không đến không tính', async () => {
      await booked(an, props[0], t[0], { viewingStatus: 'CANCELLED' });
      await booked(an, props[2], t[3], { viewingStatus: 'NO_SHOW' });
      expect(await conflict(an, props[1], at(t[0], 30))).toBeNull();
      expect(await conflict(an, props[1], at(t[3], 30))).toBeNull();
    });

    it('buổi đã điểm danh "Có đến" vẫn tính bận theo giờ hẹn, kể cả khi lead đã VIEWED', async () => {
      await booked(an, props[0], t[0], { viewingStatus: 'ATTENDED', leadStatus: 'VIEWED' });
      expect(await conflict(an, props[1], at(t[0], 30))).not.toBeNull();
    });

    it('cùng căn do luật 60 phút theo căn quyết định, không phải luật theo sale', async () => {
      await booked(an, props[0], t[0]);
      expect(await conflict(an, props[0], at(t[0], 30))).toBeNull();
    });

    it('buổi NEW của lead đã LOST không giữ chỗ', async () => {
      await booked(an, props[0], t[0], { leadStatus: 'LOST' });
      expect(await conflict(an, props[1], at(t[0], 30))).toBeNull();
    });

    it('loại buổi đang duyệt/đổi giờ khỏi phép kiểm tra', async () => {
      const { viewing } = await booked(an, props[0], t[0]);
      const c = await findSaleConflict(db.manager, an.id, at(t[0], 30), { propertyId: props[1].id, excludeViewingId: viewing.id });
      expect(c).toBeNull();
    });
  });

  describe('chia sale bỏ qua sale đang bận', () => {
    const book = (n: number, prop: Property, time: Date) =>
      viewings.create({
        name: `Khách mới ${n}`, email: `new${n}@example.test`, phone: `098${String(n).padStart(7, '0')}`,
        budget: 3000000000, propertyId: prop.id, viewingTime: iso(time), source: 'direct',
      } as any);

    it('sale đầu lượt bận thì sale kế nhận, sale bị bỏ qua giữ nguyên lượt', async () => {
      await booked(an, props[0], t[0]);
      const { lead } = await book(1, props[1], t[1]);
      expect(lead.assignedUserId).toBe(binh.id);
      expect((await db.getRepository(User).findOneByOrFail({ id: an.id })).lastAssignedAt).toBeNull();
      expect((await db.getRepository(User).findOneByOrFail({ id: binh.id })).lastAssignedAt).not.toBeNull();
    });

    it('hai khách đặt cùng giờ ở hai căn nhận hai sale khác nhau', async () => {
      const a = await book(1, props[0], t[2]);
      const b = await book(2, props[1], t[2]);
      expect(a.lead.assignedUserId).toBe(an.id);
      expect(b.lead.assignedUserId).toBe(binh.id);
    });

    it('hai khách cùng giờ cùng căn vẫn bị luật theo căn từ chối', async () => {
      await book(1, props[0], t[2]);
      await expect(book(2, props[0], t[2])).rejects.toThrow(ConflictException);
    });

    it('mọi sale đều bận thì chia như cũ, khách vẫn đặt được', async () => {
      await booked(an, props[2], t[0]);
      await booked(binh, props[3], t[0]);
      await booked(chi, props[2], t[0]);
      const { lead, viewing } = await book(1, props[1], t[1]);
      expect(lead.assignedUserId).toBe(an.id); // đầu lượt như cũ
      expect(viewing.id).toBeGreaterThan(0);
    });

    it('khách cũ còn sale nhận khách giữ nguyên sale dù sale bận', async () => {
      const first = await book(1, props[0], t[0]); // An
      expect(first.lead.assignedUserId).toBe(an.id);
      await db.getRepository(Viewing).update(first.viewing.id, { status: 'CANCELLED' });
      await db.getRepository(Lead).update(first.lead.id, { status: 'CONSULTING' });
      await booked(an, props[2], t[3]); // An bận lúc t[3]
      const again = await viewings.create({
        name: 'Khách mới 1', email: 'new1@example.test', phone: `098${String(1).padStart(7, '0')}`,
        budget: 3000000000, propertyId: props[1].id, viewingTime: iso(t[3]), source: 'direct',
      } as any);
      expect(again.lead.id).toBe(first.lead.id);
      expect(again.lead.assignedUserId).toBe(an.id);
    });
  });

  describe('đổi giờ, hẹn lại, duyệt', () => {
    it('đổi giờ vào khoảng bận thì 409, giờ giữ nguyên; ra ngoài 90 phút thì được', async () => {
      await booked(an, props[0], t[0]);
      const { viewing } = await booked(an, props[1], t[4]);
      const err = await viewings.update(viewing.id, { viewingTime: iso(t[1]) }, asUser(manager)).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message).toContain('Sale An');
      expect(err.message).toContain('Sơn Trà');
      expect((await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id })).viewingTime.getTime()).toBe(t[4].getTime());
      expect(await db.getRepository(LeadEvent).countBy({ type: 'VIEWING_RESCHEDULED' })).toBe(0);
      await viewings.update(viewing.id, { viewingTime: iso(t[2]) }, asUser(manager)); // 120 phút
      expect((await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id })).viewingTime.getTime()).toBe(t[2].getTime());
    });

    it('lead chưa có người phụ trách thì bỏ qua kiểm tra', async () => {
      await booked(an, props[0], t[0]);
      const { lead, viewing } = await booked(an, props[1], t[4]);
      await db.getRepository(Lead).update(lead.id, { assignedUserId: null });
      await viewings.update(viewing.id, { viewingTime: iso(t[1]) }, asUser(manager));
    });

    it('hẹn lại sau khi khách không đến vào giờ trùng: 409, không ghi sự kiện không đến, buổi xem giữ nguyên', async () => {
      await booked(an, props[0], t[0]);
      const soon = new Date(Date.now() + 10 * MIN);
      const { viewing, lead } = await booked(an, props[1], soon, { leadStatus: 'CONFIRMED' });
      await expect(
        viewings.recordAttendance(viewing.id, { outcome: 'NO_SHOW', next: 'RESCHEDULE', viewingTime: iso(t[1]) }, asUser(an)),
      ).rejects.toThrow(ConflictException);
      const v = await db.getRepository(Viewing).findOneByOrFail({ id: viewing.id });
      expect(v.status).toBe('NEW');
      expect(v.viewingTime.getTime()).toBe(soon.getTime());
      expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'VIEWING_NO_SHOW' })).toBe(0);
    });

    describe('duyệt', () => {
      let previousSecret: string | undefined;
      beforeAll(() => { previousSecret = process.env.WEBHOOK_SECRET; process.env.WEBHOOK_SECRET = 'fe53-local-test'; });
      afterAll(() => {
        if (previousSecret === undefined) delete process.env.WEBHOOK_SECRET;
        else process.env.WEBHOOK_SECRET = previousSecret;
      });

      it('nút duyệt trong thông báo: sale bận thì 409, không gọi n8n; đổi giờ rồi duyệt được', async () => {
        await booked(an, props[0], t[0]);
        const { viewing, lead } = await booked(an, props[1], t[1]);
        const token = (await viewings.issueStaffLinks(viewing.id)).approveUrl.split('/duyet/')[1];
        const err = await viewings.confirmStaffLink(token).catch((e) => e);
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.message).toContain('Sale An');
        expect(webhooks).toHaveLength(0);
        expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).status).toBe('NEW');
        await viewings.update(viewing.id, { viewingTime: iso(t[3]) }, asUser(an));
        await viewings.confirmStaffLink(token);
        expect(webhooks.map((w) => w.payload.event)).toEqual(['approved']);
      });

      it('quản lý duyệt thay trên web vẫn kiểm theo sale phụ trách', async () => {
        await booked(an, props[0], t[0]);
        const { lead } = await booked(an, props[1], t[1]);
        await expect(leads.approve(lead.id, asUser(manager))).rejects.toThrow(ConflictException);
        expect(webhooks).toHaveLength(0);
        await db.getRepository(Viewing).update({ leadId: lead.id }, { viewingTime: t[3] });
        await leads.approve(lead.id, asUser(manager));
        expect(webhooks).toHaveLength(1);
      });

      it('buổi xem của lead đã đến trước đó cũng chặn duyệt (bận theo giờ hẹn)', async () => {
        await booked(an, props[0], t[0], { viewingStatus: 'ATTENDED', leadStatus: 'VIEWED' });
        const { lead } = await booked(an, props[1], t[1]);
        await expect(leads.approve(lead.id, asUser(an))).rejects.toThrow(/Sale An/);
      });
    });
  });

  describe('chuyển sale', () => {
    it('chặn khi sale mới bận, giữ người phụ trách, không ghi sự kiện chuyển', async () => {
      const { lead } = await booked(an, props[0], t[0]);
      await booked(binh, props[1], t[1]);
      const err = await intake.reassign(lead.id, { assignedUserId: binh.id }, asUser(manager)).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message).toContain('Sale Bình');
      expect(err.message).toContain('chọn sale khác hoặc đổi giờ trước');
      expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).assignedUserId).toBe(an.id);
      expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'LEAD_REASSIGNED' })).toBe(0);
      expect((await db.getRepository(User).findOneByOrFail({ id: binh.id })).lastAssignedAt).toBeNull();
    });

    it('chuyển sang sale rảnh thì được', async () => {
      const { lead } = await booked(an, props[0], t[0]);
      await booked(binh, props[1], t[1]);
      await intake.reassign(lead.id, { assignedUserId: chi.id }, asUser(manager));
      expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).assignedUserId).toBe(chi.id);
    });

    it('lead đã xem xong từ lâu, không còn buổi xem mở thì chuyển sang sale đang có lịch dày vẫn được', async () => {
      const { lead } = await booked(an, props[0], at(new Date(), -180), { viewingStatus: 'ATTENDED', leadStatus: 'VIEWED' });
      await booked(binh, props[1], t[1]);
      await intake.reassign(lead.id, { assignedUserId: binh.id }, asUser(manager));
      expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).assignedUserId).toBe(binh.id);
    });

    it('đang trong 90 phút của buổi đã điểm danh thì không chuyển được, lịch bận ở lại với sale đang dẫn', async () => {
      const { lead } = await booked(an, props[0], at(new Date(), -30), { viewingStatus: 'ATTENDED', leadStatus: 'VIEWED' });
      const probe = at(new Date(), 30); // giờ trong tương lai, cách buổi vừa dẫn 60 phút
      expect(await conflict(an, props[1], probe)).not.toBeNull();
      const err = await intake.reassign(lead.id, { assignedUserId: binh.id }, asUser(manager)).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message).toContain('Sale An đang dẫn buổi xem');
      expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).assignedUserId).toBe(an.id);
      expect(await db.getRepository(LeadEvent).countBy({ leadId: lead.id, type: 'LEAD_REASSIGNED' })).toBe(0);
      expect(await conflict(an, props[1], probe)).not.toBeNull(); // vẫn bận như trước khi thử chuyển
      expect(await conflict(binh, props[1], probe)).toBeNull();
    });

    it('buổi đã điểm danh quá 90 phút thì chuyển được', async () => {
      const { lead } = await booked(an, props[0], at(new Date(), -100), { viewingStatus: 'ATTENDED', leadStatus: 'VIEWED' });
      await intake.reassign(lead.id, { assignedUserId: binh.id }, asUser(manager));
      expect((await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).assignedUserId).toBe(binh.id);
    });

    it('buổi đã điểm danh "Có đến" của sale mới vẫn làm sale mới bận', async () => {
      const { lead } = await booked(an, props[0], t[0]);
      await booked(binh, props[1], t[1], { viewingStatus: 'ATTENDED', leadStatus: 'VIEWED' });
      await expect(intake.reassign(lead.id, { assignedUserId: binh.id }, asUser(manager))).rejects.toThrow(ConflictException);
    });
  });

  describe('hẹn xem tiếp trong theo dõi phản hồi', () => {
    // Lead VIEWED do An phụ trách, có việc theo dõi phản hồi đang mở
    async function followUp(sale: User, prop: Property, viewedAt: Date) {
      const { lead, viewing } = await booked(sale, prop, viewedAt, { leadStatus: 'VIEWED', viewingStatus: 'ATTENDED' });
      const feedback = await db.getRepository(Feedback).save({
        leadId: lead.id, token: `v${viewing.id}_${String(viewing.id).padStart(32, 'a')}`, rating: 4, interest: 'OTHER',
        comment: 'Cần suy nghĩ', submittedAt: new Date(),
      });
      const w = await db.transaction((m) => work.create(m, feedback));
      return { lead, work: w };
    }
    // Buổi đã xem nằm rất xa các khung giờ thử để không gây bận
    const past = () => new Date(Date.now() - 3 * 86400000);

    it('trùng lịch của sale thì 409, việc không đóng, không tạo buổi xem mới', async () => {
      await booked(an, props[0], t[0]);
      const f = await followUp(an, props[2], past());
      const err = await work.record(f.work.id, { version: 1, outcome: 'NEXT_VIEWING', note: 'Hẹn tiếp', propertyId: props[1].id, viewingTime: iso(t[1]) }, asUser(an)).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message).toContain('Sale An');
      expect(await db.getRepository(Viewing).countBy({ leadId: f.lead.id, status: 'NEW' })).toBe(0);
      expect((await db.getRepository(FeedbackWork).findOneByOrFail({ id: f.work.id })).status).not.toBe('COMPLETED');
      expect((await db.getRepository(Lead).findOneByOrFail({ id: f.lead.id })).status).toBe('VIEWED');
    });

    it('hai thao tác đồng thời cho hai lead của một sale: đúng một thành công, lặp nhiều lần', async () => {
      for (let round = 0; round < 10; round++) {
        await db.query('TRUNCATE feedback_work_alerts, feedback_work_history, feedback_work, feedbacks, contracts, leads, lead_events, viewings RESTART IDENTITY');
        const f1 = await followUp(an, props[2], past());
        const f2 = await followUp(an, props[3], past());
        const results = await Promise.allSettled([
          work.record(f1.work.id, { version: 1, outcome: 'NEXT_VIEWING', note: 'Hẹn tiếp', propertyId: props[0].id, viewingTime: iso(t[0]) }, asUser(an)),
          work.record(f2.work.id, { version: 1, outcome: 'NEXT_VIEWING', note: 'Hẹn tiếp', propertyId: props[1].id, viewingTime: iso(t[1]) }, asUser(an)),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
        expect(rejected.reason).toBeInstanceOf(ConflictException);
        expect(await db.getRepository(Viewing).countBy({ status: 'NEW' })).toBe(1);
      }
    }, 60000); // 10 vòng, mỗi vòng dựng lại dữ liệu: máy chậm có thể quá 5 giây mặc định
  });
});
