import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { LeadsService } from '../leads/leads.service';
import { lockProperty } from '../viewings/booking-rules';
import type { AuthUser } from '../auth/auth.types';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/create-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';
import { SAMPLE_PROPERTIES } from './sample-properties';

@Injectable()
export class PropertiesService implements OnModuleInit {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
    private readonly leadsService: LeadsService,
  ) {}

  async onModuleInit() {
    await this.seedProperties();
    await this.backfillReserved();
  }

  // Căn đã có hợp đồng còn hiệu lực từ trước khi có trạng thái RESERVED: chuyển sang RESERVED (chạy lại nhiều lần không sao)
  private async backfillReserved() {
    try {
      const rows: { id: number }[] = await this.propertyRepository.query(
        `UPDATE properties p SET status = 'RESERVED'
          WHERE p.status = 'AVAILABLE'
            AND EXISTS (SELECT 1 FROM contracts c WHERE c.property_id = p.id
                         AND c.status IN ('DRAFTING', 'PENDING_APPROVAL', 'SENT', 'SIGNED'))
          RETURNING p.id`,
      );
      const ids = Array.isArray(rows[0]) ? (rows[0] as { id: number }[]) : rows;
      if (ids.length > 0) this.logger.log(`Marked ${ids.length} properties with active contracts as RESERVED.`);
    } catch (error: any) {
      this.logger.warn(`Reserved backfill skipped: ${error.message}`);
    }
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

  // Công khai: không trả các căn đã ẩn hoặc đã bán (căn đang giữ cọc vẫn hiện, kèm nhãn). Bộ lọc để trống thì trả hết như trước
  findAll(filter: SearchPropertyDto = {}): Promise<Property[]> {
    const qb = this.propertyRepository
      .createQueryBuilder('p')
      .where('p.status NOT IN (:...hidden)', { hidden: ['HIDDEN', 'SOLD'] });

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
    if (dto.status === 'SOLD') throw new BadRequestException('Căn mới chỉ được là AVAILABLE hoặc HIDDEN');
    return this.propertyRepository.save(
      this.propertyRepository.create({ ...dto, status: dto.status ?? 'AVAILABLE' }),
    );
  }

  async update(id: number, dto: UpdatePropertyDto, user?: AuthUser): Promise<Property> {
    const existing = await this.findOne(id);
    if (dto.status === undefined || dto.status === existing.status) {
      Object.assign(existing, dto);
      return this.propertyRepository.save(existing);
    }

    // Đổi trạng thái: khoá theo căn (chung khoá với tạo hợp đồng) để không ghi đè RESERVED vừa được đặt
    const next = dto.status;
    const { saved, soldLeadId } = await this.propertyRepository.manager.transaction(async (em) => {
      await lockProperty(em, id);
      const property = await em.findOne(Property, { where: { id } });
      if (!property) throw new NotFoundException(`Property with id ${id} not found`);
      const soldLeadId = await this.assertStatusChange(em, property, next);
      Object.assign(property, dto);
      return { saved: await em.save(property), soldLeadId };
    });
    if (soldLeadId !== null) {
      await this.leadsService.addEvent(soldLeadId, {
        type: 'PROPERTY_SOLD',
        note: `Căn "${saved.name}" đã bán${user ? ` (bởi ${user.name})` : ''}`,
      });
    }
    return saved;
  }

  // RESERVED do hợp đồng quyết định: còn hợp đồng hiệu lực thì không hiện lại / ẩn được; chỉ bán khi đã ký.
  // Trả về lead của hợp đồng đã ký khi chuyển sang SOLD (để ghi sự kiện), ngược lại null.
  private async assertStatusChange(em: EntityManager, property: Property, next: string): Promise<number | null> {
    const active: { id: number; status: string; lead_id: number }[] = await em.query(
      `SELECT id, status, lead_id FROM contracts
        WHERE property_id = $1 AND status IN ('DRAFTING', 'PENDING_APPROVAL', 'SENT', 'SIGNED')
        ORDER BY id DESC LIMIT 1`,
      [property.id],
    );
    const contract = active[0];
    if (next === 'SOLD') {
      if (property.status !== 'RESERVED' || contract?.status !== 'SIGNED') {
        throw new BadRequestException('Chỉ đánh dấu "đã bán" được khi căn đang giữ cọc và hợp đồng đã ký');
      }
      return contract.lead_id;
    }
    if (contract) {
      throw new ConflictException(
        `Căn này đang có hợp đồng #${contract.id} (${contract.status}), không đổi trạng thái được`,
      );
    }
    return null;
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