import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validateIngestionEnv } from '../../config/ingestion-env';
import { PrismaModule } from '../../prisma/prisma.module';
import { IgdbClient } from './igdb/igdb.client';
import { IngestionModule } from './ingestion.module';
import { RunIngestionUseCase } from './run-ingestion.use-case';

describe('IngestionModule', () => {
  it('cria o cliente IGDB e o caso de uso com a configuração validada e os arquivos versionados', async () => {
    const env = {
      DATABASE_URL: 'postgresql://indie:indie@localhost:5432/indie',
      IGDB_CLIENT_ID: 'client-id',
      IGDB_CLIENT_SECRET: 'client-secret',
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          ignoreEnvVars: true,
          validate: () => validateIngestionEnv(env),
        }),
        PrismaModule,
        IngestionModule,
      ],
    }).compile();

    expect(moduleRef.get(IgdbClient)).toBeInstanceOf(IgdbClient);
    expect(moduleRef.get(RunIngestionUseCase)).toBeInstanceOf(RunIngestionUseCase);
  });
});
