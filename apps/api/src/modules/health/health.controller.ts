import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

// Versão mínima do B-02: só indica que a API responde. O estado do banco e do
// índice de conteúdo entram no B-39.
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API no ar', schema: { example: { status: 'ok' } } })
  check() {
    return { status: 'ok' };
  }
}
