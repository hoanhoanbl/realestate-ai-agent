import { IsInt, IsISO8601, Min } from 'class-validator';

export class CreateViewingDto {
  @IsInt()
  @Min(1)
  propertyId: number;

  @IsInt()
  @Min(1)
  leadId: number;

  @IsISO8601()
  viewingTime: string;
}