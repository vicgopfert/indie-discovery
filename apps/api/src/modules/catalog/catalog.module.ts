import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';
import { FeatureLabels } from './feature-labels';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogRepository,
    CatalogService,
    { provide: FeatureLabels, useFactory: () => FeatureLabels.fromFile() },
  ],
  exports: [FeatureLabels],
})
export class CatalogModule {}
