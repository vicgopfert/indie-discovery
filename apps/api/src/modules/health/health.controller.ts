import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API no ar', schema: { example: { status: 'ok' } } })
  check() {
    return { status: 'ok' };
  }
}
