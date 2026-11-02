import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/create-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';
import { SAMPLE_PROPERTIES } from './sample-properties';

@Injectable()
export class PropertiesService implements OnModuleInit {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  async onModuleInit() {
    await this.seedProperties();
  }

  async seedProperties() {
    try {
      const count = await this.propertyRepository.count();
      if (count === 0) {
        this.logger.log('Seeding 10 initial properties...');
        await this.propertyRepository.save(
          this.propertyRepository.create(SAMPLE_PROPERTIES),
        );
        this.logger.log('Successfully seeded 10 properties.');
        return;
      }
      await this.backfillSampleDetails();
    } catch (error: any) {
      this.logger.warn(`Property seeding skipped or failed: ${error.message}`);
    }
  }

  // DB tạo trước khi có cột ảnh/mô tả: điền bù cho 10 căn mẫu theo tên.
  // Chỉ điền căn còn trống cả hai ô, để quản lý cố ý xoá một ô thì lần khởi động sau không bị điền lại.
  private async backfillSampleDetails() {
    let filled = 0;
    for (const sample of SAMPLE_PROPERTIES) {
      const result = await this.propertyRepository
        .createQueryBuilder()
        .update(Property)
        .set({ imageUrl: sample.imageUrl, description: sample.description })
        .where('name = :name AND image_url IS NULL AND description IS NULL', { name: sample.name })
        .execute();
      filled += result.affected ?? 0;
    }
    if (filled > 0) this.logger.log(`Backfilled image and description for ${filled} sample properties.`);
  }

  // Công khai: không trả các căn đã ẩn. Bộ lọc để trống thì trả hết như trước
  findAll(filter: SearchPropertyDto = {}): Promise<Property[]> {
    const qb = this.propertyRepository
      .createQueryBuilder('p')
      .where('p.status <> :hidden', { hidden: 'HIDDEN' });

    if (filter.q) {
      // thoát ký tự đặc biệt của LIKE để "50%" không khớp mọi thứ
      const like = `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(p.name ILIKE :like OR p.address ILIKE :like)', { like });
    }
    if (filter.minPrice !== undefined) qb.andWhere('p.price >= :minPrice', { minPrice: filter.minPrice });
    if (filter.maxPrice !== undefined) qb.andWhere('p.price <= :maxPrice', { maxPrice: filter.maxPrice });
    if (filter.minArea !== undefined) qb.andWhere('p.area >= :minArea', { minArea: filter.minArea });
    if (filter.type) qb.andWhere('p.type = :type', { type: filter.type });

    qb.orderBy('p.id', 'ASC');
    if (filter.limit) qb.take(filter.limit);
    return qb.getMany();
  }

  findAllAdmin(): Promise<Property[]> {
    return this.propertyRepository.find({ order: { id: 'ASC' } });
  }

  create(dto: CreatePropertyDto): Promise<Property> {
    return this.propertyRepository.save(
      this.propertyRepository.create({ ...dto, status: dto.status ?? 'AVAILABLE' }),
    );
  }

  async update(id: number, dto: UpdatePropertyDto): Promise<Property> {
    const property = await this.findOne(id);
    Object.assign(property, dto);
    return this.propertyRepository.save(property);
  }

  async findOne(id: number): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException(`Property with id ${id} not found`);
    }

    return property;
  }
}