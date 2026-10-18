import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import type { AuthUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
    const user = await this.usersService.findForLogin(email);
    // Cùng một thông báo cho "sai email" và "sai mật khẩu" để không lộ email nào tồn tại
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const authUser: AuthUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return { accessToken, user: authUser };
  }
}
