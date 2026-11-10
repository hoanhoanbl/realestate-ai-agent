import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class UpdateRoutingDto {
  @IsOptional()
  @IsBoolean()
  acceptingLeads?: boolean;

  // null xoá id. Telegram cá nhân có id dương, giữ dạng chuỗi để không mất chính xác.
  @IsOptional()
  @Matches(/^[1-9]\d{0,19}$/)
  telegramChatId?: string | null;
}
