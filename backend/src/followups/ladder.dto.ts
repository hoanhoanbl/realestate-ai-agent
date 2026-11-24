import { Type, Transform } from 'class-transformer';
import { IsDefined, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { TaskTokenDto } from './followup.dto';

export class LadderSuggestionDto {
  @IsIn(['CALL','SEND_EMAIL','OFFER_VIEWING','WAIT']) action: 'CALL'|'SEND_EMAIL'|'OFFER_VIEWING'|'WAIT';
  @IsString() @MaxLength(500) reason: string;
  @IsOptional() @IsString() @MaxLength(1500) emailDraft?: string | null;
}
export class SaveLadderSuggestionDto extends TaskTokenDto {
  @IsDefined() @IsObject() @ValidateNested() @Type(() => LadderSuggestionDto) suggestion: LadderSuggestionDto;
}
export class ConfirmLadderDto {
  @IsIn(['SEND','SKIP']) decision: 'SEND'|'SKIP';
  @IsOptional() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MaxLength(1500) text?: string;
}
