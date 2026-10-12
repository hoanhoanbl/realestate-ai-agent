import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
    @InjectRepository(LeadEvent)
    private readonly leadEventRepository: Repository<LeadEvent>,
    @InjectRepository(Viewing)
    private readonly viewingRepository: Repository<Viewing>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
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

    return this.leadRepository.save(lead);
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
}