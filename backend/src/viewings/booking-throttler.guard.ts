import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Giới hạn số lần gửi form đặt lịch theo IP khách.
// n8n (bot Telegram, luồng 6) gửi kèm X-Webhook-Secret nên không bị giới hạn: mọi khách Telegram đi chung IP của n8n.
@Injectable()
export class BookingThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const expected = process.env.WEBHOOK_SECRET;
    return Boolean(expected) && req.headers['x-webhook-secret'] === expected;
  }

  // Sau proxy (Caddy, javis-proxy) IP thật nằm trong X-Forwarded-For. main.ts đặt "trust proxy" theo số proxy
  // nên req.ip là IP do proxy tin cậy ghi vào; không dùng req.ips[0] vì phần đầu header khách tự sửa được.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.ip;
  }
}
