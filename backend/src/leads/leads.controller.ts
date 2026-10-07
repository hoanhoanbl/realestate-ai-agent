import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { Lead } from './entities/lead.entity';
import { UpdateAiResultDto } from './dto/update-ai-result.dto';

@Controller('leads')
export class LeadsController {
  constructor(
    private readonly leadsService: LeadsService,
  ) {}

  @Get()
  findAll(
    @Query('level') level?: string,
  ): Promise<Lead[]> {
    return this.leadsService.findAll(level);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ): Promise<Lead> {
    return this.leadsService.findOne(Number(id));
  }

  @Put(':id/ai-result')
  updateAiResult(
    @Param('id') id: string,
    @Body() data: UpdateAiResultDto,
  ): Promise<Lead> {
    return this.leadsService.updateAiResult(
      Number(id),
      data,
    );
  }
}