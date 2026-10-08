import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateAiResultDto {
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @IsIn(['HOT', 'WARM', 'COLD'])
  level: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  aiReply?: string;

  @IsOptional()
  @IsBoolean()
  emailSent?: boolean;

  @IsOptional()
  @IsBoolean()
  staffNotified?: boolean;
}