import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IngestionStatus } from './generated/prisma/client';
import { rootEnvFile } from './config/env';
import { validateIngestionEnv } from './config/ingestion-env';
import { SessionsModule } from './modules/auth/sessions.module';
import { SessionsRepository } from './modules/auth/sessions.repository';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { RunIngestionUseCase } from './modules/ingestion/run-ingestion.use-case';
import { PrismaModule } from './prisma/prisma.module';

// Aplicação sem servidor HTTP: a ingestão nunca disputa recursos com a API.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvFile,
      validate: validateIngestionEnv,
    }),
    PrismaModule,
    IngestionModule,
    SessionsModule,
  ],
})
class IngestionAppModule {}

async function main() {
  const app = await NestFactory.createApplicationContext(IngestionAppModule);
  try {
    const result = await app.get(RunIngestionUseCase).execute();
    // A limpeza das sessões expiradas aproveita a execução periódica da ingestão.
    const removed = await app.get(SessionsRepository).deleteExpired(new Date());
    new Logger('Sessions').log(`${removed} sessões expiradas removidas`);
    process.exitCode = result.status === IngestionStatus.SUCCEEDED ? 0 : 1;
  } finally {
    await app.close();
  }
}

void main();
