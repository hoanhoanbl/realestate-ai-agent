import { IsEmail, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateViewingDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsEmail()
  email: string;

  @Transform(trim)
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
}
