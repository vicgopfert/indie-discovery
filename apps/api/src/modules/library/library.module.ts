import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { LibraryController } from './library.controller';
import { LibraryRepository } from './library.repository';
import { LibraryService } from './library.service';

@Module({
  imports: [CatalogModule],
  controllers: [LibraryController],
  providers: [LibraryRepository, LibraryService],
})
export class LibraryModule {}
