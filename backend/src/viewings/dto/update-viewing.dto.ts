import { IsISO8601 } from 'class-validator';

export class UpdateViewingDto {
  @IsISO8601()
  viewingTime: string;
}
