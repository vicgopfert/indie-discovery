import { ApiErrorSchema, RecommendationListSchema, UserSchema } from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { ContentIndexRepository } from '../src/modules/recommendation/content-index.repository';
import { ContentIndexService } from '../src/modules/recommendation/content-index.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogBuilder } from './support/catalog-builder';
import { contentIndexLoaded } from './support/content-index';

async function createApp(
  override?: (builder: ReturnType<typeof Test.createTestingModule>) => void,
) {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  override?.(builder);
  const moduleRef = await builder
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  await contentIndexLoaded(app);
  return app;
}

function sessionHelpers(app: INestApplication<App>) {
  const origin = app.get(ConfigService).getOrThrow<string>('WEB_ORIGIN');
  const server = () => request(app.getHttpServer());
  const register = async (email: string) => {
    const response = await server()
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email, displayName: 'Jogadora', password: 'senha-forte' });
    return String(response.headers['set-cookie']).split(';')[0]!;
  };
  const as = (cookie: string) => ({
    get: (path: string) => server().get(path).set('Cookie', cookie),
    put: (path: string, body?: object) =>
      server().put(path).set('Cookie', cookie).set('Origin', origin).send(body),
    patch: (path: string, body: object) =>
      server().patch(path).set('Cookie', cookie).set('Origin', origin).send(body),
  });
  return { server, register, as };
}

describe('Recomendações (GET /recommendations)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let helpers: ReturnType<typeof sessionHelpers>;
  let jogadora: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    helpers = sessionHelpers(app);
  });

  // O IDF vem da ingestão; aqui todo atributo vale 1, e o índice é recarregado com o catálogo novo.
  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "User", "Game", "Feature", "Company" CASCADE`;
    const catalog = new CatalogBuilder(prisma);
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
    return RecommendationListSchema.parse(response.body);
  };
  const slugs = async (query = '') => (await recommendations(query)).items.map((i) => i.game.slug);
  const rate = (slug: string, score: number) =>
    helpers.as(jogadora).put(`/api/me/ratings/${slug}`, { score });

  it('exige sessão', async () => {
    expect((await helpers.server().get('/api/recommendations')).status).toBe(401);
  });

  it('sem avaliações, listas nem preferências, indica a partida a frio', async () => {
    expect(await recommendations()).toEqual({ mode: 'BALANCED', basis: 'empty', items: [] });
  });

  it('só com as preferências, recomenda com o motivo em português', async () => {
    await helpers
      .as(jogadora)
      .put('/api/me/preferences', { genres: ['puzzle', 'platform'], themes: ['horror'] });

    const list = await recommendations();

    expect(list.basis).toBe('profile');
    expect(list.items[0]).toMatchObject({
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
    expect(list.items.map(({ game }) => game.slug)).toEqual([
      'hollow-knight',
      'ori',
      'celeste',
      'inside',
      'baba-is-you',
    ]);
  });

  it('sem modo na consulta, usa o salvo; com modo, usa o pedido sem gravá-lo', async () => {
    await rate('celeste', 5);
    await helpers.as(jogadora).patch('/api/me', { discoveryMode: 'DISCOVERY' });

    expect((await recommendations()).mode).toBe('DISCOVERY');
    expect((await recommendations('?mode=popular')).mode).toBe('POPULAR');
    const me = UserSchema.parse((await helpers.as(jogadora).get('/api/auth/me')).body);
    expect(me.discoveryMode).toBe('DISCOVERY');
  });

  it('respeita o limite e recusa modo ou limite fora das opções', async () => {
    await rate('celeste', 5);

    expect(await slugs('?limit=2')).toHaveLength(2);
    const invalid = await helpers.as(jogadora).get('/api/recommendations?mode=novidades&limit=51');
    expect(invalid.status).toBe(400);
    expect(ApiErrorSchema.parse(invalid.body).message).toEqual([
      'mode: Modo deve ser popular, balanced ou discovery.',
      'limit: O limite vai até 50.',
    ]);
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
