import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { rootEnvFile, validateApiEnv } from './config/env';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: rootEnvFile, validate: validateApiEnv }),
    PrismaModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
