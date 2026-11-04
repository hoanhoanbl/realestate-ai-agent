import { BadRequestException } from '@nestjs/common';
import { LeadsService, assertNotLosingDeposit } from './leads.service';
import type { Lead } from './entities/lead.entity';
import type { Viewing } from '../viewings/entities/viewing.entity';

// Chạy: node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/leads/leads.service.spec.ts
const user = { id: 1, name: 'Sale A', role: 'SALE' } as any;

describe('BF-06: không đánh dấu mất khách khi đang đặt cọc', () => {
  let lead: Partial<Lead>;
  let viewing: Partial<Viewing>;
  let events: { type: string; note?: string | null }[];
  let viewingUpdates: unknown[];
  let service: LeadsService;

  beforeEach(() => {
    lead = { id: 4, status: 'DEPOSIT', lostReason: null };
    viewing = { id: 9, leadId: 4, status: 'ATTENDED' };
    events = [];
    viewingUpdates = [];
    const leadRepo = {
      findOne: async () => lead,
      save: async (l: Lead) => l,
    };
    const eventRepo = {
      create: (e: any) => e,
      save: async (e: any) => { events.push(e); return e; },
    };
    const viewingRepo = {
      findOne: async () => viewing,
      update: async (...args: unknown[]) => { viewingUpdates.push(args); },
    };
    service = new LeadsService(leadRepo as any, eventRepo as any, viewingRepo as any, {} as any, {} as any);
  });

  it('chặn nút "Mất khách" trên web admin, không đổi gì', async () => {
    await expect(service.adminSetStatus(4, { status: 'LOST', reason: 'OTHER' }, user)).rejects.toThrow(BadRequestException);
    expect(lead.status).toBe('DEPOSIT');
    expect(events).toHaveLength(0);
    expect(viewingUpdates).toHaveLength(0);
  });

  it('chặn cả PUT /leads/:id/status của n8n', async () => {
    await expect(service.updateStatus(4, { status: 'LOST', lostReason: 'OTHER' })).rejects.toThrow(BadRequestException);
    expect(lead.status).toBe('DEPOSIT');
  });

  it('vẫn cho hợp đồng bị từ chối đưa khách về VIEWED, và vẫn đóng được khách VIEWED', async () => {
    await service.updateStatus(4, { status: 'VIEWED', note: 'Từ chối hợp đồng #1' });
    expect(lead.status).toBe('VIEWED');
    await service.adminSetStatus(4, { status: 'LOST', reason: 'NOT_INTERESTED' }, user);
    expect(lead.status).toBe('LOST');
    expect(lead.lostReason).toBe('NOT_INTERESTED');
  });

  it('chỉ chặn đúng cặp DEPOSIT -> LOST', () => {
    expect(() => assertNotLosingDeposit('DEPOSIT', 'LOST')).toThrow(BadRequestException);
    for (const [from, to] of [['DEPOSIT', 'VIEWED'], ['DEPOSIT', 'SIGNED'], ['VIEWED', 'LOST'], ['CONFIRMED', 'LOST'], ['NEW', 'LOST']])
      expect(() => assertNotLosingDeposit(from, to)).not.toThrow();
  });
});
