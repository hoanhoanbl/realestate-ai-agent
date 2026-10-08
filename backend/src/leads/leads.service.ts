import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
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

  async updateAiResult(
    id: number,
    data: {
      score: number;
      level: string;
      reason?: string;
      aiReply?: string;
      emailSent?: boolean;
      telegramNotified?: boolean;
    },
  ): Promise<Lead> {
    const lead = await this.findOne(id);

    lead.score = data.score;
    lead.level = data.level;
    if (data.reason !== undefined) lead.reason = data.reason;
    if (data.aiReply !== undefined) lead.aiReply = data.aiReply;
    if (data.emailSent !== undefined) lead.emailSent = data.emailSent;
    if (data.telegramNotified !== undefined) lead.telegramNotified = data.telegramNotified;
    lead.automationStatus = 'COMPLETED';

    return this.leadRepository.save(lead);
  }
}