import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { PartialType } from '@nestjs/swagger';

export const PROPERTY_TYPES = ['APARTMENT', 'TOWNHOUSE', 'VILLA', 'SHOPHOUSE', 'LAND'];
export const PROPERTY_STATUSES = ['AVAILABLE', 'HIDDEN'];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}
