import { BadRequestException } from '@nestjs/common';
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
