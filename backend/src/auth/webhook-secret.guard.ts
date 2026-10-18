import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

// Cho các API n8n gọi vào backend: header X-Webhook-Secret phải khớp WEBHOOK_SECRET.
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
