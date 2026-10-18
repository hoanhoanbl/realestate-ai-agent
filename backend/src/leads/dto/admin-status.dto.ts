import { IsIn, IsOptional, IsString } from 'class-validator';

// Trạng thái nhân viên được tự đặt từ web admin / app
export const ADMIN_SETTABLE_STATUSES = ['VIEWED', 'LOST'];

export class AdminStatusDto {
  @IsIn(ADMIN_SETTABLE_STATUSES)
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}
