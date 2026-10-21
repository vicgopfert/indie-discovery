import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IngestionEnv } from '../../config/ingestion-env';
import { IgdbClient } from './igdb.client';

@Module({
  providers: [
    {
      provide: IgdbClient,
      inject: [ConfigService],
      useFactory: (env: ConfigService<IngestionEnv, true>) =>
        new IgdbClient({
          credentials: {
            clientId: env.get('IGDB_CLIENT_ID', { infer: true }),
            clientSecret: env.get('IGDB_CLIENT_SECRET', { infer: true }),
          },
        }),
    },
  ],
  exports: [IgdbClient],
})
export class IngestionModule {}
