import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('Indie Discovery API')
    .setDescription('API da plataforma de descoberta de jogos independentes')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
