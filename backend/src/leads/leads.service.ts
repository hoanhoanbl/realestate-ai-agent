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

    return this.leadRepository.save(lead);
  }
}