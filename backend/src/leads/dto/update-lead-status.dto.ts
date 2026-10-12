import { IsIn, IsOptional, IsString } from 'class-validator';
import { LEAD_STATUSES } from '../lead.constants';

export class UpdateLeadStatusDto {
  @IsIn(LEAD_STATUSES)
  status: string;

  @IsOptional()
  @IsString()
  note?: string;
}
