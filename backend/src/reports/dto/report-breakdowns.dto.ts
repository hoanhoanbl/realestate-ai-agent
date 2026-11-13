import { IsISO8601 } from 'class-validator';

export class ReportBreakdownsDto {
  @IsISO8601({ strict: true })
  periodStart: string;

  @IsISO8601({ strict: true })
  periodEnd: string;
}
