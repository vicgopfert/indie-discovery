import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { validateIngestionEnv } from '../../config/ingestion-env';
import { IgdbClient } from './igdb.client';
import { IngestionModule } from './ingestion.module';

describe('IngestionModule', () => {
  it('cria o cliente IGDB com as credenciais da configuração validada', async () => {
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
        IngestionModule,
      ],
    }).compile();

    expect(moduleRef.get(IgdbClient)).toBeInstanceOf(IgdbClient);
  });
});
