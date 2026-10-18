import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { UpdateViewingDto } from './dto/update-viewing.dto';
import type { AuthUser } from '../auth/auth.types';
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

  @Get('schedule')
  @UseGuards(JwtAuthGuard)
  findSchedule() {
    return this.viewingsService.findSchedule();
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateViewingDto,
    @Req() req: { user: AuthUser },
  ): Promise<Viewing> {
    return this.viewingsService.update(id, dto, req.user);
  }
}
