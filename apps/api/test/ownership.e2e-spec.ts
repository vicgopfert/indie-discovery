import {
  ApiErrorSchema,
  GameLibraryStateSchema,
  LibrarySchema,
  OnboardingGamesSchema,
  PreferencesSchema,
  RecommendationOverviewSchema,
  RecommendationPageSchema,
  UserSchema,
} from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Application } from 'express';
import type { Test } from 'supertest';
import type { App } from 'supertest/types';
import { ContentIndexService } from '../src/modules/recommendation/content-index.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogBuilder } from './support/catalog-builder';
import { createApp, sessionHelpers } from './support/e2e-app';

const GAMES = ['celeste', 'ori', 'hollow-knight', 'inside', 'baba-is-you', 'darkwood'];
const LISTS = ['favorite', 'completed', 'want-to-play'];
const PREFERENCES = { genres: ['puzzle', 'platform'], themes: ['horror'] };
const SESSION_REQUIRED = 'Sessão ausente ou expirada';

// Rotas registradas no servidor e fora da documentação pública, cada uma com o motivo.
const HIDDEN_FROM_DOCS: Record<string, string> = {
  'POST /api/internal/reload-index':
    'chamada só pelo workflow de ingestão, com o segredo interno, e não pela sessão',
};

// Nenhuma rota identifica um usuário pelo caminho: só o jogo, a lista e a lista recomendada.
const ALLOWED_PATH_PARAMS = new Set(['slug', 'list', 'key']);
const SAMPLE_PARAMS: Record<string, string> = { slug: 'celeste', list: 'favorite', key: 'main' };

type Client = ReturnType<ReturnType<typeof sessionHelpers>['as']>;

// Cada rota que exige sessão, com o que a Jogadora faz por ela sobre os mesmos jogos da Outra. O
// inventário confere que esta lista é exatamente a das rotas com sessão: uma rota nova com sessão
// precisa entrar aqui. O logout vem por último, porque encerra a sessão da Jogadora. Cada
// requisição é criada só na hora de enviar: o supertest abre e fecha o servidor em cada uma.
const SESSION_ROUTES: Record<string, (as: Client) => (() => Test)[]> = {
  'PUT /api/me/ratings/:slug': (as) =>
    GAMES.map((slug) => () => as.put(`/api/me/ratings/${slug}`, { score: 1 })),
  'DELETE /api/me/ratings/:slug': (as) =>
    GAMES.map((slug) => () => as.delete(`/api/me/ratings/${slug}`)),
  'PUT /api/me/lists/:list/:slug': (as) =>
    LISTS.flatMap((list) => GAMES.map((slug) => () => as.put(`/api/me/lists/${list}/${slug}`))),
  'DELETE /api/me/lists/:list/:slug': (as) =>
    LISTS.flatMap((list) => GAMES.map((slug) => () => as.delete(`/api/me/lists/${list}/${slug}`))),
  'GET /api/me/library': (as) => [() => as.get('/api/me/library')],
  'GET /api/me/library/:slug': (as) => GAMES.map((slug) => () => as.get(`/api/me/library/${slug}`)),
  'PUT /api/me/preferences': (as) => [
    () => as.put('/api/me/preferences', { genres: ['shooter', 'adventure'], themes: ['fantasy'] }),
  ],
  'GET /api/me/preferences': (as) => [() => as.get('/api/me/preferences')],
  'GET /api/me/preferences/options': (as) => [() => as.get('/api/me/preferences/options')],
  'GET /api/me/onboarding/games': (as) => [() => as.get('/api/me/onboarding/games')],
  'PATCH /api/me': (as) => [() => as.patch('/api/me', { discoveryMode: 'POPULAR' })],
  'GET /api/auth/me': (as) => [() => as.get('/api/auth/me')],
  'GET /api/recommendations': (as) => [() => as.get('/api/recommendations')],
  'GET /api/recommendations/lists/:key': (as) => [() => as.get('/api/recommendations/lists/main')],
  'POST /api/auth/logout': (as) => [() => as.post('/api/auth/logout')],
};

