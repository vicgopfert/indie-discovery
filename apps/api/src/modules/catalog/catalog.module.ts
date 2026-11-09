import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { readTagVocabulary, tagAliases } from '../tags/tags';
import { CatalogService, COUNTRY_OPTION_MIN_GAMES, TAG_ALIASES } from './catalog.service';
import { FeatureLabels } from './feature-labels';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogRepository,
    CatalogService,
    { provide: COUNTRY_OPTION_MIN_GAMES, useValue: 20 },
    { provide: TAG_ALIASES, useFactory: () => tagAliases(readTagVocabulary()) },
    { provide: FeatureLabels, useFactory: () => FeatureLabels.fromFile() },
  ],
  exports: [FeatureLabels, CatalogService],
})
export class CatalogModule {}
