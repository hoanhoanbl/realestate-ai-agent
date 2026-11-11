import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ViewingsController } from './viewings.controller';
import { ViewingsService } from './viewings.service';
import { Viewing } from './entities/viewing.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Property } from '../properties/entities/property.entity';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Viewing, Lead, Property]),
    HttpModule,
    LeadsModule,
    ChatLogsModule,
    // Giới hạn form đặt lịch: mặc định 5 lần / 10 phút / IP (BOOKING_RATE_LIMIT, BOOKING_RATE_TTL_MS)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'booking',
            ttl: Number(config.get('BOOKING_RATE_TTL_MS')) || 600000,
            limit: Number(config.get('BOOKING_RATE_LIMIT')) || 5,
          },
        ],
        errorMessage: 'Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút',
      }),
    }),
  ],
  controllers: [ViewingsController],
  providers: [ViewingsService],
})
export class ViewingsModule {}
