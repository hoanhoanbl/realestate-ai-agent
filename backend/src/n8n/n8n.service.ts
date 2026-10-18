import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// Gọi n8n từ backend. Dùng chung cho mọi luồng cần backend chủ động gọi n8n.
@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  constructor(private readonly httpService: HttpService) {}

  // Địa chỉ n8n mà BACKEND nhìn thấy (trong Docker là http://n8n:5678). Lấy gốc từ N8N_WEBHOOK_URL.
  baseUrl(): string {
    const full = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/viewing-requested';
    return new URL(full).origin;
  }

  // Link "resumeUrl" do n8n tạo ra có thể mang địa chỉ công khai (localhost:5678). Đổi sang địa chỉ backend gọi được.
  toInternalUrl(url: string): URL {
    const u = new URL(url);
    const base = new URL(this.baseUrl());
    u.protocol = base.protocol;
    u.host = base.host;
    return u;
  }

  // Bấm "link duyệt" của một lần chạy n8n đang chờ (Wait). Ném lỗi nếu link đã hết hạn / đã dùng.
  async resume(approvalUrl: string, action: string, extra: Record<string, string> = {}): Promise<void> {
    const u = this.toInternalUrl(approvalUrl);
    u.searchParams.set('action', action);
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    await firstValueFrom(this.httpService.get(u.toString(), { timeout: 60000 }));
  }

  // Gọi webhook của một luồng n8n đã Publish, có header bí mật.
  async callWebhook(path: string, payload: Record<string, unknown>): Promise<void> {
    const url = `${this.baseUrl()}/webhook/${path}`;
    try {
      await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': process.env.WEBHOOK_SECRET || '' },
          timeout: 15000,
        }),
      );
    } catch (err: any) {
      this.logger.error(`Gọi webhook ${path} thất bại: ${err.message}`);
      throw err;
    }
  }
}
