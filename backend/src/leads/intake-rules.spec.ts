import { BadRequestException } from '@nestjs/common';
import { normalizePhone, responseDeadline } from './intake-rules';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLeadDto, LeadNoteDto } from './dto/create-lead.dto';

describe('FE-33: số điện thoại và hạn phản hồi', () => {
  it('cùng số Việt Nam ở nhiều định dạng dùng chung một khoá', () => {
    for (const value of ['0901234567', '+84 901.234-567', '(090) 123 4567']) {
      expect(normalizePhone(value)).toBe('0901234567');
    }
  });
  it('không biến chuỗi tuỳ ý hoặc nhiều dấu + thành số điện thoại hợp lệ', () => {
    for (const value of ['', 'abc0901234567', '090+1234567', '123']) {
      expect(() => normalizePhone(value)).toThrow(BadRequestException);
    }
  });
  it.each([
    ['2026-11-10T09:00:00+07:00', '2026-11-10T11:00:00+07:00'],
    ['2026-11-10T20:00:00+07:00', '2026-11-11T09:00:00+07:00'],
    ['2026-11-10T23:00:00+07:00', '2026-11-11T10:00:00+07:00'],
    ['2026-11-10T21:00:00+07:00', '2026-11-11T10:00:00+07:00'],
    ['2026-11-10T07:30:00+07:00', '2026-11-10T10:00:00+07:00'],
    ['2026-11-10T20:59:30+07:00', '2026-11-11T09:59:30+07:00'],
  ])('%s có hạn %s', (from, due) => {
    expect(responseDeadline(new Date(from))).toEqual(new Date(due));
  });
  it('nhận khách chưa có email và ngân sách, chặn ghi chú chỉ có dấu cách', async () => {
    expect(
      await validate(
        plainToInstance(CreateLeadDto, {
          name: 'Bình',
          phone: '0901234567',
          source: 'hotline',
        }),
      ),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(LeadNoteDto, { note: '   ' })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateLeadDto, {
          name: 'Bình',
          phone: '0901234567',
          source: 'hotline',
          budget: -1,
        }),
      ),
    ).not.toHaveLength(0);
  });
});
