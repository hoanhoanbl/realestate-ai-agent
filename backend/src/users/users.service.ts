import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hash } from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoutingDto } from './dto/update-routing.dto';
import type { AuthUser } from '../auth/auth.types';
import { ASSIGNMENT_LOCK_SQL } from '../leads/intake-rules';

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

  async findRoutingById(id: number) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
    const { name, email, role, telegramChatId, acceptingLeads } = user;
    return { id, name, email, role, telegramChatId, acceptingLeads };
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { id: 'ASC' },
    });
  }

  // Dùng cho bộ chọn người phụ trách; không trả push token hay thông tin đăng nhập.
  async findAssignees() {
    const users = await this.userRepository.find({
      select: { id: true, name: true, role: true, acceptingLeads: true }, order: { id: 'ASC' },
    });
    return users.map(({ id, name, role, acceptingLeads }) => ({ id, name, role, acceptingLeads }));
  }

  async updateRouting(id: number, dto: UpdateRoutingDto, actor: AuthUser): Promise<User> {
    if (actor.role !== 'MANAGER' && actor.id !== id) throw new ForbiddenException('Chỉ được sửa cấu hình nhận khách của mình');
    return this.userRepository.manager.transaction(async em => {
      await em.query(ASSIGNMENT_LOCK_SQL);
      const repo = em.getRepository(User);
      const user = await repo.findOneBy({ id });
      if (!user) throw new NotFoundException('Không tìm thấy nhân viên');
      // Không truyền null vào cột boolean (IsOptional chấp nhận null).
      if (typeof dto.acceptingLeads === 'boolean') user.acceptingLeads = dto.acceptingLeads;
      if (dto.telegramChatId !== undefined) user.telegramChatId = dto.telegramChatId;
      return repo.save(user);
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.userRepository.exists({ where: { email } });
    if (exists) {
      throw new ConflictException(`Email ${email} đã được sử dụng trong hệ thống`);
    }

    const passwordHash = await hash(dto.password, 10);
    const user = this.userRepository.create({
      email,
      name: dto.name.trim(),
      role: dto.role,
      passwordHash,
      pushToken: null,
    });

    const saved = await this.userRepository.save(user);
    // Ẩn passwordHash khỏi kết quả trả về
    delete (saved as any).passwordHash;
    return saved;
  }

  async setPushToken(id: number, token: string | null): Promise<void> {
    await this.userRepository.update(id, { pushToken: token });
  }
}
