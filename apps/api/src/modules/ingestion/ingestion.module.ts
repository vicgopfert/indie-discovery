import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IngestionEnv } from '../../config/ingestion-env';
import { PrismaService } from '../../prisma/prisma.service';
import { IgdbCatalogSource } from './igdb/igdb-catalog.source';
import { IgdbClient } from './igdb/igdb.client';
import { readVersionedIndieCriteria } from './criteria/indie-criteria.config';
import { readIngestionReview } from './review-flags/ingestion-review.config';
import { readIngestionConfig } from './ingestion-config';
import { IngestionRepository } from './persistence/ingestion.repository';
import { RunIngestionUseCase } from './run-ingestion.use-case';
import { WikidataCountrySource } from './wikidata/wikidata-country.source';
import { readTfidfConfig } from '../recommendation/tfidf';

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
    {
      provide: RunIngestionUseCase,
      inject: [IgdbClient, PrismaService],
      useFactory: (igdb: IgdbClient, prisma: PrismaService) => {
        const ingestion = readIngestionConfig();
        const criteria = readVersionedIndieCriteria();
        return new RunIngestionUseCase(
          new IgdbCatalogSource(igdb, ingestion),
          new WikidataCountrySource(),
          new IngestionRepository(prisma),
          {
            criteria,
            review: readIngestionReview(criteria.criteria),
            tfidf: readTfidfConfig(),
            ingestion,
          },
        );
      },
    },
  ],
  exports: [IgdbClient, RunIngestionUseCase],
})
export class IngestionModule {}
