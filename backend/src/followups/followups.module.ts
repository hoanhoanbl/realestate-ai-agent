import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsModule } from '../leads/leads.module';
import { FollowupTask } from './followup-task.entity';
import { FollowupsController } from './followups.controller';
import { FollowupsService } from './followups.service';

@Module({ imports: [TypeOrmModule.forFeature([FollowupTask]), LeadsModule], controllers: [FollowupsController], providers: [FollowupsService] })
export class FollowupsModule {}
