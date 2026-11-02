import { Module } from '@nestjs/common';
import { ContentIndexRepository } from './content-index.repository';
import { ContentIndexService, TFIDF_CONFIG } from './content-index.service';
import { readTfidfConfig } from './tfidf';

@Module({
  providers: [
    ContentIndexRepository,
    ContentIndexService,
    { provide: TFIDF_CONFIG, useFactory: () => readTfidfConfig() },
  ],
  exports: [ContentIndexService],
})
export class RecommendationModule {}
