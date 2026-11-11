import {
  ApiErrorSchema,
  GameLibraryStateSchema,
  GameListsSchema,
  LibrarySchema,
  OnboardingGamesSchema,
  PreferenceOptionsSchema,
  PreferencesSchema,
  RatingSchema,
  UserSchema,
} from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { readTagVocabulary, tagSlug } from '../src/modules/tags/tags';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogBuilder } from './support/catalog-builder';
import { contentIndexLoaded } from './support/content-index';

describe('Biblioteca, preferências e modo (/me)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;
  let jogadora: string;
  let outra: string;
  let catalog: CatalogBuilder;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    await contentIndexLoaded(app);
    prisma = app.get(PrismaService);
    origin = app.get(ConfigService).getOrThrow<string>('WEB_ORIGIN');
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "User", "Game", "Feature", "Company" CASCADE`;
    catalog = new CatalogBuilder(prisma);
    await catalog.game({ name: 'Celeste', genres: ['Platform'], themes: ['Horror'] });
    await catalog.game({ name: 'Baba Is You', genres: ['Puzzle', 'Indie'] });
    await catalog.game({ name: 'Recem Lancado', genres: ['Puzzle'] });
    jogadora = await register('jogadora@example.com');
    outra = await register('outra@example.com');
  });

  afterAll(() => app.close());

  const server = () => request(app.getHttpServer());

  async function register(email: string) {
    const response = await server()
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({ email, displayName: 'Jogadora', password: 'senha-forte' });
    return String(response.headers['set-cookie']).split(';')[0]!;
  }

  const as = (cookie: string) => ({
    get: (path: string) => server().get(path).set('Cookie', cookie),
    put: (path: string, body?: object) =>
      server().put(path).set('Cookie', cookie).set('Origin', origin).send(body),
    patch: (path: string, body: object) =>
      server().patch(path).set('Cookie', cookie).set('Origin', origin).send(body),
    delete: (path: string) => server().delete(path).set('Cookie', cookie).set('Origin', origin),
  });

  const library = async (cookie: string) =>
    LibrarySchema.parse((await as(cookie).get('/api/me/library')).body);

  const me = async (cookie: string) =>
    UserSchema.parse((await as(cookie).get('/api/auth/me')).body);

  const errorMessage = (body: unknown) => ApiErrorSchema.parse(body).message;

  it('toda rota exige sessão, e as que alteram dados exigem a origem do frontend', async () => {
    const routes = [
      server().put('/api/me/ratings/celeste').set('Origin', origin).send({ score: 4 }),
      server().delete('/api/me/ratings/celeste').set('Origin', origin),
      server().put('/api/me/lists/favorite/celeste').set('Origin', origin),
      server().delete('/api/me/lists/favorite/celeste').set('Origin', origin),
      server().get('/api/me/library'),
      server().get('/api/me/library/celeste'),
      server().put('/api/me/preferences').set('Origin', origin).send({}),
      server().get('/api/me/preferences'),
      server().patch('/api/me').set('Origin', origin).send({ discoveryMode: 'DISCOVERY' }),
    ];
    for (const response of await Promise.all(routes)) expect(response.status).toBe(401);

    const withoutOrigin = await server()
      .put('/api/me/ratings/celeste')
      .set('Cookie', jogadora)
      .send({ score: 4 });
    expect(withoutOrigin.status).toBe(403);
  });

  describe('avaliações', () => {
    it('PUT repetido altera a nota sem duplicar', async () => {
      expect((await as(jogadora).put('/api/me/ratings/celeste', { score: 3 })).status).toBe(200);
      const response = await as(jogadora).put('/api/me/ratings/celeste', { score: 5 });

      expect(response.status).toBe(200);
      expect(RatingSchema.parse(response.body).score).toBe(5);
      expect(await prisma.rating.count()).toBe(1);
    });

    it('recusa nota fora de 1 a 5 e jogo inexistente', async () => {
      const invalid = await as(jogadora).put('/api/me/ratings/celeste', { score: 6 });
      const missing = await as(jogadora).put('/api/me/ratings/nao-existe', { score: 4 });

      expect(invalid.status).toBe(400);
      expect(errorMessage(invalid.body)).toEqual(['score: A nota vai de 1 a 5.']);
      expect(missing.status).toBe(404);
      expect(errorMessage(missing.body)).toBe('Jogo não encontrado.');
    });

    it('DELETE repetido continua respondendo 204', async () => {
      await as(jogadora).put('/api/me/ratings/celeste', { score: 4 });

      expect((await as(jogadora).delete('/api/me/ratings/celeste')).status).toBe(204);
      expect((await as(jogadora).delete('/api/me/ratings/celeste')).status).toBe(204);
      expect(await prisma.rating.count()).toBe(0);
    });
  });

  describe('listas', () => {
    it('"concluídos" e "quero jogar" se excluem; "favoritos" fica', async () => {
      await as(jogadora).put('/api/me/lists/favorite/celeste');
      await as(jogadora).put('/api/me/lists/want-to-play/celeste');
      const response = await as(jogadora).put('/api/me/lists/completed/celeste');

      expect(response.status).toBe(200);
      expect(GameListsSchema.parse(response.body)).toEqual({ lists: ['FAVORITE', 'COMPLETED'] });
    });

    it('PUT repetido não duplica e DELETE repetido responde 204', async () => {
      await as(jogadora).put('/api/me/lists/favorite/celeste');
      await as(jogadora).put('/api/me/lists/favorite/celeste');
      expect(await prisma.listEntry.count()).toBe(1);

      expect((await as(jogadora).delete('/api/me/lists/favorite/celeste')).status).toBe(204);
      expect((await as(jogadora).delete('/api/me/lists/favorite/celeste')).status).toBe(204);
      expect(await prisma.listEntry.count()).toBe(0);
    });

    it('recusa lista desconhecida, inclusive com o valor do banco na URL', async () => {
      for (const list of ['wishlist', 'FAVORITE']) {
        const response = await as(jogadora).put(`/api/me/lists/${list}/celeste`);

        expect(response.status).toBe(400);
        expect(errorMessage(response.body)).toEqual([
          'Lista deve ser favorite, completed ou want-to-play.',
        ]);
      }
    });
  });

  describe('biblioteca', () => {
    it('traz avaliações e listas da mais recente para a mais antiga', async () => {
      await as(jogadora).put('/api/me/ratings/celeste', { score: 4 });
      await as(jogadora).put('/api/me/ratings/baba-is-you', { score: 5 });
      await as(jogadora).put('/api/me/lists/want-to-play/recem-lancado');

      const body = await library(jogadora);

      expect(body.ratings.map((rating) => rating.game.slug)).toEqual(['baba-is-you', 'celeste']);
      expect(body.ratings[0]).toMatchObject({
        score: 5,
        game: {
          name: 'Baba Is You',
          genres: [{ slug: 'puzzle', name: 'Quebra-cabeça' }],
          inCatalog: true,
        },
      });
      expect(body.lists).toMatchObject({
        FAVORITE: [],
        COMPLETED: [],
        WANT_TO_PLAY: [{ game: { slug: 'recem-lancado' } }],
      });
    });

    it('o jogo que sai do catálogo continua na biblioteca, marcado, e ainda pode ser removido', async () => {
      await as(jogadora).put('/api/me/ratings/recem-lancado', { score: 4 });
      await as(jogadora).put('/api/me/lists/want-to-play/recem-lancado');
      await prisma.game.update({ where: { slug: 'recem-lancado' }, data: { inCatalog: false } });

      const body = await library(jogadora);
      expect(body.ratings).toMatchObject([{ score: 4, game: { inCatalog: false } }]);
      expect(body.lists.WANT_TO_PLAY).toMatchObject([{ game: { inCatalog: false } }]);

      expect((await as(jogadora).put('/api/me/ratings/recem-lancado', { score: 5 })).status).toBe(
        404,
      );
      expect((await as(jogadora).put('/api/me/lists/favorite/recem-lancado')).status).toBe(404);
      expect((await as(jogadora).delete('/api/me/ratings/recem-lancado')).status).toBe(204);
      expect((await as(jogadora).delete('/api/me/lists/want-to-play/recem-lancado')).status).toBe(
        204,
      );
      expect(await library(jogadora)).toEqual({
        ratings: [],
        lists: { FAVORITE: [], COMPLETED: [], WANT_TO_PLAY: [] },
      });
    });

    it('traz o estado de um jogo só, também depois que ele sai do catálogo', async () => {
      const state = async (slug: string) => {
        const response = await as(jogadora).get(`/api/me/library/${slug}`);
        expect(response.status).toBe(200);
        return GameLibraryStateSchema.parse(response.body);
      };
      expect(await state('celeste')).toEqual({ rating: null, lists: [] });

      await as(jogadora).put('/api/me/ratings/celeste', { score: 4 });
      await as(jogadora).put('/api/me/lists/favorite/celeste');
      await as(jogadora).put('/api/me/lists/completed/celeste');
      await prisma.game.update({ where: { slug: 'celeste' }, data: { inCatalog: false } });

      expect(await state('celeste')).toMatchObject({
        rating: { score: 4 },
        lists: ['FAVORITE', 'COMPLETED'],
      });
      expect((await as(jogadora).get('/api/me/library/nao-existe')).status).toBe(404);
    });
  });

  describe('preferências', () => {
    it('grava, conclui a partida a frio e troca o conjunto inteiro depois', async () => {
      expect((await me(jogadora)).onboardingCompletedAt).toBeNull();

      const first = await as(jogadora).put('/api/me/preferences', {
        genres: ['puzzle', 'platform'],
        themes: ['horror'],
      });
      const onboardedAt = (await me(jogadora)).onboardingCompletedAt;
      await as(jogadora).put('/api/me/preferences', { genres: ['puzzle', 'platform', 'puzzle'] });
      await as(jogadora).put('/api/me/preferences', {
        genres: ['puzzle'],
        themes: ['horror'],
      });

      expect(first.status).toBe(200);
      expect(PreferencesSchema.parse(first.body)).toEqual({
        genres: [
          { slug: 'platform', name: 'Plataforma' },
          { slug: 'puzzle', name: 'Quebra-cabeça' },
        ],
        themes: [{ slug: 'horror', name: 'Terror' }],
        tags: [],
      });
      expect(onboardedAt).not.toBeNull();
      expect((await me(jogadora)).onboardingCompletedAt).toBe(onboardedAt);
      const preferences = async (cookie: string) =>
        PreferencesSchema.parse((await as(cookie).get('/api/me/preferences')).body);
      expect(await preferences(jogadora)).toEqual(PreferencesSchema.parse(first.body));
      expect(await preferences(outra)).toEqual({ genres: [], themes: [], tags: [] });
    });

    it('recusa menos de 3 e opções que a partida a frio não oferece', async () => {
      await catalog.game({ name: 'Dead Cells', genres: ['Platform'], tags: ['Platformer'] });
      const few = await as(jogadora).put('/api/me/preferences', { genres: ['puzzle'] });
      const unknown = await as(jogadora).put('/api/me/preferences', {
        genres: ['puzzle', 'indie', 'roguelike'],
        themes: ['horror'],
        tags: ['platformer'],
      });

      expect(few.status).toBe(400);
      expect(errorMessage(few.body)).toEqual(['Escolha pelo menos 3 gêneros, temas ou etiquetas.']);
      expect(unknown.status).toBe(400);
      expect(errorMessage(unknown.body)).toEqual([
        'genres: Opção desconhecida: indie, roguelike.',
        'tags: Opção desconhecida: platformer.',
      ]);
      expect(await prisma.userPreference.count()).toBe(0);
    });

    it('oferece as etiquetas que viram prateleira, sem a mesma ideia em dois grupos', async () => {
      await catalog.game({
        name: 'Dead Cells',
        genres: ['Platform'],
        tags: ['Roguelike', 'Platformer', 'Pixel Graphics', 'Psychological Horror', 'Visual Novel'],
      });

      const response = await as(jogadora).get('/api/me/preferences/options');

      expect(response.status).toBe(200);
      const { genres, themes, tags } = PreferenceOptionsSchema.parse(response.body);
      expect(genres.map(({ slug }) => slug)).toEqual(['platform', 'puzzle']);
      expect(themes.map(({ slug }) => slug)).toEqual(['horror']);
      expect(tags.map(({ slug }) => slug)).toEqual([
        'roguelike',
        'psychological-horror',
        'visual-novel',
      ]);
      const offered = new Set([
        ...genres.map(({ slug }) => `genre:${slug}`),
        ...themes.map(({ slug }) => `theme:${slug}`),
      ]);
      const sameIdea = new Map(
        readTagVocabulary().tags.map((tag) => [tagSlug(tag), tag.sameIdeaAs] as const),
      );
      for (const { slug } of tags) expect(offered.has(sameIdea.get(slug) ?? '')).toBe(false);
    });

    it('grava etiquetas junto dos gêneros e temas', async () => {
      await catalog.game({ name: 'Dead Cells', tags: ['Roguelike', 'Metroidvania'] });

      const response = await as(jogadora).put('/api/me/preferences', {
        themes: ['horror'],
        tags: ['roguelike', 'metroidvania'],
      });

      expect(response.status).toBe(200);
      expect(PreferencesSchema.parse(response.body)).toEqual({
        genres: [],
        themes: [{ slug: 'horror', name: 'Terror' }],
        tags: [
          { slug: 'metroidvania', name: 'Metroidvania' },
          { slug: 'roguelike', name: 'Roguelike' },
        ],
      });
      expect((await me(jogadora)).onboardingCompletedAt).not.toBeNull();
    });
  });

  describe('jogos da partida a frio', () => {
    const onboardingGames = async (cookie: string) => {
      const response = await as(cookie).get('/api/me/onboarding/games');
      expect(response.status).toBe(200);
      return OnboardingGamesSchema.parse(response.body).items.map(({ slug }) => slug);
    };

    it('sem preferências gravadas, responde 409', async () => {
      const response = await as(jogadora).get('/api/me/onboarding/games');

      expect(response.status).toBe(409);
      expect(errorMessage(response.body)).toBe(
        'Escolha seus gostos antes: os jogos para avaliar vêm deles.',
      );
    });

    it('os mais populares de cada preferência, em rodadas, só lançados e fora da biblioteca', async () => {
      await catalog.game({ name: 'Puzzle Um', genres: ['Puzzle'], popularity: 0.9 });
      await catalog.game({ name: 'Puzzle Dois', genres: ['Puzzle'], popularity: 0.8 });
      await catalog.game({ name: 'Puzzle Tres', genres: ['Puzzle'], popularity: 0.7 });
      await catalog.game({
        name: 'Rogue Um',
        genres: ['Puzzle'],
        tags: ['Roguelike'],
        popularity: 0.6,
      });
      await catalog.game({ name: 'Terror Um', themes: ['Horror'], popularity: 0.5 });
      await catalog.game({ name: 'Terror Dois', themes: ['Horror'], popularity: 0.4 });
      await catalog.game({
        name: 'Puzzle Em Breve',
        genres: ['Puzzle'],
        status: 'UPCOMING',
        popularity: 1,
      });
      await catalog.game({
        name: 'Puzzle Fora',
        genres: ['Puzzle'],
        inCatalog: false,
        popularity: 0.95,
      });
      await as(jogadora).put('/api/me/preferences', {
        genres: ['puzzle'],
        themes: ['horror'],
        tags: ['roguelike'],
      });
      await as(jogadora).put('/api/me/ratings/puzzle-dois', { score: 4 });
      await as(jogadora).put('/api/me/lists/want-to-play/terror-dois');
      await as(outra).put('/api/me/preferences', {
        genres: ['puzzle'],
        themes: ['horror'],
        tags: ['roguelike'],
      });

      const expected = [
        'puzzle-um',
        'rogue-um',
        'terror-um',
        'puzzle-tres',
        'celeste',
        'baba-is-you',
        'recem-lancado',
      ];
      expect(await onboardingGames(jogadora)).toEqual(expected);
      expect(await onboardingGames(jogadora)).toEqual(expected);
      expect(await onboardingGames(outra)).toEqual([
        'puzzle-um',
        'rogue-um',
        'terror-um',
        'puzzle-dois',
        'terror-dois',
        'puzzle-tres',
        'celeste',
        'baba-is-you',
        'recem-lancado',
      ]);
    });
  });

  describe('PATCH /api/me', () => {
    it('troca o modo de descoberta do próprio usuário', async () => {
      const response = await as(jogadora).patch('/api/me', { discoveryMode: 'DISCOVERY' });

      expect(response.status).toBe(200);
      expect(UserSchema.parse(response.body).discoveryMode).toBe('DISCOVERY');
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash/);
      expect((await me(jogadora)).discoveryMode).toBe('DISCOVERY');
      expect((await me(outra)).discoveryMode).toBe('BALANCED');
    });

    it('recusa modo desconhecido', async () => {
      const response = await as(jogadora).patch('/api/me', { discoveryMode: 'balanced' });

      expect(response.status).toBe(400);
      expect(errorMessage(response.body)).toEqual([
        'discoveryMode: Modo deve ser POPULAR, BALANCED ou DISCOVERY.',
      ]);
    });
  });
});
