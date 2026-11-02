import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export const PROPERTY_TYPES = ['APARTMENT', 'TOWNHOUSE', 'VILLA', 'SHOPHOUSE', 'LAND'];
export const PROPERTY_STATUSES = ['AVAILABLE', 'HIDDEN'];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};

export class CreatePropertyDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  address: string;

  @IsInt()
  @Min(1)
  price: number;

  @IsNumber()
  @IsPositive()
  area: number;

  @IsIn(PROPERTY_TYPES)
  type: string;

  @IsOptional()
  @IsIn(PROPERTY_STATUSES)
  status?: string;

  // Chuỗi rỗng = xoá ảnh/mô tả (lưu null)
  @Transform(emptyToNull)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(1000)
  imageUrl?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
