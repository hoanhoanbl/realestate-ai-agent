import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';

// Tài khoản mẫu cho bản dev. Mật khẩu lấy từ biến SEED_USER_PASSWORD, không ghi trong code.
const SEED_USERS: { email: string; name: string; role: UserRole }[] = [
  { email: 'nhadn2457+quanly@gmail.com', name: 'Quản lý', role: 'MANAGER' },
  { email: 'nhadn2457+nhanvien@gmail.com', name: 'Nhân viên sale', role: 'SALE' },
];

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    const password = process.env.SEED_USER_PASSWORD;
    if (!password) {
      this.logger.warn('SEED_USER_PASSWORD chưa đặt: bỏ qua tạo tài khoản mẫu');
      return;
    }
    for (const seed of SEED_USERS) {
      const exists = await this.userRepository.exists({ where: { email: seed.email } });
      if (exists) continue;
      await this.userRepository.save(
        this.userRepository.create({ ...seed, passwordHash: await hash(password, 10), pushToken: null }),
      );
      this.logger.log(`Đã tạo tài khoản mẫu ${seed.role}: ${seed.email}`);
    }
  }

  // passwordHash có select:false nên phải lấy riêng khi đăng nhập
  findForLogin(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: email.trim().toLowerCase() })
      .getOne();
  }

  findById(id: number): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async setPushToken(id: number, token: string | null): Promise<void> {
    await this.userRepository.update(id, { pushToken: token });
  }
}
