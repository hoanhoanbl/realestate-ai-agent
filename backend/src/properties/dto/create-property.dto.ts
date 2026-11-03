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
// RESERVED do hệ thống đặt khi có hợp đồng cọc, quản lý không tự đặt được
export const PROPERTY_STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD', 'HIDDEN'];
export const MANAGER_SETTABLE_PROPERTY_STATUSES = ['AVAILABLE', 'HIDDEN', 'SOLD'];

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
  @IsIn(MANAGER_SETTABLE_PROPERTY_STATUSES, { message: 'Trạng thái căn chỉ được là AVAILABLE, HIDDEN hoặc SOLD' })
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
