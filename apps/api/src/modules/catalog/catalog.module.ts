import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { CatalogService, COUNTRY_OPTION_MIN_GAMES } from './catalog.service';
import { FeatureLabels } from './feature-labels';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogRepository,
    CatalogService,
    { provide: COUNTRY_OPTION_MIN_GAMES, useValue: 20 },
    { provide: FeatureLabels, useFactory: () => FeatureLabels.fromFile() },
  ],
  exports: [FeatureLabels],
})
export class CatalogModule {}
