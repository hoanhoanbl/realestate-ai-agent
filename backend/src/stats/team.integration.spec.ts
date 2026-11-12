import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { User } from '../users/entities/user.entity';
import { Property } from '../properties/entities/property.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { ChatLog } from '../chat-logs/chat-log.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import { FollowupTask } from '../followups/followup-task.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { LeadIntakeService } from '../leads/lead-intake.service';
import { RolesGuard } from '../auth/roles.guard';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

const url = process.env.FE33_TEST_DATABASE_URL;
const DAY = 24 * 3600000;

(url ? describe : describe.skip)('Đội sale: thống kê theo người phụ trách (PostgreSQL)', () => {
  let db: DataSource;
  let intake: LeadIntakeService;
  let stats: StatsService;
  let manager: User;
  let ha: User;
  let bao: User;
  let n = 0;
  const owner = (u: User | null) => (u ? u.id : null);

  beforeAll(async () => {
    const target = new URL(url!);
    if (!['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '55433' || target.pathname !== '/fe33_test')
      throw new Error('Chỉ dùng DB tạm localhost:55433/fe33_test');
    db = new DataSource({
      type: 'postgres',
      url,
      synchronize: true,
      entities: [Lead, LeadEvent, User, Property, Viewing, ChatLog, Feedback, FollowupTask, Contract],
    });
    await db.initialize();
    intake = new LeadIntakeService(db.getRepository(Lead));
    stats = new StatsService(db.getRepository(Lead));
  });
  afterAll(async () => {
    if (db?.isInitialized) await db.destroy();
  });
  beforeEach(async () => {
    n = 0;
    await db.query('TRUNCATE leads,lead_events,users,properties,viewings,chat_logs,feedbacks,followup_tasks,contracts RESTART IDENTITY');
    const users = db.getRepository(User);
    manager = await users.save({ name: 'Quản lý', email: 'ql@example.test', role: 'MANAGER', passwordHash: 'x' });
    ha = await users.save({ name: 'Trần Thu Hà', email: 'ha@example.test', role: 'SALE', passwordHash: 'x' });
    bao = await users.save({ name: 'Lê Quốc Bảo', email: 'bao@example.test', role: 'SALE', passwordHash: 'x', acceptingLeads: false });
  });

  // Tạo khách rồi đặt thẳng người phụ trách, trạng thái và thời điểm để dựng đúng tình huống
  async function lead(o: User | null, patch: Partial<Lead> = {}) {
    n += 1;
    const { lead: l } = await intake.create({ name: `Khách ${n}`, phone: `090${String(n).padStart(7, '0')}`, source: 'hotline' });
    await db.getRepository(Lead).update(l.id, { assignedUserId: owner(o) as number, ...patch });
    return l.id;
  }
  const team = async (period: 'now' | 'week' | 'month') => {
    const t = await stats.getTeam(period);
    return { ...t, byName: Object.fromEntries(t.owners.map((o) => [o.name, o])) };
  };
  const ev = (leadId: number, type: string, note: string, at: Date) =>
    db.query('INSERT INTO lead_events (lead_id, type, note, created_at) VALUES ($1,$2,$3,$4)', [leadId, type, note, at]);

  it('hiện tại: đếm khách đang mở theo trạng thái, bỏ khách đã ký và đã mất, sale tạm ngừng vẫn hiện', async () => {
    for (const s of ['CONSULTING', 'CONSULTING', 'CONSULTING', 'VIEWED', 'SIGNED', 'LOST']) await lead(ha, { status: s });
    await lead(bao, { status: 'DEPOSIT' });
    const t = await team('now');
    expect(t.byName['Trần Thu Hà'].open).toEqual({ CONSULTING: 3, NEW: 0, CONFIRMED: 0, VIEWED: 1, DEPOSIT: 0, total: 4 });
    expect(t.byName['Lê Quốc Bảo']).toMatchObject({ acceptingLeads: false, open: expect.objectContaining({ DEPOSIT: 1, total: 1 }) });
    expect(t.totalSales).toBe(2);
    expect(t.acceptingSales).toBe(1);
    expect(t.totals.open.total).toBe(5);
    expect(t.from).toBeNull();
  });

  it('sale không có khách vẫn có dòng toàn số 0; quản lý và "Chưa phân công" chỉ hiện khi có khách', async () => {
    let t = await team('now');
    expect(t.owners.map((o) => o.name)).toEqual(['Lê Quốc Bảo', 'Trần Thu Hà']);
    expect(t.byName['Trần Thu Hà'].open.total).toBe(0);
    await lead(manager, { status: 'CONFIRMED' });
    await lead(null, { status: 'CONFIRMED' });
    t = await team('now');
    expect(t.owners.map((o) => [o.role, o.name])).toEqual([
      ['SALE', 'Lê Quốc Bảo'],
      ['SALE', 'Trần Thu Hà'],
      ['MANAGER', 'Quản lý'],
      [null, 'Chưa phân công'],
    ]);
    expect(t.owners.at(-1)!.id).toBeNull();
  });

  it('trễ phản hồi: quá hạn và chưa phản hồi thì tính; đã phản hồi thì không', async () => {
    await lead(ha, { status: 'CONSULTING', responseDueAt: new Date(Date.now() - 1000), firstResponseAt: null });
    await lead(ha, { status: 'CONSULTING', responseDueAt: new Date(Date.now() - 1000), firstResponseAt: new Date() });
    await lead(ha, { status: 'CONSULTING', responseDueAt: new Date(Date.now() + DAY), firstResponseAt: null });
    expect((await team('now')).byName['Trần Thu Hà'].overdue).toBe(1);
  });

  it('im quá 7 ngày: ghi chú cũ vẫn im, ghi chú mới thì hết im', async () => {
    const id = await lead(ha, { status: 'CONSULTING', assignedAt: new Date(Date.now() - 9 * DAY) });
    // Bỏ sự kiện tạo khách (vừa ghi lúc này) để dựng khách đã giao từ 9 ngày trước
    await db.query('DELETE FROM lead_events WHERE lead_id = $1', [id]);
    await ev(id, 'NOTE_ADDED', 'gọi lần 1', new Date(Date.now() - 8 * DAY));
    expect((await team('now')).byName['Trần Thu Hà'].idle).toBe(1);
    await ev(id, 'NOTE_ADDED', 'gọi lại', new Date());
    expect((await team('now')).byName['Trần Thu Hà'].idle).toBe(0);
    const fresh = await lead(ha, { status: 'CONSULTING', assignedAt: new Date() });
    expect(fresh).toBeGreaterThan(0);
    expect((await team('now')).byName['Trần Thu Hà'].idle).toBe(0);
  });

  it('theo kỳ: nhận mới, đã xem, ký cọc, mất khách tính theo người đang phụ trách', async () => {
    const a = await lead(bao, { status: 'VIEWED', assignedAt: new Date() });
    await lead(bao, { status: 'CONSULTING', assignedAt: new Date() });
    await lead(bao, { status: 'CONSULTING', assignedAt: new Date() });
    const prop = await db.getRepository(Property).save({ name: 'Căn A', address: 'x', price: 1, area: 1, type: 'APARTMENT', status: 'AVAILABLE' } as Property);
    await db.getRepository(Viewing).save({ leadId: a, propertyId: prop.id, viewingTime: new Date(), status: 'ATTENDED' } as Viewing);
    const old1 = await lead(bao, { status: 'LOST', assignedAt: new Date(Date.now() - 40 * DAY) });
    const old2 = await lead(bao, { status: 'LOST', assignedAt: new Date(Date.now() - 40 * DAY) });
    await ev(old1, 'STATUS_CHANGED', 'CONSULTING -> LOST: NOT_INTERESTED', new Date());
    await ev(old2, 'STATUS_CHANGED', 'NEW -> LOST: EXPIRED - Quá hạn không xử lý', new Date());
    const t = await team('week');
    expect(t.byName['Lê Quốc Bảo']).toMatchObject({ assigned: 3, attended: 1, signed: 0, lost: 2 });
    expect(t.byName['Trần Thu Hà']).toMatchObject({ assigned: 0, attended: 0, signed: 0, lost: 0 });
    expect(t.totals).toMatchObject({ assigned: 3, attended: 1, lost: 2 });
    expect(t.from).toBeInstanceOf(Date);
  });

  it('theo kỳ: hợp đồng đã ký trong kỳ được tính cho người đang giữ khách; ký tháng trước thì không', async () => {
    const prop = await db.getRepository(Property).save({ name: 'Căn B', address: 'x', price: 1, area: 1, type: 'APARTMENT', status: 'AVAILABLE' } as Property);
    const prop2 = await db.getRepository(Property).save({ name: 'Căn C', address: 'x', price: 1, area: 1, type: 'APARTMENT', status: 'AVAILABLE' } as Property);
    const a = await lead(ha, { status: 'SIGNED' });
    const b = await lead(ha, { status: 'SIGNED' });
    const sign = (leadId: number, propertyId: number, at: Date) =>
      db.query(`INSERT INTO contracts (lead_id, property_id, deposit_amount, property_price, status, signed_at) VALUES ($1,$2,1,1,'SIGNED',$3)`, [leadId, propertyId, at]);
    await sign(a, prop.id, new Date());
    await sign(b, prop2.id, new Date(Date.now() - 62 * DAY));
    expect((await team('month')).byName['Trần Thu Hà'].signed).toBe(1);
  });

  it('khách chuyển sale chỉ tính cho người nhận mới', async () => {
    const id = await lead(ha, { status: 'CONSULTING', assignedAt: new Date() });
    await intake.reassign(id, { assignedUserId: manager.id }, manager as any);
    const t = await team('week');
    expect(t.byName['Trần Thu Hà'].assigned).toBe(0);
    expect(t.byName['Quản lý'].assigned).toBe(1);
  });

  it('mốc tuần theo giờ Việt Nam: from là 00:00 thứ Hai và không sau hiện tại', async () => {
    const t = await stats.getTeam('week');
    const vn = new Date(t.from!.getTime() + 7 * 3600000);
    expect(vn.getUTCDay()).toBe(1);
    expect([vn.getUTCHours(), vn.getUTCMinutes(), vn.getUTCSeconds()]).toEqual([0, 0, 0]);
    expect(t.from!.getTime()).toBeLessThanOrEqual(Date.now());
    const m = await stats.getTeam('month');
    expect(new Date(m.from!.getTime() + 7 * 3600000).getUTCDate()).toBe(1);
  });

  it('khách giao đúng 23:30 Chủ nhật giờ VN không tính vào tuần mới', async () => {
    const t = await stats.getTeam('week');
    const justBefore = new Date(t.from!.getTime() - 30 * 60000);
    await lead(ha, { status: 'CONSULTING', assignedAt: justBefore });
    await lead(ha, { status: 'CONSULTING', assignedAt: new Date(t.from!.getTime() + 60000) });
    expect((await stats.getTeam('week')).owners.find((o) => o.id === ha.id)!.assigned).toBe(1);
  });
});

describe('Đội sale: quyền và tham số của GET /stats/team', () => {
  const ctrl = new StatsController({ getTeam: async (p: string) => ({ period: p }) } as unknown as StatsService);
  const guard = new RolesGuard(new Reflector());
  const ctx = (user?: { role: string }) =>
    ({
      getHandler: () => StatsController.prototype.getTeam,
      getClass: () => StatsController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  it('quản lý được vào, sale bị 403', () => {
    expect(guard.canActivate(ctx({ role: 'MANAGER' }))).toBe(true);
    expect(() => guard.canActivate(ctx({ role: 'SALE' }))).toThrow(ForbiddenException);
  });
  it('period hợp lệ chạy, mặc định là now, giá trị lạ bị 400', async () => {
    await expect(ctrl.getTeam('week')).resolves.toEqual({ period: 'week' });
    await expect(ctrl.getTeam(undefined)).resolves.toEqual({ period: 'now' });
    expect(() => ctrl.getTeam('year')).toThrow(BadRequestException);
  });
});
