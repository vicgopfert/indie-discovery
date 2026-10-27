import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { OriginGuard } from './guards/origin.guard';
import { ErrorResponseFilter } from './http/error-response.filter';

// Importado antes do AuthModule: a origem é conferida antes da sessão.
@Module({
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_FILTER, useClass: ErrorResponseFilter },
  ],
})
export class HttpSecurityModule {}
