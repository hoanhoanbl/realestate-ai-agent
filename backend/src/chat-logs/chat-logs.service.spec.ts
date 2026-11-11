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
      findOne: async () => null,
    };
    const service = new ChatLogsService(repo as never);
    await expect(service.create({ chatId: '123', route: 'AGENT', question: 'mail tôi: a@b.vn', reply: 'Đã ghi nhận' }))
      .resolves.toEqual({ id: 7 });
    expect(saved[0]).toMatchObject({
      channel: 'telegram', chatId: '123', route: 'AGENT', question: 'mail tôi: [email]',
      leadId: null, usedFallback: false, escalated: false, staffNotified: false, executionId: null,
    });
  });

  it('inherits the lead of the chat\'s newest linked log', async () => {
    const saved: Partial<ChatLog>[] = [];
    const repo = {
      create: (x: Partial<ChatLog>) => x,
      save: async (x: Partial<ChatLog>) => { saved.push(x); return { ...x, id: 8 }; },
      findOne: async () => ({ id: 3, leadId: 30 }),
    };
    const service = new ChatLogsService(repo as never);
    await service.create({ chatId: '123', route: 'AGENT', question: 'q', reply: 'r' });
    expect(saved[0]).toMatchObject({ leadId: 30 });
  });

  it('links only unlinked logs of the chat and reports how many', async () => {
    const calls: unknown[][] = [];
    const repo = { update: async (...args: unknown[]) => { calls.push(args); return { affected: 6 }; } };
    const service = new ChatLogsService(repo as never);
    await expect(service.linkChat('123', 30)).resolves.toBe(6);
    expect(calls[0][1]).toEqual({ leadId: 30 });
    expect(calls[0][0]).toMatchObject({ channel: 'telegram', chatId: '123' });
  });

  it('lists a lead\'s logs oldest first without chat or execution id', async () => {
    const rows = [
      { id: 9, leadId: 30, chatId: 'c', executionId: 'e', createdAt: new Date(), route: 'AGENT', question: 'b', reply: 'rb', escalated: true },
      { id: 4, leadId: 30, chatId: 'c', executionId: 'e', createdAt: new Date(), route: 'AGENT', question: 'a', reply: 'ra', escalated: false },
    ];
    const service = new ChatLogsService({ find: async () => rows } as never);
    const out = await service.findByLead(30);
    expect(out.map((r) => r.id)).toEqual([4, 9]);
    expect(out[0]).not.toHaveProperty('chatId');
    expect(out[0]).not.toHaveProperty('executionId');
  });
});
