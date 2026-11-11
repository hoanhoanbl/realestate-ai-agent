import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const FEEDBACK_INTERESTS = ['DEPOSIT', 'OTHER', 'NONE'];
export const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];

export class CreateFeedbackLinkDto {
  @IsOptional() @IsInt() @Min(1)
  viewingId?: number;
}

export class SubmitFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsIn(FEEDBACK_INTERESTS)
  interest: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

// n8n gửi về sau khi AI phân tích
export class FeedbackAiResultDto {
  @IsIn(SENTIMENTS)
  sentiment: string;

  @IsString()
  @MaxLength(1000)
  summary: string;

  @IsString()
  @MaxLength(1000)
  nextAction: string;
}
