import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateAutomationStatusDto {
  @IsIn(['PENDING', 'COMPLETED', 'FAILED'])
  status: string;

  @IsOptional()
  @IsString()
  error?: string;
}
