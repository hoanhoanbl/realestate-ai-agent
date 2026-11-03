import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateViewingDto {
  @IsISO8601()
  viewingTime: string;
}

// Nhân viên ghi nhận kết quả buổi xem
export class AttendanceDto {
  @IsIn(['ATTENDED', 'NO_SHOW'])
  outcome: string;

  // Khách không đến: hẹn lại (giữ khách, đổi giờ) hoặc đóng (mất khách, lý do NO_SHOW)
  @ValidateIf((o: AttendanceDto) => o.outcome === 'NO_SHOW')
  @IsIn(['RESCHEDULE', 'CLOSE'])
  next?: string;

  @ValidateIf((o: AttendanceDto) => o.outcome === 'NO_SHOW' && o.next === 'RESCHEDULE')
  @IsISO8601()
  viewingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// Khách xin đổi lịch qua link trong email
export class RescheduleRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
