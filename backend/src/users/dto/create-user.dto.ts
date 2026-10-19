import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateUserDto {
  @Transform(trim)
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Tên không được để trống' })
  name: string;

  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự trở lên' })
  password: string;

  @IsIn(['MANAGER', 'SALE'], { message: 'Vai trò phải là MANAGER hoặc SALE' })
  role: 'MANAGER' | 'SALE';
}
