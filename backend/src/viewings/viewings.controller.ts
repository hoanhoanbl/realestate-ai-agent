import { Body, Controller, Get, Post } from '@nestjs/common';
import { ViewingsService } from './viewings.service';
import { CreateViewingDto } from './dto/create-viewing.dto';
import { Viewing } from './entities/viewing.entity';
import { Lead } from '../leads/entities/lead.entity';

@Controller('viewings')
export class ViewingsController {
  constructor(private readonly viewingsService: ViewingsService) {}

  @Post()
  create(
    @Body() createViewingDto: CreateViewingDto,
  ): Promise<{ viewing: Viewing; lead: Lead }> {
    return this.viewingsService.create(createViewingDto);
  }

  @Get()
  findAll(): Promise<Viewing[]> {
    return this.viewingsService.findAll();
  }
}