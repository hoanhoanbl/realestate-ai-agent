import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PROPERTY_TYPES } from './create-property.dto';

// Tham số rỗng ("") coi như không lọc: tool của AI Agent luôn gửi đủ các khoá, khoá nào khách không nói thì để trống
const empty = (value: unknown) => value === undefined || value === null || String(value).trim() === '';
const toText = ({ value }: { value: unknown }) => (empty(value) ? undefined : String(value).trim());
const toNumber = ({ value }: { value: unknown }) => (empty(value) ? undefined : Number(value));

// Bộ lọc của GET /api/properties (web khách và tool "Tìm nhà" của luồng 6). Không gửi gì thì trả hết như cũ
export class SearchPropertyDto {
  // Tìm trong tên hoặc địa chỉ, ví dụ "Đà Nẵng", "Quận 2", "Vinhomes"
  @IsOptional()
  @Transform(toText)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  minArea?: number;

  @IsOptional()
  @Transform(({ value }) => toText({ value })?.toUpperCase())
  @IsIn(PROPERTY_TYPES)
  type?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
