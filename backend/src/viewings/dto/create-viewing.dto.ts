import { IsEmail, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class CreateViewingDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
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