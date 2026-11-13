import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export const WORK_OUTCOMES = ['CONTACTED', 'NEXT_VIEWING', 'NEEDS_TIME', 'UNREACHABLE', 'NOT_BUYING'] as const;
export class RecordFeedbackWorkDto {
  @IsInt() @Min(1) version: number;
  @IsIn(WORK_OUTCOMES) outcome: typeof WORK_OUTCOMES[number];
  @IsString() @MinLength(1) @MaxLength(2000) note: string;
  @IsOptional() @IsBoolean() complete?: boolean;
  @IsOptional() @IsISO8601() @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) nextDueAt?: string;
  @IsOptional() @IsInt() @Min(1) propertyId?: number;
  @IsOptional() @IsISO8601() @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) viewingTime?: string;
}
export class StartFeedbackAlertDto {
  @IsInt() @Min(1) workId: number;
  @IsInt() @Min(1) version: number;
  @IsInt() @Min(0) assigneeId: number;
  @IsIn(['NEW', 'REMIND', 'ESCALATE']) kind: string;
}
export class FinishFeedbackAlertDto {
  @IsString() @MinLength(64) @MaxLength(64) token: string;
  @IsBoolean() delivered: boolean;
  @IsOptional() @IsString() @MaxLength(500) error?: string;
}
export class ResolveFeedbackAlertDto {
  @IsBoolean() delivered: boolean;
  @IsString() @MinLength(1) @MaxLength(500) note: string;
}
