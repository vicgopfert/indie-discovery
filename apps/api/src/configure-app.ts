import { type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import type { Application } from 'express';
import helmet from 'helmet';
import { assignRequestId } from './common/http/request-id.middleware';
import { logRequests } from './common/http/request-logger.middleware';
import type { ApiEnv } from './config/env';

export function configureApp(app: INestApplication) {
  const env = app.get<ConfigService<ApiEnv, true>>(ConfigService);
  // Sem isso, atrás da Vercel e do Render o throttler veria só o IP do último proxy, e todos os
  // usuários dividiriam o mesmo limite.
  const express = app.getHttpAdapter().getInstance() as Application;
  express.set('trust proxy', env.get('TRUST_PROXY', { infer: true }));

  app.setGlobalPrefix('api');
  app.use(assignRequestId);
  app.use(logRequests);
  app.use(helmet());
  app.use(cookieParser());
  // Valida corpo, consulta e parâmetros pelos schemas Zod declarados nos decorators.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
