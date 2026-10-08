import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../leads/entities/lead.entity';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepository: Repository<Lead>,
  ) {}

  async getStats() {
    const total = await this.leadRepository.count();

    const hot = await this.leadRepository.count({
      where: { level: 'HOT' },
    });

    const warm = await this.leadRepository.count({
      where: { level: 'WARM' },
    });

    const cold = await this.leadRepository.count({
      where: { level: 'COLD' },
    });

    return {
      total,
      hot,
      warm,
      cold,
    };
  }
}