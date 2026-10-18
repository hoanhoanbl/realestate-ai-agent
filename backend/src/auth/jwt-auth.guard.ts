import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from './auth.types';

// Cho người dùng đã đăng nhập (web admin, app). n8n không dùng guard này mà dùng WebhookSecretGuard.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Thiếu token đăng nhập');
    try {
      const payload = await this.jwtService.verifyAsync(token);
      const user: AuthUser = { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }
}
