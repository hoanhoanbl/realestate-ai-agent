import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';
import { N8nService } from '../n8n/n8n.service';
import type { AuthUser } from '../auth/auth.types';

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
    return { ...lead, viewing, property };
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
    const lead = await this.findOne(id);

    lead.score = data.score;
    lead.level = data.level;
    if (data.reason !== undefined) lead.reason = data.reason;
    if (data.aiReply !== undefined) lead.aiReply = data.aiReply;
    if (data.emailSent !== undefined) lead.emailSent = data.emailSent;
    if (data.staffNotified !== undefined) lead.staffNotified = data.staffNotified;
    if (data.approvalUrl !== undefined) lead.approvalUrl = data.approvalUrl;
    lead.automationStatus = 'COMPLETED';

    const saved = await this.leadRepository.save(lead);
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
    const lead = await this.findOne(id);

    lead.automationStatus = data.status;
    if (data.error !== undefined) {
      lead.automationError = data.error;
    }

    return this.leadRepository.save(lead);
  }

  async updateStatus(
    id: number,
    data: { status: string; note?: string },
  ): Promise<Lead> {
    const lead = await this.findOne(id);
    const oldStatus = lead.status;
    if (oldStatus === data.status) return lead; // trung trang thai: khong doi, khong ghi log
    lead.status = data.status;
    const saved = await this.leadRepository.save(lead);
    await this.addEvent(id, {
      type: 'STATUS_CHANGED',
      note: `${oldStatus} -> ${data.status}${data.note ? `: ${data.note}` : ''}`,
    });
    this.fireLeadChanged(saved, 'status_changed');
    return saved;
  }

  async addEvent(
    id: number,
    data: { type: string; note?: string },
  ): Promise<LeadEvent> {
    await this.findOne(id); // 404 neu lead khong ton tai
    return this.leadEventRepository.save(
      this.leadEventRepository.create({
        leadId: id,
        type: data.type,
        note: data.note ?? null,
      }),
    );
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

    // Cách 1: bấm link duyệt của lần chạy n8n đang chờ (giống nút trong email)
    if (lead.approvalUrl) {
      try {
        await this.n8nService.resume(lead.approvalUrl, 'approve');
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
    return { via: 'manual' };
  }

  // Nhân viên tự đặt trạng thái VIEWED (đã xem) hoặc LOST (mất khách / khách không đến)
  async adminSetStatus(id: number, data: { status: string; note?: string }, user: AuthUser): Promise<Lead> {
    const lead = await this.findOne(id);
    if (data.status === 'VIEWED' && lead.status !== 'CONFIRMED') {
      throw new BadRequestException('Chỉ đánh dấu "đã xem" được khi khách đã chốt lịch (CONFIRMED)');
    }
    if (data.status === 'LOST' && (lead.status === 'SIGNED' || lead.status === 'LOST')) {
      throw new BadRequestException('Khách này đã ký hoặc đã mất, không đổi được');
    }
    return this.updateStatus(id, {
      status: data.status,
      note: `${data.note ? data.note + ' ' : ''}(bởi ${user.name})`,
    });
  }

  // Gọi webhook lead-changed cho n8n (L7 đồng bộ sang Mautic). Không có URL thì bỏ qua.
  private fireLeadChanged(lead: Lead, trigger: string): void {
    const url = process.env.N8N_LEAD_CHANGED_URL;
    if (!url) return;

    const payload = {
      event: 'lead_changed',
      trigger,
      leadId: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
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
