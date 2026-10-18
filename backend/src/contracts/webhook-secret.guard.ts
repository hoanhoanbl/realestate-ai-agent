import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

// Kiểm tra header X-Webhook-Secret khớp WEBHOOK_SECRET (cho các API n8n gọi vào).
// Tạm thời cũng dùng cho API admin của hợp đồng cho tới khi có đăng nhập JWT (Hậu làm).
@Injectable()
export class WebhookSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const expected = process.env.WEBHOOK_SECRET;
    const given = req.headers['x-webhook-secret'];
    if (!expected || !given || given !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    return true;
  }
}
