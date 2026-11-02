import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOkResponse({
    description:
      'API no ar, com o estado do banco e do índice de conteúdo. Responde 200 mesmo em "degraded" (banco fora do ar ou índice carregando ou com falha), para o health check do Render não tirar do ar uma API que ainda serve catálogo e contas',
    schema: {
      example: {
        status: 'ok',
        database: 'up',
        contentIndex: { status: 'ready', games: 22807, loadedAt: '2026-11-02T12:00:00.000Z' },
      },
    },
  })
  check() {
    return this.health.check();
  }
}
