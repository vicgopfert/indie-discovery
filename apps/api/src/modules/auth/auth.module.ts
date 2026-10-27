import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { ApiEnv } from '../../config/env';
import { UsersModule } from '../users/users.module';
import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import {
  ACCOUNT_LOGIN_LIMIT,
  ACCOUNT_THROTTLER,
  accountTracker,
  IP_THROTTLER,
  LOGIN_LIMIT,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from './auth-throttle';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionsModule } from './sessions.module';

@Module({
  imports: [
    UsersModule,
    SessionsModule,
    // Memória do processo: basta para a única instância do Render.
    ThrottlerModule.forRoot({
      errorMessage: TOO_MANY_ATTEMPTS_MESSAGE,
      throttlers: [
        { name: IP_THROTTLER, ...LOGIN_LIMIT },
        { name: ACCOUNT_THROTTLER, ...ACCOUNT_LOGIN_LIMIT, getTracker: accountTracker },
      ],
    }),
  ],
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