describe('Posse dos dados: uma pessoa não altera nem lê a biblioteca de outra (B-30)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let helpers: ReturnType<typeof sessionHelpers>;
  let jogadora: { cookie: string; id: string };
  let outra: { cookie: string; id: string };

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    helpers = sessionHelpers(app);
    await prisma.$executeRaw`TRUNCATE "User", "Game", "Feature", "Company" CASCADE`;
    const catalog = new CatalogBuilder(prisma);
    const games = [
      { name: 'Celeste', genres: ['Platform'], themes: ['Action'] },
      { name: 'Ori', genres: ['Platform', 'Adventure'], themes: ['Fantasy'] },
      { name: 'Hollow Knight', genres: ['Platform', 'Adventure'], themes: ['Fantasy'] },
      { name: 'Inside', genres: ['Puzzle', 'Platform'], themes: ['Horror'] },
      { name: 'Baba Is You', genres: ['Puzzle'], themes: ['Comedy'] },
      { name: 'Darkwood', genres: ['Shooter'], themes: ['Horror'] },
    ];
    for (const game of games) await catalog.game(game);
    await prisma.feature.updateMany({ data: { idf: 1 } });
    await app.get(ContentIndexService).reload();
  });

  // A Outra tem um pouco de tudo, sobre os mesmos jogos em que a Jogadora vai mexer.
  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "User" CASCADE`;
    jogadora = await player('jogadora@example.com');
    outra = await player('outra@example.com');
    const as = helpers.as(outra.cookie);
    for (const response of [
      await as.put('/api/me/ratings/celeste', { score: 5 }),
      await as.put('/api/me/ratings/inside', { score: 2 }),
      await as.put('/api/me/lists/favorite/celeste'),
      await as.put('/api/me/lists/completed/hollow-knight'),
      await as.put('/api/me/lists/want-to-play/baba-is-you'),
      await as.put('/api/me/preferences', PREFERENCES),
      await as.patch('/api/me', { discoveryMode: 'DISCOVERY' }),
    ]) {
      expect(response.status).toBe(200);
    }
  });

  afterAll(() => app.close());

  async function player(email: string) {
    const cookie = await helpers.register(email);
    const me = UserSchema.parse((await helpers.as(cookie).get('/api/auth/me')).body);
    return { cookie, id: me.id };
  }

  // Tudo o que está gravado da pessoa no banco, inclusive as sessões.
  const rowsOf = (userId: string) =>
    Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.session.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      prisma.rating.findMany({ where: { userId }, orderBy: { gameId: 'asc' } }),
      prisma.listEntry.findMany({
        where: { userId },
        orderBy: [{ gameId: 'asc' }, { listType: 'asc' }],
      }),
      prisma.userPreference.findMany({ where: { userId }, orderBy: { featureId: 'asc' } }),
    ]);

  // Tudo o que a pessoa lê de si pela API.
  const viewOf = async (cookie: string) => {
    const as = helpers.as(cookie);
    return {
      me: UserSchema.parse((await as.get('/api/auth/me')).body),
      library: LibrarySchema.parse((await as.get('/api/me/library')).body),
      games: await Promise.all(
        GAMES.map(async (slug) =>
          GameLibraryStateSchema.parse((await as.get(`/api/me/library/${slug}`)).body),
        ),
      ),
      preferences: PreferencesSchema.parse((await as.get('/api/me/preferences')).body),
      recommendations: RecommendationOverviewSchema.parse(
        (await as.get('/api/recommendations')).body,
      ),
    };
  };

  it('nada do que a Jogadora faz, por nenhuma rota com sessão, muda os dados da Outra', async () => {
    const rows = await rowsOf(outra.id);
    const view = await viewOf(outra.cookie);

    for (const [route, act] of Object.entries(SESSION_ROUTES)) {
      for (const send of act(helpers.as(jogadora.cookie))) {
        const { status } = await send();
        expect([route, status < 300]).toEqual([route, true]);
      }
    }

    expect(await rowsOf(outra.id)).toEqual(rows);
    expect(await viewOf(outra.cookie)).toEqual(view);
  });

  it('a Jogadora não lê nada da Outra: biblioteca, estado de cada jogo, preferências e conta', async () => {
    const view = await viewOf(jogadora.cookie);

    expect(view.me).toMatchObject({ id: jogadora.id, email: 'jogadora@example.com' });
    expect(view.library).toEqual({
      ratings: [],
      lists: { FAVORITE: [], COMPLETED: [], WANT_TO_PLAY: [] },
    });
    expect(view.games).toEqual(GAMES.map(() => ({ rating: null, lists: [] })));
    expect(view.preferences).toEqual({ genres: [], themes: [], tags: [] });
    expect(view.recommendations.basis).toBe('empty');
  });

  it('a biblioteca da Outra não entra na recomendação da Jogadora', async () => {
    const as = helpers.as(jogadora.cookie);
    await as.put('/api/me/ratings/ori', { score: 5 });

    const page = RecommendationPageSchema.parse(
      (await as.get('/api/recommendations/lists/main')).body,
    );
    expect(page.items.map(({ game }) => game.slug)).toContain('celeste');

    expect(
      (await helpers.as(outra.cookie).get('/api/recommendations/lists/game:celeste')).status,
    ).toBe(200);
    const response = await as.get('/api/recommendations/lists/game:celeste');
    expect(response.status).toBe(404);
    expect(ApiErrorSchema.parse(response.body).message).toBe('Lista não encontrada.');
  });

  it('a biblioteca da Outra não tira jogos da partida a frio da Jogadora', async () => {
    const as = helpers.as(jogadora.cookie);
    await as.put('/api/me/preferences', PREFERENCES);

    const response = await as.get('/api/me/onboarding/games');

    expect(response.status).toBe(200);
    expect(OnboardingGamesSchema.parse(response.body).items.map(({ slug }) => slug)).toEqual(
      expect.arrayContaining(['celeste', 'inside', 'baba-is-you']),
    );
  });

  it('gravações simultâneas no mesmo jogo ficam cada uma com a sua dona', async () => {
    const [a, b] = [helpers.as(jogadora.cookie), helpers.as(outra.cookie)];

    await Promise.all([
      a.put('/api/me/ratings/darkwood', { score: 1 }),
      b.put('/api/me/ratings/darkwood', { score: 4 }),
      a.put('/api/me/lists/want-to-play/darkwood'),
      b.put('/api/me/lists/completed/darkwood'),
    ]);

    expect(
      GameLibraryStateSchema.parse((await a.get('/api/me/library/darkwood')).body),
    ).toMatchObject({ rating: { score: 1 }, lists: ['WANT_TO_PLAY'] });
    expect(
      GameLibraryStateSchema.parse((await b.get('/api/me/library/darkwood')).body),
    ).toMatchObject({ rating: { score: 4 }, lists: ['COMPLETED'] });
  });

  describe('a identidade vem só da sessão, nunca do corpo nem da consulta', () => {
    it('a nota e a lista com o id da Outra no corpo e na consulta ficam com a Jogadora', async () => {
      const rows = await rowsOf(outra.id);
      const as = helpers.as(jogadora.cookie);

      const rated = await as.put(`/api/me/ratings/celeste?userId=${outra.id}`, {
        score: 3,
        userId: outra.id,
      });
      const listed = await as.put(`/api/me/lists/favorite/inside?userId=${outra.id}`, {
        userId: outra.id,
      });

      expect([rated.status, listed.status]).toEqual([200, 200]);
      expect(LibrarySchema.parse((await as.get('/api/me/library')).body)).toMatchObject({
        ratings: [{ score: 3, game: { slug: 'celeste' } }],
        lists: { FAVORITE: [{ game: { slug: 'inside' } }] },
      });
      expect(await rowsOf(outra.id)).toEqual(rows);
    });

    it('as preferências com o id da Outra no corpo ficam com a Jogadora', async () => {
      const rows = await rowsOf(outra.id);
      const as = helpers.as(jogadora.cookie);

      const response = await as.put('/api/me/preferences', {
        genres: ['shooter', 'adventure'],
        themes: ['fantasy'],
        userId: outra.id,
      });

      expect(response.status).toBe(200);
      expect(PreferencesSchema.parse((await as.get('/api/me/preferences')).body)).toEqual(
        PreferencesSchema.parse(response.body),
      );
      expect(await rowsOf(outra.id)).toEqual(rows);
    });

    it('o PATCH /me com id, e-mail, papel e nome no corpo só troca o modo da Jogadora', async () => {
      const rows = await rowsOf(outra.id);
      const [before] = await rowsOf(jogadora.id);

      const response = await helpers.as(jogadora.cookie).patch('/api/me', {
        discoveryMode: 'POPULAR',
        id: outra.id,
        email: 'outra@example.com',
        role: 'ADMIN',
        displayName: 'Outra',
      });

      expect(response.status).toBe(200);
      const [after] = await rowsOf(jogadora.id);
      expect(after).toEqual({ ...before, discoveryMode: 'POPULAR' });
      expect(await rowsOf(outra.id)).toEqual(rows);
    });
  });

  describe('inventário das rotas', () => {
    // A tabela real do Express, depois do prefixo global: o que o servidor de fato atende.
    const registeredRoutes = () => {
      const express = app.getHttpAdapter().getInstance() as Application;
      return express.router.stack.flatMap(({ route }) =>
        route
          ? Object.keys((route as unknown as { methods: Record<string, boolean> }).methods)
              .filter((method) => method !== '_all')
              .map((method) => `${method.toUpperCase()} ${route.path}`)
          : [],
      );
    };
    const documentedRoutes = () =>
      Object.entries(
        SwaggerModule.createDocument(app, new DocumentBuilder().build()).paths,
      ).flatMap(([path, operations]) =>
        Object.keys(operations).map(
          (method) => `${method.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ':$1')}`,
        ),
      );
    const pathParams = (route: string) => [...route.matchAll(/:(\w+)/g)].map(([, name]) => name!);

    it('o servidor atende só as rotas documentadas e as exceções declaradas', () => {
      const registered = registeredRoutes();
      const documented = documentedRoutes();

      expect(new Set(registered).size).toBe(registered.length);
      expect(documented.filter((route) => route in HIDDEN_FROM_DOCS)).toEqual([]);
      expect([...registered].sort()).toEqual(
        [...documented, ...Object.keys(HIDDEN_FROM_DOCS)].sort(),
      );
    });

    it('nenhuma rota recebe um identificador de usuário pelo caminho', () => {
      for (const route of registeredRoutes()) {
        for (const param of pathParams(route)) {
          expect([route, ALLOWED_PATH_PARAMS.has(param)]).toEqual([route, true]);
        }
      }
    });

    it('as rotas que exigem sessão são exatamente as da prova de posse', async () => {
      const sessionRoutes: string[] = [];
      for (const route of registeredRoutes()) {
        const [method, path] = route.split(' ') as [string, string];
        const url = path.replace(/:(\w+)/g, (_, name: string) => SAMPLE_PARAMS[name]!);
        const response = await helpers.anonymous(method, url);
        const message =
          response.status === 401 ? ApiErrorSchema.parse(response.body).message : null;
        if (message === SESSION_REQUIRED) sessionRoutes.push(route);
      }

      expect(sessionRoutes.sort()).toEqual(Object.keys(SESSION_ROUTES).sort());
    });
  });
});
