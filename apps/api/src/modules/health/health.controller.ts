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
    description: 'API no ar, com o estado do banco ("degraded" quando o banco não responde)',
    schema: { example: { status: 'ok', database: 'up' } },
  })
  check() {
    return this.health.check();
  }
}
