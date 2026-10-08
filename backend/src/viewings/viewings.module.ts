import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewingsController } from './viewings.controller';
import { ViewingsService } from './viewings.service';
import { Viewing } from './entities/viewing.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Viewing])],
  controllers: [ViewingsController],
  providers: [ViewingsService],
})
export class ViewingsModule {}