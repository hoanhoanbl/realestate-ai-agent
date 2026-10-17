import { Transform } from 'class-transformer';
import { Equals, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateContractDto {
  @IsInt()
  @Min(1)
  leadId: number;

  // Số tiền đặt cọc (VND)
  @IsInt()
  @Min(1)
  depositAmount: number;
}

export class RejectContractDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

// n8n gửi bản nháp về sau khi soạn xong
export class DraftContractDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  aiReview: string;

  @IsString()
  @IsNotEmpty()
  resumeUrl: string;
}

export class ExpireContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class SignContractDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  signerName: string;

  // Ảnh chữ ký vẽ trên canvas, dạng data URL PNG
  @IsString()
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, { message: 'signature phải là ảnh PNG dạng data URL' })
  @MaxLength(90000, { message: 'signature quá lớn' })
  signature: string;

  @Equals(true, { message: 'Phải đồng ý với nội dung hợp đồng' })
  agree: boolean;
}
