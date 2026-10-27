import { type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { assignRequestId } from './common/http/request-id.middleware';
import { logRequests } from './common/http/request-logger.middleware';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(assignRequestId);
  app.use(logRequests);
  app.use(helmet());
  app.use(cookieParser());
  // Valida corpo, consulta e parâmetros pelos schemas Zod declarados nos decorators.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
