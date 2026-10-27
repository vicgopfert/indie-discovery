import { type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Valida corpo, consulta e parâmetros pelos schemas Zod declarados nos decorators.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
