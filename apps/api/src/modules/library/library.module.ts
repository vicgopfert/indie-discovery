import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { preferenceTags, readTagVocabulary } from '../tags/tags';
import { LibraryController } from './library.controller';
import { LibraryRepository } from './library.repository';
import { LibraryService, PREFERENCE_TAGS } from './library.service';

@Module({
  imports: [CatalogModule],
  controllers: [LibraryController],
  providers: [
    LibraryRepository,
    LibraryService,
    { provide: PREFERENCE_TAGS, useFactory: () => preferenceTags(readTagVocabulary()) },
  ],
})
export class LibraryModule {}
