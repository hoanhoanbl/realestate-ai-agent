import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CHAT_ROUTES, type ChatRoute } from './chat-log.entity';

export class CreateChatLogDto {
  @IsOptional() @IsString() @MaxLength(20) channel?: string;
  @IsString() @MinLength(1) @MaxLength(40) chatId: string;
  @IsIn(CHAT_ROUTES) route: ChatRoute;
  @IsString() @MaxLength(4000) question: string;
  @IsString() @MaxLength(4000) reply: string;
  @IsOptional() @IsBoolean() usedFallback?: boolean;
  @IsOptional() @IsBoolean() escalated?: boolean;
  @IsOptional() @IsBoolean() staffNotified?: boolean;
  @IsOptional() @IsString() @MaxLength(40) executionId?: string;
}
