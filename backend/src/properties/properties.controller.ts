import { Controller, Get } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { Property } from './entities/property.entity';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  findAll(): Promise<Property[]> {
    return this.propertiesService.findAll();
  }
}