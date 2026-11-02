import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateViewingDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[0-9+\s.-]{8,15}$/, { message: 'phone không hợp lệ (8 đến 15 ký tự số)' })
  phone: string;

  @IsInt()
  @Min(0)
  budget: number;

  @IsOptional()
  @IsString()
  needs?: string;

  @IsInt()
  @Min(1)
  propertyId: number;

  @IsISO8601()
  viewingTime: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  source?: string;

  @IsOptional()
  @IsBoolean()
  consentMarketing?: boolean;
}
