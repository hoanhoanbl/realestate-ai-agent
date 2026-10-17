import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { WebhookSecretGuard } from './webhook-secret.guard';

// Global để module nào cũng dùng được JwtAuthGuard / RolesGuard / WebhookSecretGuard mà không phải import lại
@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('Thiếu biến môi trường JWT_SECRET');
        return { secret, signOptions: { expiresIn: '8h' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, WebhookSecretGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, WebhookSecretGuard, UsersModule],
})
export class AuthModule {}
