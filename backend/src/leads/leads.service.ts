import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';
import { N8nService } from '../n8n/n8n.service';
import type { AuthUser } from '../auth/auth.types';
import { assertViewingStarted } from '../viewings/viewing-time';
import { NORMALIZED_PHONE_SQL } from './intake-rules';
import { User } from '../users/entities/user.entity';
import { closeFeedbackWork } from '../feedback/feedback-work.lifecycle';
import { manualLostReason, planContactAttempt, planContactMark } from './contact.rules';
import { assertSaleFreeForApproval } from '../viewings/booking-rules';

// Khách đang DEPOSIT có hợp đồng còn hiệu lực và căn đang "Đang giữ cọc". Đóng lead lúc này thì hợp đồng
// vẫn còn và căn bị khoá. Quản lý phải từ chối hợp đồng trước: lead tự về VIEWED, căn tự về "Đang bán" (BF-06).
export function assertNotLosingDeposit(fromStatus: string, toStatus: string): void {
  if (fromStatus === 'DEPOSIT' && toStatus === 'LOST') {
    throw new BadRequestException(
      'Khách đang đặt cọc, chưa chuyển sang "Không mua" được. Quản lý từ chối hợp đồng trước, khách sẽ về "Đã xem nhà".',
    );
  }
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadEvent)
    private readonly leadEventRepository: Repository<LeadEvent>,
    @InjectRepository(Viewing)
    private readonly viewingRepository: Repository<Viewing>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly n8nService: N8nService,
  ) {}

  findAll(level?: string): Promise<Lead[]> {
    if (level) {
      return this.leadRepository.find({
        where: { level },
        order: { createdAt: 'DESC' },
      });
    }

    return this.leadRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Lead> {
    const lead = await this.leadRepository.findOne({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead with id ${id} not found`,
      );
    }

    return lead;
  }

  async findMauticContext(id: number) {
    const lead = await this.findOne(id);
    const { name, email, phone, phoneNormalized, level, status, source, score, mauticContactId } = lead;
    return { leadId: id, name, email, phone, phoneNormalized, level, status, source, score, mauticContactId };
  }

  // Cho GET /leads/:id: tra them viewing va property
  async findDetail(id: number) {
    const lead = await this.findOne(id);
    const viewing = await this.viewingRepository.findOne({
      where: { leadId: id },
      order: { id: 'DESC' },
    });
    const property = viewing
      ? await this.propertyRepository.findOne({
          where: { id: viewing.propertyId },
        })
      : null;
    // Chỉ liệt kê bản ghi cũ trùng điện thoại; FE-33 không tự gộp/xoá lịch sử.
    const otherBookings: {
      id: number;
      status: string;
      createdAt: Date;
      propertyName: string | null;
      viewingTime: Date | null;
    }[] = await this.leadRepository.query(
      `SELECT l.id, l.status, l.created_at AS "createdAt",
              p.name AS "propertyName", v.viewing_time AS "viewingTime"
         FROM leads l
         LEFT JOIN LATERAL (SELECT * FROM viewings WHERE lead_id = l.id ORDER BY id DESC LIMIT 1) v ON true
         LEFT JOIN properties p ON p.id = v.property_id
        WHERE ${NORMALIZED_PHONE_SQL} = $1 AND l.id <> $2
        ORDER BY l.created_at DESC
        LIMIT 20`,
      [lead.phoneNormalized ?? lead.phone.replace(/[\s.()-]/g, '').replace(/^\+84/, '0'), lead.id],
    );
    const owner = lead.assignedUserId ? await this.leadRepository.manager.findOne(User, { where: { id: lead.assignedUserId } }) : null;
    const assignedUser = owner ? { id: owner.id, name: owner.name, email: owner.email,
      role: owner.role, telegramChatId: owner.telegramChatId, acceptingLeads: owner.acceptingLeads } : null;
    // Lịch sử các buổi xem của khách, mới nhất trước (buổi đầu tiên là buổi hiện tại nếu còn mở)
    const viewings: {
      id: number;
      propertyId: number;
      propertyName: string | null;
      propertyPrice: string | null;
      propertyStatus: string | null;
      viewingTime: Date | null;
      status: string;
    }[] = await this.leadRepository.query(
      `SELECT v.id, v.property_id AS "propertyId", p.name AS "propertyName",
              p.price AS "propertyPrice", p.status AS "propertyStatus",
              v.viewing_time AS "viewingTime", v.status
         FROM viewings v LEFT JOIN properties p ON p.id = v.property_id
        WHERE v.lead_id = $1
        ORDER BY v.id DESC`,
      [id],
    );
    return { ...lead, viewing, property, otherBookings, assignedUser, viewings };
  }

  async updateAiResult(
    id: number,
    data: {
      score: number;
      level: string;
      reason?: string;
      aiReply?: string;
      emailSent?: boolean;
      staffNotified?: boolean;
      approvalUrl?: string;
    },
  ): Promise<Lead> {
    const { approvalUrl, ...scores } = data;
    // Ghi riêng cột AI; không save bản ghi cũ có thể đè trạng thái LOST vừa được L2 đóng.
    await this.leadRepository.update(id, { ...scores, automationStatus: 'COMPLETED' });
    if (approvalUrl !== undefined) await this.leadRepository.update({ id, status: 'NEW' }, { approvalUrl });
    const saved = await this.findOne(id);
    this.fireLeadChanged(saved, 'ai_result');
    return saved;
  }

  async updateAutomationStatus(
    id: number,
    data: {
      status: string;
      error?: string;
    },
  ): Promise<Lead> {
    await this.leadRepository.update(id, {
      automationStatus: data.status,
      ...(data.error !== undefined ? { automationError: data.error } : {}),
    });
    return this.findOne(id);
  }

  async updateStatus(
    id: number,
    data: { status: string; note?: string; lostReason?: string },
  ): Promise<Lead> {
    const reason = data.status === 'LOST' ? manualLostReason(data.lostReason) : undefined;
    const result = await this.leadRepository.manager.transaction(async em => {
      // Cùng khóa với L2: callback duyệt cũ không mở lại lead vừa bị đóng EXPIRED.
      const repo = em.getRepository(Lead);
      const lead = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!lead) throw new NotFoundException(`Lead with id ${id} not found`);
      const oldStatus = lead.status;
      if (oldStatus === data.status) return { saved: lead, changed: false };
      if (oldStatus === 'LOST') throw new BadRequestException('Khách đã đóng, không dùng lại thao tác duyệt cũ. Hãy tạo lịch mới.');
      assertNotLosingDeposit(oldStatus, data.status);
      lead.status = data.status;
      // Callback duyệt qua email/Telegram cũng là thao tác đầu tiên, không chỉ nút trên web.
      if (oldStatus === 'NEW' && data.status === 'CONFIRMED' && !lead.firstResponseAt) {
        lead.firstResponseAt = new Date();
      }
      if (data.status === 'LOST') {
        lead.lostReason = reason!;
        await em.getRepository(Viewing).update({ leadId: id, status: 'NEW' }, { status: 'CANCELLED' });
      }
      const saved = await repo.save(lead);
      if (['LOST', 'SIGNED'].includes(data.status)) await closeFeedbackWork(em, id, 'Khách đã đóng hoặc đã ký');
      await em.getRepository(LeadEvent).save({ leadId: id, type: 'STATUS_CHANGED',
        note: `${oldStatus} -> ${data.status}${data.note ? `: ${data.note}` : ''}` });
      return { saved, changed: true };
    });
    if (result.changed) this.fireLeadChanged(result.saved, 'status_changed');
    return result.saved;
  }

  // Một buổi xem kết thúc mà khách chưa đến (khách huỷ, không đến): chỉ buổi xem đó kết thúc, lead không bị đóng.
  // Lead về trạng thái gốc: VIEWED nếu có buổi xem khác đã đến, không thì CONSULTING (sale tiếp tục chăm).
  // Đóng lead là thao tác riêng của nhân viên ("Mất khách").
  async restoreBaseStatus(id: number, note: string): Promise<Lead> {
    const attended = await this.viewingRepository.countBy({ leadId: id, status: 'ATTENDED' });
    return this.updateStatus(id, { status: attended > 0 ? 'VIEWED' : 'CONSULTING', note });
  }

  async findByMauticId(contactId: number, email?: string): Promise<Lead | null> {
    let lead = await this.leadRepository.findOne({
      where: { mauticContactId: contactId },
    });
    if (!lead && email) {
      lead = await this.leadRepository.findOne({
        where: { email: email.trim().toLowerCase() },
      });
      if (lead && !lead.mauticContactId) {
        await this.leadRepository.update(lead.id, { mauticContactId: contactId });
        return this.findOne(lead.id);
      }
    }
    return lead;
  }

  async updateMautic(
    id: number,
    data: { mauticContactId?: number; mauticPoints?: number },
  ): Promise<Lead> {
    const patch = {
      ...(data.mauticContactId !== undefined ? { mauticContactId: data.mauticContactId } : {}),
      ...(data.mauticPoints !== undefined ? { mauticPoints: data.mauticPoints } : {}),
    };
    if (Object.keys(patch).length) await this.leadRepository.update(id, patch);
    return this.findOne(id);
  }

  async addEvent(
    id: number,
    data: { type: string; note?: string },
  ): Promise<LeadEvent> {
    return this.leadRepository.manager.transaction(async em => {
      const repo = em.getRepository(Lead);
      const lead = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!lead) throw new NotFoundException(`Lead with id ${id} not found`);
      const event = await em.getRepository(LeadEvent).save({
        leadId: id, type: data.type, note: data.note ?? null,
      });
      // Các sự kiện này chỉ phát sau thao tác nhân viên; không tính AI, nhắc lịch hay timeout.
      if (['APPROVED', 'RESCHEDULE_REQUESTED', 'VIEWING_RESCHEDULED'].includes(data.type) && !lead.firstResponseAt) {
        lead.firstResponseAt = event.createdAt;
        await repo.save(lead);
      }
      return event;
    });
  }

  findEvents(id: number): Promise<LeadEvent[]> {
    return this.leadEventRepository.find({
      where: { leadId: id },
      order: { createdAt: 'ASC' },
    });
  }

  // Nhân viên bấm Duyệt trên web admin / app. n8n vẫn là nơi xử lý: gửi email chốt lịch, đổi trạng thái, ghi log.
  async approve(id: number, user: AuthUser): Promise<{ via: 'resume' | 'manual' }> {
    const lead = await this.leadRepository
      .createQueryBuilder('l')
      .addSelect('l.approvalUrl')
      .where('l.id = :id', { id })
      .getOne();
    if (!lead) throw new NotFoundException(`Lead with id ${id} not found`);
    if (lead.status !== 'NEW') {
      throw new BadRequestException('Chỉ duyệt được khách đang ở trạng thái NEW');
    }
    if (lead.automationStatus === 'PENDING') {
      throw new BadRequestException('AI chưa chấm điểm xong, chưa duyệt được');
    }
    // FE-53: sale phụ trách bận ở căn khác trong 90 phút thì chặn trước khi gọi n8n, kể cả quản lý duyệt thay
    await assertSaleFreeForApproval(this.leadRepository.manager, id);

    // Cách 1: bấm link duyệt của lần chạy n8n đang chờ (giống nút trong email)
    if (lead.approvalUrl) {
      try {
        await this.n8nService.resume(lead.approvalUrl, 'approve');
        await this.recordFirstResponse(id, user);
        return { via: 'resume' };
      } catch (err: any) {
        const status = err?.response?.status;
        // Link đã hết hạn / đã dùng thì chuyển sang cách 2. Lỗi khác (vd. 500) thì báo lên, không gửi trùng.
        if (![401, 403, 404, 409, 410].includes(status)) {
          throw new BadGatewayException(`n8n báo lỗi khi duyệt: ${err?.message ?? status}`);
        }
      }
    }

    // Cách 2: luồng chốt lịch thủ công của n8n (nhân viên bỏ quá 24 giờ, hoặc đã bấm "Đổi giờ" trong email)
    try {
      await this.n8nService.callWebhook('viewing-admin-action', { event: 'approved', leadId: id, by: user.name });
    } catch {
      throw new BadGatewayException('Không gọi được n8n để chốt lịch');
    }
    await this.recordFirstResponse(id, user);
    return { via: 'manual' };
  }

  markContacted(id: number, user: AuthUser): Promise<Lead> {
    return this.saveContact(id, user, { kind: 'mark' });
  }

  recordContactAttempt(id: number, result: unknown, user: AuthUser): Promise<Lead> {
    return this.saveContact(id, user, { kind: 'attempt', result });
  }

  private async saveContact(id: number, user: AuthUser, action: { kind: 'mark' } | { kind: 'attempt'; result: unknown }): Promise<Lead> {
    const result = await this.leadRepository.manager.transaction(async em => {
      const repo = em.getRepository(Lead);
      const lead = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!lead) throw new NotFoundException(`Lead with id ${id} not found`);
      const now = new Date();
      const plan = action.kind === 'mark' ? planContactMark(lead, user, now) : planContactAttempt(lead, user, action.result, now);
      if (Object.keys(plan.patch).length) {
        Object.assign(lead, plan.patch);
        await repo.save(lead);
      }
      if (plan.event) await em.getRepository(LeadEvent).save({ leadId: id, ...plan.event });
      return { saved: lead, changed: Object.keys(plan.patch).length > 0 || plan.event !== null };
    });
    // Notify only after commit; a rolled-back write must never trigger downstream work.
    if (result.changed) this.fireLeadChanged(result.saved, action.kind === 'mark' ? 'contacted' : 'contact_attempted');
    return result.saved;
  }

  // Nhân viên tự đặt VIEWED hoặc đóng LOST bằng một lý do thủ công.
  async adminSetStatus(
    id: number,
    data: { status: string; note?: string; reason?: string },
    user: AuthUser,
  ): Promise<Lead> {
    if (data.status === 'VIEWED') {
      const lead = await this.findOne(id);
      const viewing = await this.viewingRepository.findOne({ where: { leadId: id }, order: { id: 'DESC' } });
      if (!viewing) throw new BadRequestException('Khách chưa có lịch xem');
      return this.markAttended(lead, viewing, user, data.note);
    }
    if (data.status !== 'LOST') throw new BadRequestException('Trạng thái thủ công không hợp lệ');
    const reason = manualLostReason(data.reason);
    const saved = await this.leadRepository.manager.transaction(async em => {
      const repo = em.getRepository(Lead);
      const lead = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!lead) throw new NotFoundException(`Lead with id ${id} not found`);
      if (['SIGNED', 'LOST'].includes(lead.status)) throw new BadRequestException('Khách này đã ký hoặc đã mất, không đổi được');
      assertNotLosingDeposit(lead.status, 'LOST');
      const old = lead.status;
      lead.status = 'LOST'; lead.lostReason = reason;
      if (!lead.firstResponseAt && (user.role === 'MANAGER' || user.id === lead.assignedUserId)) lead.firstResponseAt = new Date();
      await em.getRepository(Viewing).update({ leadId: id, status: 'NEW' }, { status: 'CANCELLED' });
      await repo.save(lead);
      await closeFeedbackWork(em, id, 'Khách không mua');
      await em.getRepository(LeadEvent).save({ leadId: id, type: 'STATUS_CHANGED', actorUserId: user.id,
        note: `${old} -> LOST: ${reason}${data.note ? ` - ${data.note}` : ''} (bởi ${user.name})` });
      return lead;
    });
    this.fireLeadChanged(saved, 'status_changed');
    return saved;
  }

  // Khách có đến xem: buổi xem ATTENDED, khách VIEWED. Dùng cho cả nút "Đã xem nhà" cũ và API ghi nhận buổi xem.
  async markAttended(lead: Lead, viewing: Viewing, user: AuthUser, note?: string): Promise<Lead> {
    const saved = await this.leadRepository.manager.transaction(async em => {
      const repo = em.getRepository(Lead);
      const current = await repo.findOne({ where: { id: lead.id }, lock: { mode: 'pessimistic_write' } });
      if (!current) throw new NotFoundException(`Lead with id ${lead.id} not found`);
      const views = em.getRepository(Viewing);
      const currentViewing = await views.findOne({ where: { id: viewing.id, leadId: current.id }, lock: { mode: 'pessimistic_write' } });
      if (!currentViewing) throw new BadRequestException('Buổi xem không thuộc khách này');
      if (current.status !== 'CONFIRMED') throw new BadRequestException('Chỉ đánh dấu "đã xem" được khi khách đã chốt lịch (CONFIRMED)');
      if (currentViewing.status !== 'NEW') throw new BadRequestException('Buổi xem này đã được ghi nhận rồi');
      assertViewingStarted(currentViewing.viewingTime);
      const now = new Date();
      currentViewing.status = 'ATTENDED'; current.status = 'VIEWED';
      if (!current.contactedAt) {
        current.contactedAt = now;
        await em.getRepository(LeadEvent).save({ leadId: current.id, type: 'CONTACTED', actorUserId: user.id,
          note: `Đã liên hệ được khi điểm danh có đến buổi xem #${viewing.id}` });
      }
      if (!current.firstResponseAt && (user.role === 'MANAGER' || user.id === current.assignedUserId)) current.firstResponseAt = now;
      await views.save(currentViewing);
      await repo.save(current);
      await em.getRepository(LeadEvent).save({ leadId: current.id, type: 'STATUS_CHANGED', actorUserId: user.id,
        note: `CONFIRMED -> VIEWED${note ? `: ${note}` : ''} (bởi ${user.name})` });
      return current;
    });
    this.fireLeadChanged(saved, 'status_changed');
    return saved;
  }

  async recordFirstResponse(id: number, user: AuthUser): Promise<void> {
    await this.leadRepository.update({ id, firstResponseAt: IsNull(),
      ...(user.role === 'MANAGER' ? {} : { assignedUserId: user.id }) }, { firstResponseAt: new Date() });
  }

  // Called only after the follow-up transaction has committed its status/event changes.
  async notifyFollowupStatusChanged(id: number): Promise<void> {
    this.fireLeadChanged(await this.findOne(id), 'status_changed');
  }

  // Gọi webhook lead-changed cho n8n (L7 đồng bộ sang Mautic). Không có URL thì bỏ qua.
  private fireLeadChanged(lead: Lead, trigger: string): void {
    const url = process.env.N8N_LEAD_CHANGED_URL;
    if (!url) return;
    // Luồng 7 tìm và tạo Contact Mautic theo email; lead nhập tay hoặc từ bot chưa có email thì chưa đồng bộ được (FE-40)
    if (!lead.email) return;

    const payload = {
      event: 'lead_changed',
      trigger,
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      phoneNormalized: lead.phoneNormalized,
      mauticContactId: lead.mauticContactId,
      level: lead.level,
      status: lead.status,
      source: lead.source,
      score: lead.score,
    };

    this.n8nService.callWebhook(url.replace(/.*\/webhook\//, ''), payload).catch((err) => {
      this.logger.warn(`Webhook lead-changed cho lead ${lead.id} thất bại: ${err.message}`);
    });
  }
}
