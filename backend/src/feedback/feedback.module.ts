import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feedback } from './entities/feedback.entity';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';
import { LeadsModule } from '../leads/leads.module';
import { FeedbackWork, FeedbackWorkAlert, FeedbackWorkHistory } from './feedback-work.entity';
import { FeedbackWorkService } from './feedback-work.service';
import { FeedbackWorkController } from './feedback-work.controller';
import { Lead } from '../leads/entities/lead.entity';
import { LeadEvent } from '../leads/entities/lead-event.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Feedback, Viewing, Property, FeedbackWork, FeedbackWorkAlert, FeedbackWorkHistory, Lead, LeadEvent, Contract, User]), LeadsModule],
  controllers: [FeedbackController, FeedbackWorkController],
  providers: [FeedbackService, FeedbackWorkService],
})
export class FeedbackModule {}
