import { IsISO8601, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { FOLLOWUP_TYPES, type FollowupType } from './followup-task.entity';

export class ClaimFollowupDto {
  @IsInt() @Min(1) leadId: number;
  @IsInt() @Min(1) viewingId: number;
  @IsISO8601() viewingTime: string;
  @IsIn(FOLLOWUP_TYPES) type: FollowupType;
  @IsString() @MinLength(1) @MaxLength(120) owner: string;
}
export class TaskTokenDto {
  @IsString() @MinLength(32) @MaxLength(64) token: string;
}
export class ActionDoneDto extends TaskTokenDto {
  @IsOptional() @IsInt() @Min(1) mauticContactId?: number;
}
export class FailFollowupDto extends TaskTokenDto {
  @IsString() @MaxLength(500) error: string;
}
export class ResolveFollowupDto extends TaskTokenDto {
  @IsIn(['delivered', 'not-delivered']) resolution: 'delivered' | 'not-delivered';
  @IsOptional() @IsInt() @Min(1) mauticContactId?: number;
}
