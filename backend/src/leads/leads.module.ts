import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadIntakeService } from './lead-intake.service';
import { Lead } from './entities/lead.entity';
import { LeadEvent } from './entities/lead-event.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';
import { Property } from '../properties/entities/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lead, LeadEvent, Viewing, Property]), ChatLogsModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadIntakeService],
  exports: [LeadsService, LeadIntakeService],
})
export class LeadsModule {}
