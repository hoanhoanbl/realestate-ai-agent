import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';

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

  findAll(): Promise<Property[]> {
    return this.propertyRepository.find();
  }
}