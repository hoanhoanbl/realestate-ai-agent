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
import { UpdateViewingDto } from './dto/update-viewing.dto';
import { parseViewingTime } from './viewing-time';
import { LeadsService } from '../leads/leads.service';
import { N8nService } from '../n8n/n8n.service';
import type { AuthUser } from '../auth/auth.types';

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
  ) {}

  async create(createViewingDto: CreateViewingDto): Promise<{ viewing: Viewing; lead: Lead }> {
    const { name, email, phone, budget, needs, propertyId, viewingTime } = createViewingDto;

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

    const eventId = crypto.randomUUID();

    const lead = this.leadRepository.create({
      name,
      email,
      phone,
      budget,
      needs: needs || null,
      eventId,
      status: 'NEW',
      automationStatus: 'PENDING',
    });
    const savedLead = await this.leadRepository.save(lead);

    const viewing = this.viewingRepository.create({
      propertyId,
      leadId: savedLead.id,
      viewingTime: viewingDate,
      status: 'NEW',
    });
    const savedViewing = await this.viewingRepository.save(viewing);

    // Call n8n webhook asynchronously so lead/viewing saving isn't blocked by n8n failure
    this.triggerN8nWebhook(savedLead, propertyId, normalizedViewingTime).catch((err) => {
      this.logger.error(`Error triggering n8n webhook: ${err.message}`);
    });

    return { viewing: savedViewing, lead: savedLead };
  }

  private async triggerN8nWebhook(
    lead: Lead,
    propertyId: number,
    viewingTime: string,
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
      propertyId,
      viewingTime,
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
        'v.lead_id AS "leadId"',
        'l.name AS "leadName"',
        'l.phone AS "leadPhone"',
        'l.level AS "leadLevel"',
        'l.status AS "leadStatus"',
        'p.id AS "propertyId"',
        'p.name AS "propertyName"',
        'p.address AS "propertyAddress"',
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

    const { date } = parseViewingTime(dto.viewingTime);
    const fmt = (d: Date) => d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const oldTime = viewing.viewingTime;
    viewing.viewingTime = date;
    const saved = await this.viewingRepository.save(viewing);

    await this.leadsService.addEvent(lead.id, {
      type: 'VIEWING_RESCHEDULED',
      note: `${fmt(oldTime)} -> ${fmt(date)} (bởi ${user.name})`,
    });

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
}