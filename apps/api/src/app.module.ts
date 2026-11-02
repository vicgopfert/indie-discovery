import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { rootEnvFile, validateApiEnv } from './config/env';
import { HttpSecurityModule } from './common/http-security.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { LibraryModule } from './modules/library/library.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: rootEnvFile, validate: validateApiEnv }),
    PrismaModule,
    HttpSecurityModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    LibraryModule,
  ],
})
export class AppModule {}
