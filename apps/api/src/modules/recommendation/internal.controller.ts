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

const MB = 1024 * 1024;

// Chamada pelo workflow de ingestão, fora da documentação pública. A memória logo depois da
// recarga fica no resumo do workflow: é a medida que decide se as etiquetas ficam no vetor (B-78).
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
      const { rss, heapUsed } = process.memoryUsage();
      return {
        games: index.games.length,
        features: index.features.length,
        loadedAt: loadedAt.toISOString(),
        durationMs,
        rssMb: Math.round(rss / MB),
        heapUsedMb: Math.round(heapUsed / MB),
      };
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível recarregar o índice; o anterior continua valendo.',
      );
    }
  }
}
