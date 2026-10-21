import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateMauticDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  mauticContactId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  mauticPoints?: number;
}
