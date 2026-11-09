import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import {
  DIRECTIONS,
  FURNISHINGS,
  LEGAL_STATUSES,
  MAX_GALLERY_IMAGES,
  MAX_NEARBY_PLACES,
  MAX_PANORAMA_ROOMS,
  MAX_TAGS,
  NEARBY_CATEGORIES,
  OCCUPANCIES,
} from '../property-options';

export { MAX_GALLERY_IMAGES, MAX_NEARBY_PLACES, MAX_PANORAMA_ROOMS, MAX_TAGS };

export const PROPERTY_TYPES = ['APARTMENT', 'TOWNHOUSE', 'VILLA', 'SHOPHOUSE', 'LAND'];
// RESERVED do hệ thống đặt khi có hợp đồng cọc, quản lý không tự đặt được
export const PROPERTY_STATUSES = ['AVAILABLE', 'RESERVED', 'SOLD', 'HIDDEN'];
export const MANAGER_SETTABLE_PROPERTY_STATUSES = ['AVAILABLE', 'HIDDEN', 'SOLD'];

const URL_RULE = { protocols: ['http', 'https'], require_protocol: true };

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? null : v;
};
// Danh sách chữ: cắt khoảng trắng, bỏ dòng trống và dòng trùng
const cleanList = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const items = value.map((v) => (typeof v === 'string' ? v.trim() : v)).filter((v) => v !== '');
  return [...new Set(items)];
};

export class PanoramaRoomDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Phòng 360° cần có tên' })
  @MaxLength(50)
  title: string;

  @Transform(trim)
  @IsUrl(URL_RULE, { message: 'Link ảnh 360° phải bắt đầu bằng http:// hoặc https://' })
  @MaxLength(1000)
  url: string;
}

export class NearbyPlaceDto {
  @IsIn(NEARBY_CATEGORIES, { message: 'Nhóm dịch vụ xung quanh không hợp lệ' })
  category: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Dịch vụ xung quanh cần có tên' })
  @MaxLength(100)
  name: string;

  // Ghi tự do: "500 m", "5 phút đi bộ"
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  distance: string;
}

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
  @IsUrl(URL_RULE)
  @MaxLength(1000)
  imageUrl?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  // Mảng rỗng = xoá hết (lưu [] để lần khởi động sau không điền lại dữ liệu mẫu). Áp dụng cho mọi mảng bên dưới
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PANORAMA_ROOMS, { message: `Tối đa ${MAX_PANORAMA_ROOMS} phòng 360°` })
  @ValidateNested({ each: true })
  @Type(() => PanoramaRoomDto)
  panoramas?: PanoramaRoomDto[];

  // --- Thông tin chi tiết: null = xoá (không hiện ở trang khách) ---

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  bathrooms?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  floors?: number | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1_000_000)
  landArea?: number | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1_000_000)
  floorArea?: number | null;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(200)
  roadWidth?: number | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsIn(DIRECTIONS)
  direction?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsIn(LEGAL_STATUSES)
  legalStatus?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsIn(FURNISHINGS)
  furnishing?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @IsIn(OCCUPANCIES)
  occupancy?: string | null;

  @Transform(cleanList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_GALLERY_IMAGES, { message: `Tối đa ${MAX_GALLERY_IMAGES} ảnh thêm` })
  @IsUrl(URL_RULE, { each: true, message: 'Link ảnh phải bắt đầu bằng http:// hoặc https://' })
  @MaxLength(1000, { each: true })
  images?: string[];

  @Transform(cleanList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS, { message: `Tối đa ${MAX_TAGS} tiện ích` })
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  features?: string[];

  @Transform(cleanList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS, { message: `Tối đa ${MAX_TAGS} món nội thất` })
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  furniture?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_NEARBY_PLACES, { message: `Tối đa ${MAX_NEARBY_PLACES} dịch vụ xung quanh` })
  @ValidateNested({ each: true })
  @Type(() => NearbyPlaceDto)
  nearby?: NearbyPlaceDto[];
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
