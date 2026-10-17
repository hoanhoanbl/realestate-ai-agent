import { Body, Controller, Delete, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/auth.types';

class PushTokenDto {
  // Token Expo Push có dạng ExponentPushToken[xxxx]
  @IsString()
  @Matches(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, { message: 'token không đúng định dạng Expo Push' })
  token: string;
}

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // App nhân viên đăng ký để nhận thông báo đẩy khi có khách mới
  @Post('push-token')
  @HttpCode(200)
  async setPushToken(@Body() dto: PushTokenDto, @Req() req: { user: AuthUser }) {
    await this.usersService.setPushToken(req.user.id, dto.token);
    return { ok: true };
  }

  // Đăng xuất khỏi app thì gỡ token để không nhận thông báo nữa
  @Delete('push-token')
  @HttpCode(200)
  async clearPushToken(@Req() req: { user: AuthUser }) {
    await this.usersService.setPushToken(req.user.id, null);
    return { ok: true };
  }
}
