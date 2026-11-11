import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersNotifyController } from './users-notify.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController, UsersNotifyController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
