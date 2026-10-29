import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/create-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';

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
        const sampleProperties: Partial<Property>[] = [
          {
            name: 'Căn hộ Vinhomes Grand Park 2PN',
            address: 'Đường Nguyễn Xiển, Long Thạnh Mỹ, Quận 9, TP.HCM',
            price: 2800000000,
            area: 65.5,
            type: 'APARTMENT',
            status: 'AVAILABLE',
          },
          {
            name: 'Căn hộ Masteri Thảo Điền 3PN',
            address: '159 Xa Lộ Hà Nội, Thảo Điền, Quận 2, TP.HCM',
            price: 5200000000,
            area: 90.0,
            type: 'APARTMENT',
            status: 'AVAILABLE',
          },
          {
            name: 'Nhà phố Sun Group Đà Nẵng',
            address: 'Đường Nam Kỳ Khởi Nghĩa, Ngũ Hành Sơn, Đà Nẵng',
            price: 4500000000,
            area: 120.0,
            type: 'TOWNHOUSE',
            status: 'AVAILABLE',
          },
          {
            name: 'Biệt thự Ocean Villa Đà Nẵng',
            address: 'Đường Trường Sa, Hòa Hải, Ngũ Hành Sơn, Đà Nẵng',
            price: 15000000000,
            area: 350.0,
            type: 'VILLA',
            status: 'AVAILABLE',
          },
          {
            name: 'Căn hộ Landmark 81 Luxury',
            address: '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM',
            price: 8500000000,
            area: 82.0,
            type: 'APARTMENT',
            status: 'AVAILABLE',
          },
          {
            name: 'Nhà riêng Nguyễn Trãi Hà Nội',
            address: 'Đường Nguyễn Trãi, Thanh Xuân, Hà Nội',
            price: 6800000000,
            area: 75.0,
            type: 'TOWNHOUSE',
            status: 'AVAILABLE',
          },
          {
            name: 'Căn hộ Sun Grand City Tây Hồ',
            address: '69B Thụy Khuê, Tây Hồ, Hà Nội',
            price: 7200000000,
            area: 95.0,
            type: 'APARTMENT',
            status: 'AVAILABLE',
          },
          {
            name: 'Shophouse Phú Quốc Grand World',
            address: 'Gành Dầu, Phú Quốc, Kiên Giang',
            price: 9800000000,
            area: 110.0,
            type: 'SHOPHOUSE',
            status: 'AVAILABLE',
          },
          {
            name: 'Đất nền Khu đô thị Nam Hòa Xuân',
            address: 'Hòa Xuân, Cẩm Lệ, Đà Nẵng',
            price: 3200000000,
            area: 100.0,
            type: 'LAND',
            status: 'AVAILABLE',
          },
          {
            name: 'Căn hộ Studio Vinhomes Ocean Park',
            address: 'Đa Tốn, Gia Lâm, Hà Nội',
            price: 1600000000,
            area: 32.0,
            type: 'APARTMENT',
            status: 'AVAILABLE',
          },
        ];

        await this.propertyRepository.save(
          this.propertyRepository.create(sampleProperties),
        );
        this.logger.log('Successfully seeded 10 properties.');
      }
    } catch (error: any) {
      this.logger.warn(`Property seeding skipped or failed: ${error.message}`);
    }
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