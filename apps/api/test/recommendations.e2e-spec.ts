import {
  ApiErrorSchema,
  RecommendationOverviewSchema,
  RecommendationPageSchema,
  UserSchema,
} from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { ContentIndexRepository } from '../src/modules/recommendation/content-index.repository';
import { ContentIndexService } from '../src/modules/recommendation/content-index.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogBuilder } from './support/catalog-builder';
import { createApp, sessionHelpers } from './support/e2e-app';

describe('Recomendações (GET /recommendations)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let helpers: ReturnType<typeof sessionHelpers>;
  let jogadora: string;
  let catalog: CatalogBuilder;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    helpers = sessionHelpers(app);
  });

  // O IDF vem da ingestão; aqui todo atributo vale 1, e o índice é recarregado com o catálogo novo.
  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "User", "Game", "Feature", "Company" CASCADE`;
    catalog = new CatalogBuilder(prisma);
    const games = [
      { name: 'Hollow Knight', genres: ['Platform', 'Adventure'], themes: ['Fantasy'], pop: 0.9 },
      { name: 'Ori', genres: ['Platform', 'Adventure'], themes: ['Fantasy'], pop: 0.8 },
      { name: 'Celeste', genres: ['Platform'], themes: ['Action'], pop: 0.7 },
      { name: 'Inside', genres: ['Puzzle', 'Platform'], themes: ['Horror'], pop: 0.5 },
      { name: 'Baba Is You', genres: ['Puzzle'], themes: ['Comedy'], pop: 0.3 },
      { name: 'Darkwood', genres: ['Shooter'], themes: ['Horror', 'Survival'], pop: 0.1 },
    ];
    for (const { pop, ...game } of games) await catalog.game({ ...game, popularity: pop });
    await prisma.feature.updateMany({ data: { idf: 1 } });
    await app.get(ContentIndexService).reload();
    jogadora = await helpers.register('jogadora@example.com');
  });

  afterAll(() => app.close());

  const recommendations = async (query = '') => {
    const response = await helpers.as(jogadora).get(`/api/recommendations${query}`);
    expect(response.status).toBe(200);
    return RecommendationOverviewSchema.parse(response.body);
  };
  const slugs = async (query = '') =>
    (await recommendations(query)).main.items.map((i) => i.game.slug);
  const listPage = async (key: string, query = '') => {
    const response = await helpers.as(jogadora).get(`/api/recommendations/lists/${key}${query}`);
    expect(response.status).toBe(200);
    return RecommendationPageSchema.parse(response.body);
  };
  const rate = (slug: string, score: number) =>
    helpers.as(jogadora).put(`/api/me/ratings/${slug}`, { score });

  it('exige sessão', async () => {
    expect((await helpers.server().get('/api/recommendations')).status).toBe(401);
    expect((await helpers.server().get('/api/recommendations/lists/main')).status).toBe(401);
  });

  it('sem avaliações, listas nem preferências, indica a partida a frio', async () => {
    expect(await recommendations()).toEqual({
      mode: 'BALANCED',
      basis: 'empty',
      main: { items: [], hasMore: false },
      shelves: [],
    });
  });

  it('só com as preferências, recomenda com o motivo em português', async () => {
    await helpers
      .as(jogadora)
      .put('/api/me/preferences', { genres: ['puzzle', 'platform'], themes: ['horror'] });

    const list = await recommendations();

    expect(list.basis).toBe('profile');
    expect(list.main.items[0]).toMatchObject({
      game: { slug: 'inside', name: 'Inside' },
      reason: {
        kind: 'features',
        features: expect.arrayContaining([
          { slug: 'puzzle', name: 'Quebra-cabeça' },
          { slug: 'platform', name: 'Plataforma' },
          { slug: 'horror', name: 'Terror' },
        ]) as unknown,
      },
    });
  });

  it('a etiqueta escolhida na partida a frio vira prateleira e motivo', async () => {
    for (const name of ['Dead Cells', 'Hades', 'Spelunky', 'Noita', 'Rogue Legacy']) {
      await catalog.game({ name, genres: ['Platform'], tags: ['Roguelike'], popularity: 0.2 });
    }
    await prisma.feature.updateMany({ data: { idf: 1 } });
    await app.get(ContentIndexService).reload();
    await helpers
      .as(jogadora)
      .put('/api/me/preferences', { genres: ['puzzle'], themes: ['horror'], tags: ['roguelike'] });

    // A visão geral não repete jogos, e neste catálogo pequeno a principal fica com todos: a
    // prateleira aparece pelo "ver mais", que só existe para os interesses do perfil.
    const shelf = await listPage('tag:roguelike');
    const main = await recommendations();

    expect(shelf.items.map(({ game }) => game.slug).sort()).toEqual([
      'dead-cells',
      'hades',
      'noita',
      'rogue-legacy',
      'spelunky',
    ]);
    expect(main.main.items.map(({ reason }) => reason)).toContainEqual(
      expect.objectContaining({
        features: expect.arrayContaining([{ slug: 'roguelike', name: 'Roguelike' }]) as unknown,
      }),
    );
  });

  it('deixa de fora o jogo avaliado e o que está em lista', async () => {
    await rate('hollow-knight', 5);
    await helpers.as(jogadora).put('/api/me/lists/want-to-play/celeste');

    const list = await slugs();

    expect(list).toContain('ori');
    expect(list).not.toContain('hollow-knight');
    expect(list).not.toContain('celeste');
  });

  it('com só notas negativas, recorre aos mais populares', async () => {
    await rate('darkwood', 1);

    const list = await recommendations();

    expect(list.basis).toBe('popular');
    expect(list.shelves).toEqual([]);
    expect(list.main.items.map(({ game }) => game.slug)).toEqual([
      'hollow-knight',
      'ori',
      'celeste',
      'inside',
      'baba-is-you',
    ]);
    const page = await listPage('main');
    expect(page.basis).toBe('popular');
    expect(page.items.slice(0, list.main.items.length)).toEqual(list.main.items);
  });

  it('sem modo na consulta, usa o salvo; com modo, usa o pedido sem gravá-lo', async () => {
    await rate('celeste', 5);
    await helpers.as(jogadora).patch('/api/me', { discoveryMode: 'DISCOVERY' });

    expect((await recommendations()).mode).toBe('DISCOVERY');
    expect((await recommendations('?mode=popular')).mode).toBe('POPULAR');
    const me = UserSchema.parse((await helpers.as(jogadora).get('/api/auth/me')).body);
    expect(me.discoveryMode).toBe('DISCOVERY');
  });

  it('recusa modo ou página fora das opções', async () => {
    await rate('celeste', 5);

    const invalid = await helpers.as(jogadora).get('/api/recommendations?mode=novidades');
    expect(invalid.status).toBe(400);
    expect(ApiErrorSchema.parse(invalid.body).message).toEqual([
      'mode: Modo deve ser popular, balanced ou discovery.',
    ]);
    const page = await helpers.as(jogadora).get('/api/recommendations/lists/main?page=0');
    expect(page.status).toBe(400);
    expect(ApiErrorSchema.parse(page.body).message).toEqual(['page: A página começa em 1.']);
  });

  it('mostra uma prateleira por interesse, sem repetir jogos, e o "ver mais" de cada lista', async () => {
    await helpers
      .as(jogadora)
      .put('/api/me/preferences', { genres: ['puzzle', 'shooter'], themes: ['horror'] });

    const overview = await recommendations();
    const shown = [overview.main, ...overview.shelves].flatMap(({ items }) =>
      items.map(({ game }) => game.slug),
    );
    expect(new Set(shown).size).toBe(shown.length);

    const horror = await listPage('theme:horror');
    expect(horror).toMatchObject({
      mode: 'BALANCED',
      basis: 'profile',
      key: 'theme:horror',
      feature: { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' },
      game: null,
      page: 1,
      hasMore: false,
    });
    expect(horror.items.map(({ game }) => game.slug).sort()).toEqual(['darkwood', 'inside']);
    expect((await listPage('main', '?page=2')).items).toEqual([]);
  });

  it('a etiqueta vira interesse e tem "ver mais", com o título do vocabulário', async () => {
    // Com 30 jogos, Roguelike fica em 10% do catálogo, no limite das prateleiras específicas.
    for (let i = 1; i <= 21; i++)
      await catalog.game({ name: `Enchimento ${i}`, genres: ['Puzzle'] });
    await catalog.game({ name: 'Dead Cells', genres: ['Platform'], tags: ['Roguelike'] });
    await catalog.game({
      name: 'Rogue Legacy',
      genres: ['Platform'],
      tags: ['Roguelike'],
      tagSource: 'IGDB',
    });
    await catalog.game({ name: 'Spelunky', genres: ['Platform'], tags: ['Roguelike'] });
    await prisma.feature.updateMany({ data: { idf: 1 } });
    await app.get(ContentIndexService).reload();
    await rate('dead-cells', 5);
    await rate('rogue-legacy', 5);

    // Roguelike, de subgênero, cobre os dois jogos na fase 1.
    const roguelike = await listPage('tag:roguelike');
    expect(roguelike.feature).toEqual({
      type: 'TAG',
      slug: 'roguelike',
      name: 'Roguelike',
      title: 'roguelikes e roguelites',
    });
    expect(roguelike.items.map(({ game }) => game.slug)).toEqual(['spelunky']);
    // A etiqueta contribuiu e pode virar prateleira: o motivo é ela, antes do gênero.
    expect(roguelike.items[0]!.reason).toEqual({
      kind: 'features',
      features: [{ slug: 'roguelike', name: 'Roguelike' }],
    });
  });

  it('"Porque você gostou de": só de jogo com nota 4 ou mais ou favorito, com "ver mais"', async () => {
    await catalog.game({ name: 'Dead Cells', genres: ['Platform'], themes: ['Action'] });
    await catalog.game({ name: 'Katana Zero', genres: ['Platform'], themes: ['Action'] });
    await prisma.feature.updateMany({ data: { idf: 1 } });
    await app.get(ContentIndexService).reload();
    await rate('hollow-knight', 5);
    await helpers.as(jogadora).put('/api/me/lists/favorite/celeste');
    await helpers.as(jogadora).put('/api/me/lists/want-to-play/ori');
    await helpers.as(jogadora).put('/api/me/lists/completed/inside');

    const keys = (await recommendations()).shelves.map(({ key }) => key);
    expect(keys).not.toContain('game:ori');
    expect(keys).not.toContain('game:inside');
    const celeste = await listPage('game:celeste');
    expect(celeste).toMatchObject({
      key: 'game:celeste',
      feature: null,
      game: { slug: 'celeste', name: 'Celeste', inCatalog: true },
    });
    expect(celeste.items.map(({ game }) => game.slug).sort()).toEqual([
      'dead-cells',
      'katana-zero',
    ]);
    expect((await listPage('game:hollow-knight')).game).toMatchObject({ slug: 'hollow-knight' });
    for (const key of ['game:ori', 'game:inside', 'game:dead-cells']) {
      expect((await helpers.as(jogadora).get(`/api/recommendations/lists/${key}`)).status).toBe(
        404,
      );
    }
  });

  it('responde 404 para a lista que não é do perfil', async () => {
    await rate('celeste', 5);

    for (const key of ['theme:horror', 'nada', 'genre:']) {
      const response = await helpers.as(jogadora).get(`/api/recommendations/lists/${key}`);
      expect(response.status).toBe(404);
      expect(ApiErrorSchema.parse(response.body).message).toBe('Lista não encontrada.');
    }
  });

  it('o jogo da biblioteca que sai do catálogo continua no perfil', async () => {
    await rate('hollow-knight', 5);
    await rate('darkwood', 2);
    const before = await recommendations();

    await prisma.game.update({ where: { slug: 'hollow-knight' }, data: { inCatalog: false } });
    await app.get(ContentIndexService).reload();

    expect(app.get(ContentIndexService).index!.games.map(({ slug }) => slug)).not.toContain(
      'hollow-knight',
    );
    expect(await recommendations()).toEqual(before);
  });
});

describe('Recomendações sem o índice de conteúdo', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp((builder) =>
      builder
        .overrideProvider(ContentIndexRepository)
        .useValue({ loadRows: () => Promise.reject(new Error('banco fora do ar')) }),
    );
  });

  afterAll(() => app.close());

  it('responde 503 com mensagem clara, nunca lista vazia', async () => {
    const { register, as } = sessionHelpers(app);
    await app.get(PrismaService).$executeRaw`TRUNCATE "User" CASCADE`;
    const cookie = await register('jogadora@example.com');

    const response = await as(cookie).get('/api/recommendations');

    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(response.body).message).toBe(
      'As recomendações ainda não estão disponíveis; tente novamente em alguns instantes.',
    );
  });
});
