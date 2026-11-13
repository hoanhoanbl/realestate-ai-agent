import { BadGatewayException, BadRequestException, ConflictException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

const manager = { id: 1, name: 'Quản lý', role: 'MANAGER' } as any;

// FE-34: hợp đồng lấy căn của buổi xem gần nhất mà khách ĐÃ ĐẾN, không phải buổi xem mới nhất
describe('FE-34: hợp đồng cọc dùng buổi xem đã đến gần nhất', () => {
  const propertyA = { id: 11, name: 'Nhà A', price: 3000000000, status: 'AVAILABLE' };
  const viewingA = { id: 1, leadId: 5, propertyId: 11, status: 'ATTENDED', viewingTime: new Date('2026-11-01T09:00:00Z') };

  const make = (attended: typeof viewingA | null) => {
    const findViewing = jest.fn().mockResolvedValue(attended);
    const findProperty = jest.fn().mockResolvedValue(propertyA);
    const contractRepo = {
      createQueryBuilder: () => ({ where: () => ({ getCount: async () => 0 }) }),
      manager: { transaction: jest.fn().mockRejectedValue(new Error('dừng sau khi chọn căn')) },
    };
    const leadsService = { findOne: jest.fn().mockResolvedValue({ id: 5, status: 'VIEWED' }) };
    const service = new ContractsService(
      contractRepo as any, {} as any, { findOne: findViewing } as any, { findOne: findProperty } as any,
      leadsService as any, {} as any,
    );
    return { service, findViewing, findProperty };
  };

  it('chỉ chọn buổi xem ATTENDED, mới nhất theo giờ xem; căn lấy theo buổi đó', async () => {
    // Khách đã xem căn A (buổi 1), rồi đặt và huỷ căn B (buổi 2): kho dữ liệu chỉ trả buổi ATTENDED
    const { service, findViewing, findProperty } = make(viewingA);
    await expect(service.create({ leadId: 5, depositAmount: 100000000 } as any, manager)).rejects.toThrow('dừng sau khi chọn căn');
    expect(findViewing).toHaveBeenCalledWith({
      where: { leadId: 5, status: 'ATTENDED' },
      order: { viewingTime: 'DESC', id: 'DESC' },
    });
    expect(findProperty).toHaveBeenCalledWith({ where: { id: 11 } });
  });

  it('khách chưa có buổi xem nào đã đến thì không lập được hợp đồng', async () => {
    const { service, findProperty } = make(null);
    await expect(service.create({ leadId: 5, depositAmount: 100000000 } as any, manager)).rejects.toThrow(
      new BadRequestException('Khách chưa có buổi xem nào đã đến, chưa lập hợp đồng được'),
    );
    expect(findProperty).not.toHaveBeenCalled();
  });
});

describe('Sale chọn căn khi lập hợp đồng (LH-22)', () => {
  const make = (attended: unknown) => {
    const findViewing = jest.fn().mockResolvedValue(attended);
    const contractRepo = {
      createQueryBuilder: () => ({ where: () => ({ getCount: async () => 0 }) }),
      manager: { transaction: jest.fn().mockRejectedValue(new Error('dừng sau khi chọn căn')) },
    };
    const leadsService = { findOne: jest.fn().mockResolvedValue({ id: 5, status: 'VIEWED' }) };
    const findProperty = jest.fn().mockResolvedValue({ id: 12, name: 'Nhà B', price: 3000000000, status: 'AVAILABLE' });
    const service = new ContractsService(
      contractRepo as any, {} as any, { findOne: findViewing } as any, { findOne: findProperty } as any,
      leadsService as any, {} as any,
    );
    return { service, findViewing, findProperty };
  };

  it('có propertyId thì chỉ tìm buổi xem đã đến của đúng căn đó', async () => {
    const { service, findViewing, findProperty } = make({ id: 2, leadId: 5, propertyId: 12, status: 'ATTENDED' });
    await expect(service.create({ leadId: 5, depositAmount: 100000000, propertyId: 12 } as any, manager)).rejects.toThrow('dừng sau khi chọn căn');
    expect(findViewing).toHaveBeenCalledWith({
      where: { leadId: 5, status: 'ATTENDED', propertyId: 12 },
      order: { viewingTime: 'DESC', id: 'DESC' },
    });
    expect(findProperty).toHaveBeenCalledWith({ where: { id: 12 } });
  });

  it('khách chưa đến xem căn được chọn thì từ chối, kể cả khi đã xem căn khác', async () => {
    const { service, findProperty } = make(null);
    await expect(service.create({ leadId: 5, depositAmount: 100000000, propertyId: 99 } as any, manager)).rejects.toThrow(
      new BadRequestException('Khách chưa đến xem căn này, chưa lập hợp đồng cho căn này được'),
    );
    expect(findProperty).not.toHaveBeenCalled();
  });
});

describe('Hợp đồng kẹt ở bước soạn', () => {
  const contract = (status: string) => ({ id: 7, leadId: 5, propertyId: 11, status, updatedAt: new Date('2026-11-13T01:00:00Z') });

  const make = (status: string, queryResult: unknown[], webhook: jest.Mock = jest.fn().mockResolvedValue(undefined)) => {
    const query = jest.fn().mockResolvedValue(queryResult);
    const contractRepo = { findOne: jest.fn().mockResolvedValue(contract(status)), query };
    const leadsService = {
      addEvent: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ id: 5, status: 'DEPOSIT' }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const propertyRepo = { query: jest.fn().mockResolvedValue(undefined) };
    const service = new ContractsService(
      contractRepo as any, {} as any, {} as any, propertyRepo as any, leadsService as any, { callWebhook: webhook } as any,
    );
    return { service, query, leadsService, propertyRepo, webhook };
  };

  it('soạn lại: gọi lại webhook contract-requested và ghi lịch sử', async () => {
    const { service, webhook, leadsService } = make('DRAFTING', [[{ id: 7 }], 1]);
    await expect(service.retryDraft(7, manager)).resolves.toEqual({ ok: true });
    expect(webhook).toHaveBeenCalledWith('contract-requested', { contractId: 7 });
    expect(leadsService.addEvent).toHaveBeenCalledWith(5, expect.objectContaining({ type: 'CONTRACT_REDRAFT_REQUESTED' }));
  });

  it('soạn lại sớm (UPDATE không khớp dòng nào) thì 409 và không gọi n8n', async () => {
    const { service, webhook } = make('DRAFTING', [[], 0]);
    await expect(service.retryDraft(7, manager)).rejects.toThrow(ConflictException);
    expect(webhook).not.toHaveBeenCalled();
  });

  it('soạn lại khi n8n tắt: báo 502 và trả lại mốc thời gian cũ để thử lại ngay', async () => {
    const { service, query } = make('DRAFTING', [[{ id: 7 }], 1], jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(service.retryDraft(7, manager)).rejects.toThrow(BadGatewayException);
    expect(query).toHaveBeenLastCalledWith('UPDATE contracts SET updated_at = $2 WHERE id = $1', [7, new Date('2026-11-13T01:00:00Z')]);
  });

  it('chỉ soạn lại hoặc huỷ được khi đang ở bước soạn', async () => {
    const { service } = make('PENDING_APPROVAL', []);
    await expect(service.retryDraft(7, manager)).rejects.toThrow(BadRequestException);
    await expect(service.cancelDraft(7, manager)).rejects.toThrow(BadRequestException);
  });

  it('huỷ: đưa khách về VIEWED, nhả căn và ghi lịch sử', async () => {
    const { service, leadsService, propertyRepo } = make('DRAFTING', [[{ id: 7 }], 1]);
    await expect(service.cancelDraft(7, manager)).resolves.toEqual({ ok: true });
    expect(leadsService.addEvent).toHaveBeenCalledWith(5, expect.objectContaining({ type: 'CONTRACT_REJECTED' }));
    expect(leadsService.updateStatus).toHaveBeenCalledWith(5, expect.objectContaining({ status: 'VIEWED' }));
    expect(propertyRepo.query).toHaveBeenCalled();
  });

  it('huỷ đúng lúc n8n lưu xong bản nháp (UPDATE không khớp) thì 409, không đổi khách và căn', async () => {
    const { service, leadsService, propertyRepo } = make('DRAFTING', [[], 0]);
    await expect(service.cancelDraft(7, manager)).rejects.toThrow(ConflictException);
    expect(leadsService.updateStatus).not.toHaveBeenCalled();
    expect(propertyRepo.query).not.toHaveBeenCalled();
  });
});
