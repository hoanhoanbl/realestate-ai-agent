import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Viewing } from './entities/viewing.entity';
import { CreateViewingDto } from './dto/create-viewing.dto';

@Injectable()
export class ViewingsService {
  constructor(
    @InjectRepository(Viewing)
    private readonly viewingRepository: Repository<Viewing>,
  ) {}

  async create(createViewingDto: CreateViewingDto): Promise<Viewing> {
    const { propertyId, leadId, viewingTime } = createViewingDto;

    const propertyExists = await this.viewingRepository.manager.query(
      'SELECT id FROM properties WHERE id = $1',
      [propertyId],
    );

    if (propertyExists.length === 0) {
      throw new NotFoundException('Property not found');
    }

    const leadExists = await this.viewingRepository.manager.query(
      'SELECT id FROM leads WHERE id = $1',
      [leadId],
    );

    if (leadExists.length === 0) {
      throw new NotFoundException('Lead not found');
    }

    const viewingDate = new Date(viewingTime);

    if (Number.isNaN(viewingDate.getTime())) {
      throw new BadRequestException('Invalid viewingTime');
    }

    const viewing = this.viewingRepository.create({
      property_id: propertyId,
      lead_id: leadId,
      viewing_time: viewingDate,
      status: 'NEW',
    });

    return this.viewingRepository.save(viewing);
  }

  findAll(): Promise<Viewing[]> {
    return this.viewingRepository.find();
  }
}