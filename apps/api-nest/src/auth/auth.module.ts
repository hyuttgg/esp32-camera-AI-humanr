import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { HmacVerificationGuard } from './guards/hmac.guard';
import { DatabaseService } from '../database/database.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super_secret_jwt_key_minimum_32_characters_random',
      signOptions: { expiresIn: process.env.JWT_EXPIRATION || '3600s' },
    }),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, HmacVerificationGuard],
  exports: [AuthService, JwtStrategy, RolesGuard, HmacVerificationGuard],
})
export class AuthModule {}

