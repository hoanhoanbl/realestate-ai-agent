import { BadRequestException } from '@nestjs/common';
import { RecordFeedbackWorkDto } from './feedback-work.dto';

export function workDecision(dto: RecordFeedbackWorkDto, now: Date) {
  if (!dto.note.trim()) throw new BadRequestException('Cần ghi nội dung trao đổi hoặc lý do');
  const completes = ['NEXT_VIEWING', 'NOT_BUYING'].includes(dto.outcome) || (dto.outcome === 'CONTACTED' && dto.complete === true);
  if (completes && dto.nextDueAt) throw new BadRequestException('Việc hoàn tất không có hạn gọi tiếp');
  if (!completes && dto.complete) throw new BadRequestException('Kết quả này cần tiếp tục chăm sóc');
  const due = dto.nextDueAt ? new Date(dto.nextDueAt) : null;
  if (!completes && (!due || !Number.isFinite(due.getTime()) || due <= now))
    throw new BadRequestException('Chọn hạn liên hệ tiếp ở tương lai');
  if (dto.outcome === 'NEXT_VIEWING' && (!dto.propertyId || !dto.viewingTime))
    throw new BadRequestException('Chọn căn nhà và giờ để tạo lịch xem thật');
  if (dto.outcome !== 'NEXT_VIEWING' && (dto.propertyId || dto.viewingTime))
    throw new BadRequestException('Chỉ nhập căn và giờ khi hẹn xem tiếp');
  return { completes, due };
}
