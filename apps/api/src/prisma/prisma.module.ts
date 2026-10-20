import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../config/env';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: (env: ConfigService<ApiEnv, true>) =>
        new PrismaService(env.get('DATABASE_URL', { infer: true })),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
