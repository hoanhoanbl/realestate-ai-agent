import { of } from 'rxjs';
import { ViewingsService } from './viewings.service';

// FE-35: luồng 1 cần biết sale phụ trách để gửi thông báo đúng người
describe('Payload gọi luồng 1 khi có lịch xem mới', () => {
  const run = async (assignedUserId: number | null) => {
    const sent: any[] = [];
    const http = { post: (_url: string, body: any) => (sent.push(body), of({ data: {} })) } as any;
    const service = new ViewingsService({} as any, {} as any, {} as any, http, {} as any, {} as any, {} as any);
    const lead = { id: 7, name: 'Khách', email: 'k@example.test', phone: '0900000001', budget: '1', needs: null, source: 'direct', eventId: 'e', assignedUserId } as any;
    await (service as any).triggerN8nWebhook(lead, 3, '2026-11-20T02:00:00.000Z', 'manage', 9);
    return sent[0];
  };

  it('kèm assignedUserId của lead', async () => {
    expect(await run(5)).toMatchObject({ leadId: 7, viewingId: 9, assignedUserId: 5 });
  });

  it('lead chưa có người phụ trách thì gửi null, không bỏ trường', async () => {
    expect(await run(null)).toHaveProperty('assignedUserId', null);
  });
});
