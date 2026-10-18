import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from './entities/contract.entity';
import { ContractsController, SignController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Lead } from '../leads/entities/lead.entity';
import { Viewing } from '../viewings/entities/viewing.entity';
import { Property } from '../properties/entities/property.entity';
import { LeadsModule } from '../leads/leads.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contract, Lead, Viewing, Property]), HttpModule, LeadsModule],
  controllers: [ContractsController, SignController],
  providers: [ContractsService],
})
export class ContractsModule {}
