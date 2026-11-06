import { ChatLogsService, maskPii } from './chat-logs.service';
import { ChatLog } from './chat-log.entity';

describe('maskPii', () => {
  it('masks emails and phone numbers', () => {
    expect(maskPii('Tôi là An, email an.nguyen+1@gmail.com, sđt 0901 234 567'))
      .toBe('Tôi là An, email [email], sđt [số]');
    expect(maskPii('Gọi +84 901.234.567 nhé')).toBe('Gọi [số] nhé');
  });
  it('keeps prices, dates and short numbers', () => {
    const text = 'Căn số 2, giá 3,5 tỷ, xem 10:00 ngày 12/11/2026, 3000000000 đồng';
    expect(maskPii(text)).toBe(text);
  });
});

describe('ChatLogsService', () => {
  it('stores a masked log with defaults', async () => {
    const saved: Partial<ChatLog>[] = [];
    const repo = {
      create: (x: Partial<ChatLog>) => x,
      save: async (x: Partial<ChatLog>) => { saved.push(x); return { ...x, id: 7 }; },
    };
    const service = new ChatLogsService(repo as never);
    await expect(service.create({ chatId: '123', route: 'AGENT', question: 'mail tôi: a@b.vn', reply: 'Đã ghi nhận' }))
      .resolves.toEqual({ id: 7 });
    expect(saved[0]).toMatchObject({
      channel: 'telegram', chatId: '123', route: 'AGENT', question: 'mail tôi: [email]',
      usedFallback: false, escalated: false, staffNotified: false, executionId: null,
    });
  });
});
