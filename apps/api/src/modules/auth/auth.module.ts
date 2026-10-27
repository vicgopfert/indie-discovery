import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { ApiEnv } from '../../config/env';
import { UsersModule } from '../users/users.module';
import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionsModule } from './sessions.module';

@Module({
  imports: [UsersModule, SessionsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordHasher,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    {
      provide: AUTH_SETTINGS,
      inject: [ConfigService],
      useFactory: (env: ConfigService<ApiEnv, true>): AuthSettings => ({
        sessionTtlDays: env.get('SESSION_TTL_DAYS', { infer: true }),
        secureCookie: env.get('NODE_ENV', { infer: true }) === 'production',
      }),
    },
  ],
})
export class AuthModule {}
