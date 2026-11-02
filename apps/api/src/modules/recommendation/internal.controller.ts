import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SkipOriginCheck } from '../../common/decorators/skip-origin-check.decorator';
import { InternalSecretGuard } from '../../common/guards/internal-secret.guard';
import { ContentIndexService } from './content-index.service';

// Chamada pelo workflow de ingestão, fora da documentação pública.
@ApiExcludeController()
@Public()
@SkipOriginCheck()
@UseGuards(InternalSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly contentIndex: ContentIndexService) {}

  @Post('reload-index')
  @HttpCode(HttpStatus.OK)
  async reloadIndex() {
    try {
      const { index, loadedAt, durationMs } = await this.contentIndex.reload();
      return {
        games: index.games.length,
        features: index.features.length,
        loadedAt: loadedAt.toISOString(),
        durationMs,
      };
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível recarregar o índice; o anterior continua valendo.',
      );
    }
  }
}
