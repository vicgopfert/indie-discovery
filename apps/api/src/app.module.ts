import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { rootEnvFile, validateApiEnv } from './config/env';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: rootEnvFile, validate: validateApiEnv }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
