import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoutingDto } from './dto/update-routing.dto';

class PushTokenDto {
  // Token Expo Push có dạng ExponentPushToken[xxxx]
  @IsString()
  @Matches(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, { message: 'token không đúng định dạng Expo Push' })
  token: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('assignees')
  findAssignees() {
    return this.usersService.findAssignees();
  }

  @Put(':id/routing')
  updateRouting(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoutingDto, @Req() req: { user: AuthUser }) {
    return this.usersService.updateRouting(id, dto, req.user);
  }

  // Quản lý xem danh sách tất cả tài khoản và phân quyền
  @Get()
  @UseGuards(RolesGuard)
  @Roles('MANAGER')
  findAll() {
    return this.usersService.findAll();
  }

  // Quản lý tạo thêm tài khoản nhân sự mới
  @Post()
  @UseGuards(RolesGuard)
  @Roles('MANAGER')
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // App nhân viên đăng ký để nhận thông báo đẩy khi có khách mới
  @Post('me/push-token')
  @HttpCode(200)
  async setPushToken(@Body() dto: PushTokenDto, @Req() req: { user: AuthUser }) {
    await this.usersService.setPushToken(req.user.id, dto.token);
    return { ok: true };
  }

  // Đăng xuất khỏi app thì gỡ token để không nhận thông báo nữa
  @Delete('me/push-token')
  @HttpCode(200)
  async clearPushToken(@Req() req: { user: AuthUser }) {
    await this.usersService.setPushToken(req.user.id, null);
    return { ok: true };
  }
}
