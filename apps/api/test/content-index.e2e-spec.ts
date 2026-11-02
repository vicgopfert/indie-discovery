import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { ContentIndexService } from '../src/modules/recommendation/content-index.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogBuilder } from './support/catalog-builder';

describe('Índice de conteúdo', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let contentIndex: ContentIndexService;
  let catalog: CatalogBuilder;
  let secret: string;

  // O catálogo é gravado antes do init, para a carga da inicialização já encontrá-lo.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    prisma = app.get(PrismaService);
    contentIndex = app.get(ContentIndexService);
    secret = app.get(ConfigService).getOrThrow<string>('INTERNAL_RELOAD_SECRET');

    await prisma.$executeRaw`TRUNCATE "Game", "Feature", "Company" CASCADE`;
    catalog = new CatalogBuilder(prisma);
    await catalog.game({ name: 'Celeste', genres: ['Platform'], themes: ['Action'] });
    await catalog.game({ name: 'Hades', genres: ['Roguelike'], themes: ['Action'] });
    await catalog.game({ name: 'Fora', genres: ['Platform'], inCatalog: false });
    await prisma.feature.updateMany({ data: { idf: 1 } });

    await app.init();
  });

  afterAll(() => app.close());

  const reload = () => request(app.getHttpServer()).post('/api/internal/reload-index');

  it('carrega os jogos do catálogo na inicialização', async () => {
    await contentIndex.settled();

    const index = contentIndex.index!;
    expect(index.games.map((game) => game.slug).sort()).toEqual(['celeste', 'hades']);
    expect(contentIndex.status()).toMatchObject({ status: 'ready', games: 2 });
  });

  it('recarrega sem reiniciar, com o segredo e sem Origin', async () => {
    await catalog.game({ name: 'Tunic', genres: ['Adventure'], themes: ['Action'] });
    await prisma.feature.updateMany({ data: { idf: 1 } });

    const response = await reload().set('Authorization', `Bearer ${secret}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ games: 3, features: 4 });
    expect(contentIndex.index!.games.map((game) => game.slug)).toContain('tunic');
  });

  it('recusa a recarga sem o segredo ou com o segredo errado', async () => {
    const without = await reload();
    const wrong = await reload().set('Authorization', 'Bearer segredo-errado');

    expect(without.status).toBe(401);
    expect(wrong.status).toBe(401);
  });
});
