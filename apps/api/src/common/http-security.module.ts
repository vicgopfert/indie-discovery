import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorResponseFilter } from './http/error-response.filter';

@Module({
  providers: [{ provide: APP_FILTER, useClass: ErrorResponseFilter }],
})
export class HttpSecurityModule {}
