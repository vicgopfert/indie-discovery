import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, GameDetailSchema, GamePageSchema } from '@indie/contracts';
import request from 'supertest';
import type { App } from 'supertest/types';
import { seedReferenceData } from '../prisma/seed/reference-data';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { ReleaseStatus, StudioCountrySource } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogBuilder } from './support/catalog-builder';

describe('Catálogo', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`TRUNCATE "IngestionRun", "Game", "Company", "Feature" CASCADE`;
    await seedReferenceData(prisma);
    const catalog = new CatalogBuilder(prisma);
    const { UPCOMING } = ReleaseStatus;
    for (const game of [
      {
        name: 'Celeste',
        genres: ['Platform', 'Adventure', 'Indie'],
        themes: ['Action'],
        popularity: 0.9,
        releasedOn: '2018-01-25',
        storeUrl: 'https://www.celestegame.com',
        studioCountry: { alpha2: 'CA', source: StudioCountrySource.IGDB },
        developers: ['Maddy Makes Games', 'Extremely OK Games'],
        publishers: ['Maddy Makes Games'],
        languages: [
          { locale: 'pt-BR', interface: true, subtitles: true },
          { locale: 'en-US', interface: true, subtitles: true, audio: true },
        ],
      },
      {
        name: 'Hollow Knight',
        genres: ['Platform', 'Adventure', 'Indie'],
        themes: ['Action', 'Fantasy'],
        popularity: 0.8,
        releasedOn: '2017-02-24',
      },
      {
        name: 'Hollow Knight: Silksong',
        genres: ['Platform', 'Adventure', 'Indie'],
        themes: ['Fantasy'],
        status: UPCOMING,
        popularity: 0.95,
      },
      {
        name: 'Outer Wilds',
        genres: ['Adventure', 'Puzzle', 'Indie'],
        themes: ['Science fiction'],
        popularity: 0.5,
        releasedOn: '2019-05-28',
      },
      {
        name: 'Baba Is You',
        genres: ['Puzzle', 'Indie'],
        popularity: 0.5,
        releasedOn: '2019-03-13',
      },
      {
        name: '100% Orange Juice',
        genres: ['Card & Board Game', 'Indie'],
        releasedOn: '2014-05-14',
      },
      {
        name: '1000xResist',
        genres: ['Adventure', 'Indie'],
        popularity: 0.2,
        releasedOn: '2024-05-09',
      },
      {
        name: 'Jogo Rejeitado',
        genres: ['Puzzle', 'Indie'],
        themes: ['Horror'],
        popularity: 1,
        inCatalog: false,
      },
    ]) {
      await catalog.game(game);
    }
  });

  afterAll(() => app.close());

  const games = async (query: Record<string, string | string[]> = {}) => {
    const response = await request(app.getHttpServer()).get('/api/games').query(query).expect(200);
    return GamePageSchema.parse(response.body);
  };
  const names = async (query: Record<string, string | string[]> = {}) =>
    (await games(query)).items.map(({ name }) => name);

  describe('GET /api/games', () => {
    it('é público e mostra só jogos do catálogo, dos mais populares, com desempate pelo nome', async () => {
      expect(await names()).toEqual([
        'Hollow Knight: Silksong',
        'Celeste',
        'Hollow Knight',
        'Baba Is You',
        'Outer Wilds',
        '1000xResist',
        '100% Orange Juice',
      ]);
    });

    it('cada jogo traz capa, situação, data e gêneros em português, sem o Indie', async () => {
      const { items } = await games({ q: 'celeste' });

      expect(items).toEqual([
        {
          slug: 'celeste',
          name: 'Celeste',
          coverImageId: 'cover-celeste',
          releaseStatus: 'RELEASED',
          firstReleaseDate: '2018-01-25',
          genres: [
            { slug: 'adventure', name: 'Aventura' },
            { slug: 'platform', name: 'Plataforma' },
          ],
        },
      ]);
    });

    it('busca parte do nome sem diferenciar maiúsculas', async () => {
      expect(await names({ q: 'KNIGHT' })).toEqual(['Hollow Knight: Silksong', 'Hollow Knight']);
    });

    it('trata "%" digitado como texto, não como curinga', async () => {
      expect(await names({ q: '100%' })).toEqual(['100% Orange Juice']);
    });

    it('com dois gêneros, só traz jogos que têm os dois', async () => {
      expect(await names({ genre: ['adventure', 'puzzle'] })).toEqual(['Outer Wilds']);
    });

    it('combina gênero, tema e situação', async () => {
      const query = { genre: 'platform', theme: 'fantasy' };

      expect(await names(query)).toEqual(['Hollow Knight: Silksong', 'Hollow Knight']);
      expect(await names({ ...query, status: 'released' })).toEqual(['Hollow Knight']);
      expect(await names({ ...query, status: 'upcoming' })).toEqual(['Hollow Knight: Silksong']);
    });

    it('não acha jogo fora do catálogo nem pelo nome', async () => {
      expect(await names({ q: 'rejeitado' })).toEqual([]);
    });

    it('filtro com slug desconhecido devolve lista vazia, não erro', async () => {
      expect(await games({ genre: 'nao-existe' })).toMatchObject({ items: [], total: 0 });
    });

    it('ordena pelos lançamentos mais recentes, com os jogos sem data no fim', async () => {
      expect(await names({ sort: 'newest' })).toEqual([
        '1000xResist',
        'Outer Wilds',
        'Baba Is You',
        'Celeste',
        'Hollow Knight',
        '100% Orange Juice',
        'Hollow Knight: Silksong',
      ]);
    });

    it('ordena pelo nome', async () => {
      expect(await names({ sort: 'name', genre: 'platform' })).toEqual([
        'Celeste',
        'Hollow Knight',
        'Hollow Knight: Silksong',
      ]);
    });

    it('pagina com total e total de páginas', async () => {
      const page = await games({ pageSize: '3', page: '3' });

      expect(page).toMatchObject({ page: 3, pageSize: 3, total: 7, totalPages: 3 });
      expect(page.items.map(({ name }) => name)).toEqual(['100% Orange Juice']);
    });

    it('página além do fim volta vazia, com o total certo', async () => {
      expect(await games({ pageSize: '3', page: '4' })).toMatchObject({ items: [], total: 7 });
    });

    it('aceita até 48 por página e recusa 49 com o formato de erro padrão', async () => {
      expect((await games({ pageSize: '48' })).pageSize).toBe(48);

      const response = await request(app.getHttpServer())
        .get('/api/games')
        .query({ pageSize: '49' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        statusCode: 400,
        message: ['pageSize: O tamanho da página vai até 48.'],
      });
    });
  });

  describe('GET /api/games/:slug', () => {
    const game = (slug: string) => request(app.getHttpServer()).get(`/api/games/${slug}`);

    it('é público e traz a ficha com empresas, país, idiomas e link oficial, sem o Indie', async () => {
      const response = await game('celeste').expect(200);

      expect(GameDetailSchema.parse(response.body)).toEqual({
        slug: 'celeste',
        name: 'Celeste',
        coverImageId: 'cover-celeste',
        releaseStatus: 'RELEASED',
        firstReleaseDate: '2018-01-25',
        genres: [
          { slug: 'adventure', name: 'Aventura' },
          { slug: 'platform', name: 'Plataforma' },
        ],
        summary: 'Resumo de Celeste',
        themes: [{ slug: 'action', name: 'Ação' }],
        developers: ['Extremely OK Games', 'Maddy Makes Games'],
        publishers: ['Maddy Makes Games'],
        studioCountry: { code: 'CA', name: 'Canadá', source: 'IGDB' },
        languages: [
          { locale: 'en-US', name: 'Inglês', interface: true, subtitles: true, audio: true },
          {
            locale: 'pt-BR',
            name: 'Português (Brasil)',
            interface: true,
            subtitles: true,
            audio: false,
          },
        ],
        officialUrl: 'https://www.celestegame.com',
      });
    });

    it('jogo sem os dados opcionais traz listas vazias e nulos', async () => {
      const response = await game('hollow-knight-silksong').expect(200);

      expect(GameDetailSchema.parse(response.body)).toMatchObject({
        releaseStatus: 'UPCOMING',
        firstReleaseDate: null,
        developers: [],
        publishers: [],
        studioCountry: null,
        languages: [],
        officialUrl: null,
      });
    });

    it.each([
      ['slug inexistente', 'nao-existe'],
      ['jogo fora do catálogo', 'jogo-rejeitado'],
    ])('%s responde 404 no formato de erro padrão', async (_, slug) => {
      const response = await game(slug);

      expect(response.status).toBe(404);
      expect(ApiErrorSchema.safeParse(response.body).success).toBe(true);
      expect(response.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        message: 'Jogo não encontrado.',
      });
    });
  });

  describe('GET /api/features', () => {
    const features = (type: string) =>
      request(app.getHttpServer()).get('/api/features').query({ type });

    it('lista os gêneros em português, com quantos jogos do catálogo têm cada um, sem o Indie', async () => {
      const response = await features('genre').expect(200);

      expect(response.body).toEqual([
        { slug: 'adventure', name: 'Aventura', gameCount: 5 },
        { slug: 'card-board-game', name: 'Cartas e tabuleiro', gameCount: 1 },
        { slug: 'platform', name: 'Plataforma', gameCount: 3 },
        { slug: 'puzzle', name: 'Quebra-cabeça', gameCount: 2 },
      ]);
    });

    it('não oferece tema que só aparece em jogo fora do catálogo', async () => {
      const response = await features('theme').expect(200);

      expect(response.body).toEqual([
        { slug: 'action', name: 'Ação', gameCount: 2 },
        { slug: 'fantasy', name: 'Fantasia', gameCount: 2 },
        { slug: 'science-fiction', name: 'Ficção científica', gameCount: 1 },
      ]);
    });

    it('recusa tipo desconhecido', async () => {
      const response = await features('keyword');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ message: ['type: Tipo deve ser genre ou theme.'] });
    });
  });
});
