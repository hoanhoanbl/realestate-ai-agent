import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateLeadDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  budget?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  needs?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  source: string;

  @IsOptional()
  @IsBoolean()
  consentMarketing?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  assignedUserId?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  interestedPropertyIds?: number[];

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  note?: string;
}

// Chỉ POST /leads/intake (webhook secret) dùng lớp này; POST /leads (JWT) dùng CreateLeadDto nên chatId bị bỏ.
export class IntakeLeadDto extends CreateLeadDto {
  // Id cuộc chat Telegram do n8n truyền, để gắn lịch sử chat vào lead (FE-36)
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  chatId?: string;
}

export class AssignLeadDto {
  @IsInt()
  @Min(1)
  assignedUserId: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class LeadNoteDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  note: string;
}
