import { IsArray, IsISO8601, IsObject, IsString } from 'class-validator';

export class CreateReportDto {
  @IsISO8601({ strict: true })
  periodStart: string;

  @IsISO8601({ strict: true })
  periodEnd: string;

  @IsObject()
  metrics: Record<string, unknown>;

  @IsObject()
  analysis: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  alerts: string[];
}
