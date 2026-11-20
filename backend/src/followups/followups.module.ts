import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsModule } from '../leads/leads.module';
import { FollowupTask } from './followup-task.entity';
import { FollowupsController } from './followups.controller';
import { FollowupsService } from './followups.service';
import { N8nModule } from '../n8n/n8n.module';
import { LadderService } from './ladder.service';
import { LadderController, LadderLinksController } from './ladder.controller';

@Module({ imports: [TypeOrmModule.forFeature([FollowupTask]), LeadsModule, N8nModule], controllers: [FollowupsController, LadderController, LadderLinksController], providers: [FollowupsService, LadderService] })
export class FollowupsModule {}
