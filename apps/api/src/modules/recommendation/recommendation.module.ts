import { Module } from '@nestjs/common';
import { ContentIndexRepository } from './content-index.repository';
import { InternalController } from './internal.controller';
import { ContentIndexService, TFIDF_CONFIG } from './content-index.service';
import { readTfidfConfig } from './tfidf';

@Module({
  controllers: [InternalController],
  providers: [
    ContentIndexRepository,
    ContentIndexService,
    { provide: TFIDF_CONFIG, useFactory: () => readTfidfConfig() },
  ],
  exports: [ContentIndexService],
})
export class RecommendationModule {}
