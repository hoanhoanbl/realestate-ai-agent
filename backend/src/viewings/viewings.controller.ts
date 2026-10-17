import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  @UseGuards(JwtAuthGuard)
  findAll(): Promise<Viewing[]> {
    return this.viewingsService.findAll();
  }
}