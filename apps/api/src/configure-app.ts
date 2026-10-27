import { type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  // Valida corpo, consulta e parâmetros pelos schemas Zod declarados nos decorators.
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
