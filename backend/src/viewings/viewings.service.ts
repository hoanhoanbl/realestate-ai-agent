import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { Viewing } from './entities/viewing.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Property } from '../properties/entities/property.entity';
import { CreateViewingDto } from './dto/create-viewing.dto';
import { AttendanceDto, UpdateViewingDto } from './dto/update-viewing.dto';
import { assertViewingStarted, parseViewingTime } from './viewing-time';
import { assertNoBookingConflict, lockProperty } from './booking-rules';
import { LeadsService } from '../leads/leads.service';
import { LeadIntakeService } from '../leads/lead-intake.service';
import { N8nService } from '../n8n/n8n.service';
import type { AuthUser } from '../auth/auth.types';

const fmt = (d: Date) => new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

@Injectable()
export class ViewingsService {
  private readonly logger = new Logger(ViewingsService.name);

  constructor(
    @InjectRepository(Viewing)
    private readonly viewingRepository: Repository<Viewing>,
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly httpService: HttpService,
    private readonly leadsService: LeadsService,
    private readonly n8nService: N8nService,
    private readonly intake: LeadIntakeService,
  ) {}

  async create(createViewingDto: CreateViewingDto): Promise<{ viewing: Viewing; lead: Lead }> {
    const {
      name,
      email,
      phone,
      budget,
      needs,
      propertyId,
      viewingTime,
      source,
      consentMarketing,
      website,
    } = createViewingDto;

    // Ô bẫy bot có chữ: không lưu gì
    if (website && website.trim() !== '') {
      throw new BadRequestException('Yêu cầu không hợp lệ');
    }

    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${propertyId} not found`);
    }
    if (property.status !== 'AVAILABLE') {
      throw new BadRequestException('Căn nhà này hiện không nhận đặt lịch xem');
    }

    const { text: normalizedViewingTime, date: viewingDate } = parseViewingTime(viewingTime);

    // Kiểm tra trùng và ghi trong cùng một transaction, khoá theo căn để hai yêu cầu cùng lúc không lọt cả hai
    const { savedLead, savedViewing } = await this.viewingRepository.manager.transaction(async (em) => {
      await lockProperty(em, propertyId);
      // Đọc lại trong khoá: hợp đồng cọc có thể vừa chuyển căn sang RESERVED
      const current = await em.findOne(Property, { where: { id: propertyId } });
      if (!current || current.status !== 'AVAILABLE') {
        throw new BadRequestException('Căn nhà này hiện không nhận đặt lịch xem');
      }
      await assertNoBookingConflict(em, propertyId, viewingDate);

      const { lead: savedLead } = await this.intake.receive(em, {
        name, email, phone, budget, needs, source: source || 'direct', consentMarketing,
        interestedPropertyIds: [propertyId],
      }, { status: 'NEW', firstViewingOnly: true });
      const savedViewing = await em.save(
        em.create(Viewing, {
          propertyId,
          leadId: savedLead.id,
          viewingTime: viewingDate,
          status: 'NEW',
          manageToken: crypto.randomBytes(16).toString('hex'),
        }),
      );
      return { savedLead, savedViewing };
    });

    // Call n8n webhook asynchronously so lead/viewing saving isn't blocked by n8n failure
    this.triggerN8nWebhook(savedLead, propertyId, normalizedViewingTime, savedViewing.manageToken).catch((err) => {
      this.logger.error(`Error triggering n8n webhook: ${err.message}`);
    });

    return { viewing: savedViewing, lead: savedLead };
  }

  private async triggerN8nWebhook(
    lead: Lead,
    propertyId: number,
    viewingTime: string,
    manageToken: string | null,
  ): Promise<void> {
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL ||
      'http://localhost:5678/webhook-test/viewing-requested';
    const webhookSecret = process.env.WEBHOOK_SECRET || '';

    const payload = {
      event: 'viewing_requested',
      eventId: lead.eventId || crypto.randomUUID(),
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      budget: Number(lead.budget),
      needs: lead.needs || '',
      source: lead.source || 'direct',
      propertyId,
      viewingTime,
      manageToken,
    };

    const maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        await firstValueFrom(
          this.httpService.post(webhookUrl, payload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': webhookSecret,
            },
            timeout: 5000,
          }),
        );
        success = true;
        this.logger.log(`Successfully triggered n8n webhook for lead ${lead.id} on attempt ${attempt}`);
      } catch (error: any) {
        this.logger.warn(
          `Attempt ${attempt} to trigger n8n webhook failed: ${error.message}`,
        );
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (!success) {
      this.logger.error(
        `Failed to trigger n8n webhook for lead ${lead.id} after ${maxRetries} attempts. Setting automationStatus to FAILED.`,
      );
      // Chỉ cập nhật 2 cột này. Không save(lead) cả bản ghi: sau vài giây nhân viên có thể đã đổi
      // trạng thái khách, save cả bản ghi cũ sẽ ghi đè trạng thái đó về NEW.
      await this.leadRepository.update(lead.id, {
        automationStatus: 'FAILED',
        automationError: `Không gọi được n8n sau ${maxRetries} lần thử`,
      });
    }
  }

  findAll(): Promise<Viewing[]> {
    return this.viewingRepository.find();
  }

  // Lịch xem kèm thông tin khách và căn nhà, cho trang "Lịch xem" của admin
  async findSchedule() {
    return this.viewingRepository
      .createQueryBuilder('v')
      .innerJoin(Lead, 'l', 'l.id = v.lead_id')
      .innerJoin(Property, 'p', 'p.id = v.property_id')
      .select([
        'v.id AS "id"',
        'v.viewing_time AS "viewingTime"',
        'v.status AS "viewingStatus"',
        'v.lead_id AS "leadId"',
        'l.name AS "leadName"',
        'l.phone AS "leadPhone"',
        'l.level AS "leadLevel"',
        'l.status AS "leadStatus"',
        'p.id AS "propertyId"',
        'p.name AS "propertyName"',
        'p.address AS "propertyAddress"',
        'p.status AS "propertyStatus"',
      ])
      .orderBy('v.viewing_time', 'ASC')
      .getRawMany();
  }

  // Nhân viên đổi giờ xem. Khách đã chốt lịch (CONFIRMED) thì n8n gửi email báo giờ mới.
  async update(id: number, dto: UpdateViewingDto, user: AuthUser): Promise<Viewing> {
    const viewing = await this.viewingRepository.findOne({ where: { id } });
    if (!viewing) throw new NotFoundException(`Viewing with id ${id} not found`);

    const lead = await this.leadsService.findOne(viewing.leadId);
    if (lead.status !== 'NEW' && lead.status !== 'CONFIRMED') {
      throw new BadRequestException('Chỉ đổi giờ được khi khách đang ở trạng thái NEW hoặc CONFIRMED');
    }
    if (viewing.status !== 'NEW') {
      throw new BadRequestException('Buổi xem này đã kết thúc hoặc đã huỷ, không đổi giờ được');
    }

    return this.reschedule(viewing, lead, dto.viewingTime, user);
  }

  // Đổi giờ trên chính dòng viewing (mỗi khách chỉ một dòng), có kiểm tra trùng lịch của căn
  // noShowNote: hẹn lại sau khi khách không đến; chỉ ghi sự kiện VIEWING_NO_SHOW khi giờ mới đã qua kiểm tra trùng
  private async reschedule(
    viewing: Viewing,
    lead: Lead,
    rawTime: string,
    user: AuthUser,
    noShowNote?: string,
  ): Promise<Viewing> {
    const { date } = parseViewingTime(rawTime);
    let oldTime = viewing.viewingTime;

    const saved = await this.viewingRepository.manager.transaction(async (em) => {
      await lockProperty(em, viewing.propertyId);
      const currentLead = await em.getRepository(Lead).findOne({ where: { id: lead.id }, lock: { mode: 'pessimistic_write' } });
      const currentViewing = await em.getRepository(Viewing).findOne({ where: { id: viewing.id }, lock: { mode: 'pessimistic_write' } });
      if (!currentLead || !['NEW', 'CONFIRMED'].includes(currentLead.status) || !currentViewing || currentViewing.status !== 'NEW') {
        throw new BadRequestException('Khách hoặc lịch đã được xử lý, hãy tải lại trước khi đổi giờ.');
      }
      await assertNoBookingConflict(em, viewing.propertyId, date, viewing.id);
      oldTime = currentViewing.viewingTime;
      lead.status = currentLead.status;
      currentViewing.viewingTime = date;
      return em.save(currentViewing);
    });

    if (noShowNote) {
      await this.leadsService.addEvent(lead.id, { type: 'VIEWING_NO_SHOW', note: noShowNote });
    }
    await this.leadsService.addEvent(lead.id, {
      type: 'VIEWING_RESCHEDULED',
      note: `${fmt(oldTime)} -> ${fmt(date)} (bởi ${user.name})`,
    });
    await this.leadsService.recordFirstResponse(lead.id, user);

    if (lead.status === 'CONFIRMED') {
      try {
        await this.n8nService.callWebhook('viewing-admin-action', {
          event: 'rescheduled',
          leadId: lead.id,
          by: user.name,
        });
      } catch {
        this.logger.warn(`Đã đổi giờ cho lead ${lead.id} nhưng chưa báo được khách (n8n lỗi)`);
      }
    }
    return saved;
  }

  // Nhân viên ghi nhận kết quả buổi xem: có đến / không đến (hẹn lại hoặc đóng)
  async recordAttendance(id: number, dto: AttendanceDto, user: AuthUser) {
    const viewing = await this.viewingRepository.findOne({ where: { id } });
    if (!viewing) throw new NotFoundException(`Viewing with id ${id} not found`);
    const lead = await this.leadsService.findOne(viewing.leadId);

    if (dto.outcome === 'ATTENDED') {
      return this.leadsService.markAttended(lead, viewing, user, dto.note);
    }

    if (lead.status !== 'CONFIRMED') {
      throw new BadRequestException('Chỉ ghi nhận "không đến" được khi khách đã chốt lịch (CONFIRMED)');
    }
    if (viewing.status !== 'NEW') {
      throw new BadRequestException('Buổi xem này đã được ghi nhận rồi');
    }
    assertViewingStarted(viewing.viewingTime);
    const by = `(bởi ${user.name})`;

    if (dto.next === 'RESCHEDULE') {
      await this.reschedule(
        viewing,
        lead,
        dto.viewingTime as string,
        user,
        `Khách không đến buổi xem ${fmt(viewing.viewingTime)}, hẹn lại ${dto.note ? dto.note + ' ' : ''}${by}`,
      );
      return this.leadsService.findOne(lead.id);
    }

    await this.viewingRepository.update(viewing.id, { status: 'NO_SHOW' });
    await this.leadsService.addEvent(lead.id, {
      type: 'VIEWING_NO_SHOW',
      note: `Khách không đến buổi xem ${fmt(viewing.viewingTime)} ${by}`,
    });
    return this.leadsService.updateStatus(lead.id, {
      status: 'LOST',
      lostReason: 'NO_SHOW',
      note: `Khách không đến ${dto.note ? dto.note + ' ' : ''}${by}`,
    });
  }

  // ---- Khách tự quản lý lịch qua link /lich/<token> ----

  private async findByManageToken(token: string): Promise<{ viewing: Viewing; lead: Lead; property: Property | null }> {
    const viewing = token ? await this.viewingRepository.findOne({ where: { manageToken: token } }) : null;
    if (!viewing) throw new NotFoundException('Liên kết không hợp lệ');
    const lead = await this.leadsService.findOne(viewing.leadId);
    const property = await this.propertyRepository.findOne({ where: { id: viewing.propertyId } });
    return { viewing, lead, property };
  }

  private canCustomerChange(viewing: Viewing, lead: Lead): boolean {
    return (
      (lead.status === 'NEW' || lead.status === 'CONFIRMED') &&
      viewing.status === 'NEW' &&
      viewing.viewingTime !== null &&
      viewing.viewingTime.getTime() > Date.now()
    );
  }

  private assertCustomerCanChange(viewing: Viewing, lead: Lead): void {
    if (!this.canCustomerChange(viewing, lead)) {
      throw new BadRequestException('Lịch này không còn thay đổi được. Vui lòng liên hệ nhân viên nếu cần hỗ trợ.');
    }
  }

  async getManageInfo(token: string) {
    const { viewing, lead, property } = await this.findByManageToken(token);
    return {
      leadName: lead.name,
      propertyName: property?.name ?? null,
      propertyAddress: property?.address ?? null,
      viewingTime: viewing.viewingTime,
      leadStatus: lead.status,
      viewingStatus: viewing.status,
      canChange: this.canCustomerChange(viewing, lead),
    };
  }

  async customerCancel(token: string): Promise<{ ok: true }> {
    const { viewing, lead } = await this.findByManageToken(token);
    this.assertCustomerCanChange(viewing, lead);
    await this.viewingRepository.update(viewing.id, { status: 'CANCELLED' });
    // Bỏ link duyệt đang chờ để web admin không duyệt nhầm lịch đã huỷ
    await this.leadRepository.update(lead.id, { approvalUrl: null });
    await this.leadsService.addEvent(lead.id, {
      type: 'VIEWING_CANCELLED',
      note: `Khách tự huỷ lịch xem ${fmt(viewing.viewingTime)} qua link trong email`,
    });
    await this.leadsService.updateStatus(lead.id, {
      status: 'LOST',
      lostReason: 'CUSTOMER_CANCELLED',
      note: 'Khách tự huỷ lịch',
    });
    return { ok: true };
  }

  async customerRescheduleRequest(token: string, note?: string): Promise<{ ok: true }> {
    const { viewing, lead } = await this.findByManageToken(token);
    this.assertCustomerCanChange(viewing, lead);
    // Bấm lại nhiều lần trong 10 phút chỉ ghi một yêu cầu
    const recent: unknown[] = await this.leadRepository.query(
      `SELECT 1 FROM lead_events WHERE lead_id = $1 AND type = 'CUSTOMER_RESCHEDULE_REQUESTED'
          AND created_at > now() - interval '10 minutes' LIMIT 1`,
      [lead.id],
    );
    if (recent.length > 0) return { ok: true };
    await this.leadsService.addEvent(lead.id, {
      type: 'CUSTOMER_RESCHEDULE_REQUESTED',
      note: `Khách xin đổi lịch ${fmt(viewing.viewingTime)}${note ? ': ' + note.trim() : ''}`,
    });
    return { ok: true };
  }
}
