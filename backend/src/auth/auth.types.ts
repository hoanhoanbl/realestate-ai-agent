import type { UserRole } from '../users/entities/user.entity';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}
