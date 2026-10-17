import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ViewingsController } from './viewings.controller';
import { ViewingsService } from './viewings.service';
import { Viewing } from './entities/viewing.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Property } from '../properties/entities/property.entity';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Viewing, Lead, Property]),
    HttpModule,
    LeadsModule,
  ],
  controllers: [ViewingsController],
  providers: [ViewingsService],
})
export class ViewingsModule {}