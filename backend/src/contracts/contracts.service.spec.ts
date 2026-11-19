import { BadGatewayException, BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/contract.dto';

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
      leadsService as any, {} as any, {} as any,
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
      leadsService as any, {} as any, {} as any,
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
      contractRepo as any, {} as any, {} as any, propertyRepo as any, leadsService as any, { callWebhook: webhook } as any, {} as any,
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

// FE-48: giá thoả thuận của hợp đồng
describe('FE-48: giá thoả thuận', () => {
  const sale = { id: 2, name: 'Bình', role: 'SALE' } as any;
  const property = { id: 11, name: 'Nhà A', price: 3000000000, status: 'AVAILABLE' };
  const viewing = { id: 1, leadId: 5, propertyId: 11, status: 'ATTENDED' };

  const make = () => {
    const created: any[] = [];
    // em giả cho transaction: đủ các lời gọi mà create() dùng
    const em: any = {
      query: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(async (entity: any) => (entity?.name === 'Lead' ? { id: 5, status: 'VIEWED' } : property)),
      getRepository: () => ({ existsBy: jest.fn().mockResolvedValue(false) }),
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn(async (data: any) => {
        created.push(data);
        return { id: 7, ...data };
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const contractRepo = {
      createQueryBuilder: () => ({ where: () => ({ getCount: async () => 0 }) }),
      manager: { transaction: jest.fn(async (fn: any) => fn(em)) },
    };
    const leadsService = {
      findOne: jest.fn().mockResolvedValue({ id: 5, status: 'VIEWED' }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      addEvent: jest.fn().mockResolvedValue(undefined),
    };
    const n8n = { callWebhook: jest.fn().mockResolvedValue(undefined) };
    const service = new ContractsService(
      contractRepo as any, {} as any, { findOne: jest.fn().mockResolvedValue(viewing) } as any,
      { findOne: jest.fn().mockResolvedValue(property) } as any, leadsService as any, n8n as any, {} as any,
    );
    return { service, created, leadsService, contractRepo, em };
  };
  const eventTypes = (leadsService: any) => leadsService.addEvent.mock.calls.map((c: any[]) => c[1].type);

  it('có giá thoả thuận: lưu cả hai giá, giá của căn không đổi, ghi sự kiện nêu hợp đồng, hai giá và người lập', async () => {
    const { service, created, leadsService, em } = make();
    await service.create({ leadId: 5, depositAmount: 100000000, agreedPrice: 2850000000 } as any, sale);
    expect(created[0]).toMatchObject({ agreedPrice: 2850000000, propertyPrice: 3000000000, depositAmount: 100000000 });
    expect(em.update).toHaveBeenCalledTimes(1);
    expect(em.update).toHaveBeenCalledWith(expect.anything(), 11, { status: 'RESERVED' });
    const event = leadsService.addEvent.mock.calls.find((c: any[]) => c[1].type === 'CONTRACT_PRICE_AGREED')![1];
    expect(event.note).toContain('#7');
    expect(event.note).toContain((2850000000).toLocaleString('vi-VN'));
    expect(event.note).toContain((3000000000).toLocaleString('vi-VN'));
    expect(event.note).toContain('bởi Bình');
  });

  it('bỏ trống giá thoả thuận: cột là null và không có sự kiện CONTRACT_PRICE_AGREED', async () => {
    const { service, created, leadsService } = make();
    await service.create({ leadId: 5, depositAmount: 100000000 } as any, sale);
    expect(created[0].agreedPrice).toBeNull();
    expect(eventTypes(leadsService)).toContain('CONTRACT_CREATED');
    expect(eventTypes(leadsService)).not.toContain('CONTRACT_PRICE_AGREED');
  });

  it('giá thoả thuận null (web gửi null khi bỏ trống) được hiểu là bỏ trống: lưu null, cọc so với giá niêm yết', async () => {
    const { service, created, leadsService } = make();
    await service.create({ leadId: 5, depositAmount: 100000000, agreedPrice: null } as any, sale);
    expect(created[0].agreedPrice).toBeNull();
    expect(eventTypes(leadsService)).not.toContain('CONTRACT_PRICE_AGREED');
    await expect(service.create({ leadId: 5, depositAmount: 3100000000, agreedPrice: null } as any, sale)).rejects.toThrow(
      'Tiền đặt cọc không được lớn hơn giá căn nhà',
    );
  });

  it('cọc lớn hơn giá thoả thuận: 400 đúng câu, không tạo hợp đồng', async () => {
    const { service, contractRepo } = make();
    await expect(service.create({ leadId: 5, depositAmount: 2900000000, agreedPrice: 2850000000 } as any, sale)).rejects.toThrow(
      new BadRequestException('Tiền đặt cọc không được lớn hơn giá thoả thuận'),
    );
    expect(contractRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('cọc bằng đúng giá thoả thuận thì được; cọc lớn hơn giá niêm yết nhưng không lớn hơn giá thoả thuận cao hơn niêm yết cũng được', async () => {
    const { service, created } = make();
    await service.create({ leadId: 5, depositAmount: 2850000000, agreedPrice: 2850000000 } as any, sale);
    await service.create({ leadId: 5, depositAmount: 3050000000, agreedPrice: 3100000000 } as any, sale);
    expect(created).toHaveLength(2);
  });

  it('không có giá thoả thuận: cọc lớn hơn giá niêm yết bị từ chối như cũ', async () => {
    const { service, contractRepo } = make();
    await expect(service.create({ leadId: 5, depositAmount: 3100000000 } as any, sale)).rejects.toThrow(
      new BadRequestException('Tiền đặt cọc không được lớn hơn giá căn nhà'),
    );
    expect(contractRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it.each([0, -5, 1.5, '2850000000'])('DTO từ chối giá thoả thuận không hợp lệ: %p', async (agreedPrice) => {
    const dto = plainToInstance(CreateContractDto, { leadId: 5, depositAmount: 100000000, agreedPrice });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('agreedPrice');
  });

  it('DTO chấp nhận khi bỏ trống (kể cả null) hoặc là số nguyên từ 1', async () => {
    for (const agreedPrice of [undefined, null, 1, 2850000000]) {
      const dto = plainToInstance(CreateContractDto, { leadId: 5, depositAmount: 100000000, agreedPrice });
      expect(await validate(dto)).toEqual([]);
    }
  });

  describe('trả giá thoả thuận ra API', () => {
    const base = {
      id: 7, leadId: 5, propertyId: 11, title: 'HĐ', content: 'nội dung', status: 'SENT', propertyPrice: 3000000000,
      depositAmount: 100000000, expiresAt: new Date(Date.now() + 86400000), createdAt: new Date(), approvedBy: 'QL',
      signedAt: null, signerName: null, signature: null, signToken: 'tok', resumeUrl: 'http://x',
    };
    const build = (agreedPrice: number | null) => {
      const qb: any = { addSelect: () => qb, where: () => qb, getOne: async () => ({ ...base, agreedPrice }) };
      const contractRepo = { createQueryBuilder: () => qb };
      const leadsService = { findOne: jest.fn().mockResolvedValue({ id: 5, name: 'Lan', email: 'l@x.vn', phone: '09' }) };
      const propertyRepo = { findOne: jest.fn().mockResolvedValue(property) };
      const archive = { summary: jest.fn().mockResolvedValue(null) };
      const leadRepo = { findOne: jest.fn().mockResolvedValue({ id: 5, name: 'Lan', email: 'l@x.vn', phone: '09' }) };
      return new ContractsService(contractRepo as any, leadRepo as any, {} as any, propertyRepo as any, leadsService as any, {} as any, archive as any);
    };

    it('getPublic: có và không có giá thoả thuận', async () => {
      expect((await build(2850000000).getPublic('tok')).agreedPrice).toBe(2850000000);
      const without = await build(null).getPublic('tok');
      expect(without.agreedPrice).toBeNull();
      expect(without.propertyPrice).toBe(3000000000);
    });

    it('findDetail: có và không có giá thoả thuận', async () => {
      expect((await build(2850000000).findDetail(7)).agreedPrice).toBe(2850000000);
      expect((await build(null).findDetail(7)).agreedPrice).toBeNull();
    });

    it('findDetail: không lộ đường dẫn file lưu trữ, có khối archive', async () => {
      const detail = await build(null).findDetail(7);
      expect(JSON.stringify(detail)).not.toMatch(/signedFilePath|signed_file_path/);
      expect(detail).toHaveProperty('archive', null);
    });
  });
});
