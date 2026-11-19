import { IsIn, IsOptional, IsString } from 'class-validator';
import { LEAD_STATUSES, MANUAL_LOST_REASONS } from '../lead.constants';

export class UpdateLeadStatusDto {
  @IsIn(LEAD_STATUSES)
  status: string;

  @IsOptional()
  @IsString()
  note?: string;

  // System-owned reasons are written by their own transactions, never this status callback.
  @IsOptional()
  @IsIn(MANUAL_LOST_REASONS)
  lostReason?: string;
}
