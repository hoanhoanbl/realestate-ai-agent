import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { Property } from './entities/property.entity';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/create-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // Công khai: chỉ các căn không bị ẩn. Lọc tuỳ chọn: ?q=&minPrice=&maxPrice=&minArea=&type=&limit=
  @Get()
  findAll(@Query() filter: SearchPropertyDto): Promise<Property[]> {
    return this.propertiesService.findAll(filter);
  }

  // Cho admin: gồm cả căn đã ẩn (phải khai báo trước ':id')
  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  findAllAdmin(): Promise<Property[]> {
    return this.propertiesService.findAllAdmin();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Property> {
    return this.propertiesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  create(@Body() dto: CreatePropertyDto): Promise<Property> {
    return this.propertiesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePropertyDto): Promise<Property> {
    return this.propertiesService.update(id, dto);
  }

  // Xoá mềm: chuyển sang HIDDEN, không mất lịch sử các lịch xem đã đặt
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('MANAGER')
  hide(@Param('id', ParseIntPipe) id: number): Promise<Property> {
    return this.propertiesService.update(id, { status: 'HIDDEN' });
  }
}
