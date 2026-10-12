import { IsIn, IsOptional, IsString } from 'class-validator';
import { LEAD_EVENT_TYPES } from '../lead.constants';

export class CreateLeadEventDto {
  @IsIn(LEAD_EVENT_TYPES)
  type: string;

  @IsOptional()
  @IsString()
  note?: string;
}
