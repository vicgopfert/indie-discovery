import {
  type Recommendation,
  type RecommendationOverview,
  RecommendationOverviewSchema,
  type RecommendationPage,
  RecommendationPageSchema,
  UserSchema,
} from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { ContentIndexService } from '../src/modules/recommendation/content-index.service';
import { SCORING_CONFIG } from '../src/modules/recommendation/generate-recommendations.use-case';
import {
  type ListsConfig,
  type ScoringConfig,
} from '../src/modules/recommendation/scoring/scoring-config';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CatalogBuilder } from './support/catalog-builder';
import {
  LIKED_GAME_KEYS,
  seedRecommendationCatalog,
  writeLibrary,
} from './support/recommendation-catalog';
import { createApp, sessionHelpers } from './support/recommendation-app';

const MODES = ['popular', 'balanced', 'discovery'] as const;
type Mode = (typeof MODES)[number];

const slugsOf = (items: readonly Recommendation[]) => items.map(({ game }) => game.slug);

function recommendationClient(app: INestApplication<App>, lists: ListsConfig) {
  const helpers = sessionHelpers(app);
  const maxPages = Math.ceil(Math.max(lists.mainCap, lists.shelfCap) / lists.pageSize) + 1;

  const player = async (email: string) => {
    const cookie = await helpers.register(email);
    const me = UserSchema.parse((await helpers.as(cookie).get('/api/auth/me')).body);
    return { cookie, userId: me.id };
  };
  const overview = async (cookie: string, mode: Mode): Promise<RecommendationOverview> => {
    const response = await helpers.as(cookie).get(`/api/recommendations?mode=${mode}`);
    expect(response.status).toBe(200);
    return RecommendationOverviewSchema.parse(response.body);
  };
  const page = async (
    cookie: string,
    key: string,
    mode: Mode,
    n: number,
  ): Promise<RecommendationPage> => {
    const response = await helpers
      .as(cookie)
      .get(`/api/recommendations/lists/${key}?mode=${mode}&page=${n}`);
    expect(response.status).toBe(200);
    return RecommendationPageSchema.parse(response.body);
  };
  // Todas as páginas do "ver mais", até a que diz que não há mais.
  const allPages = async (cookie: string, key: string, mode: Mode) => {
    const pages: RecommendationPage[] = [];
    do {
      pages.push(await page(cookie, key, mode, pages.length + 1));
    } while (pages.at(-1)!.hasMore && pages.length < maxPages);
    expect(pages.at(-1)!.hasMore).toBe(false);
    return { pages, slugs: pages.flatMap(({ items }) => slugsOf(items)) };
  };
  // Nos três modos, a visão geral e cada página de cada lista que ela mostra.
  const snapshot = async (cookie: string) => {
    const result: Record<string, unknown> = {};
    for (const mode of MODES) {
      const shown = await overview(cookie, mode);
      const keys = ['main', ...shown.shelves.map(({ key }) => key)];
      const lists: Record<string, RecommendationPage[]> = {};
      for (const key of keys) lists[key] = (await allPages(cookie, key, mode)).pages;
      result[mode] = { overview: shown, lists };
    }
    return result;
  };

  return { helpers, player, overview, page, allPages, snapshot };
}

describe('Listas de recomendação de ponta a ponta (B-36)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let lists: ListsConfig;
  let client: ReturnType<typeof recommendationClient>;
  let catalog: CatalogBuilder;
  let jogadora: { cookie: string; userId: string };

  const reload = () => app.get(ContentIndexService).reload();

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    lists = app.get<ScoringConfig>(SCORING_CONFIG).lists;
    client = recommendationClient(app, lists);
    catalog = await seedRecommendationCatalog(prisma);
    await reload();
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "User" CASCADE`;
    jogadora = await client.player('jogadora@example.com');
    await writeLibrary(prisma, jogadora.userId);
  });

  afterAll(() => app.close());

  describe('o mesmo estado gera as mesmas listas: a principal, cada prateleira e cada página', () => {
    it('em duas leituras seguidas, a primeira sem a semelhança guardada e a segunda com ela', async () => {
      await reload();
      const first = await client.snapshot(jogadora.cookie);

      expect(await client.snapshot(jogadora.cookie)).toEqual(first);
    });

    it('depois de recarregar o índice', async () => {
      const before = await client.snapshot(jogadora.cookie);

      await reload();

      expect(await client.snapshot(jogadora.cookie)).toEqual(before);
    });

    it('com a biblioteca gravada de novo em outra ordem: o banco não garante a ordem das linhas', async () => {
      const before = await client.snapshot(jogadora.cookie);

      await writeLibrary(prisma, jogadora.userId, { reverse: true });

      expect(await client.snapshot(jogadora.cookie)).toEqual(before);
    });

    it('com a semelhança guardada por outra usuária com o mesmo jogo de origem', async () => {
      const outra = await client.player('outra@example.com');
      await writeLibrary(prisma, outra.userId);
      await reload();
      for (const mode of MODES) await client.overview(jogadora.cookie, mode);
      const shared = await client.snapshot(outra.cookie);

      await reload();

      expect(await client.snapshot(outra.cookie)).toEqual(shared);
    });
  });

  it('avaliar um jogo muda a lista seguinte, e tirar a nota devolve as mesmas listas', async () => {
    const before = await client.snapshot(jogadora.cookie);
    const { main } = await client.overview(jogadora.cookie, 'balanced');
    const rated = main.items[0]!.game.slug;

    await client.helpers.as(jogadora.cookie).put(`/api/me/ratings/${rated}`, { score: 5 });

    const after = await client.overview(jogadora.cookie, 'balanced');
    expect(slugsOf(after.main.items)).not.toEqual(slugsOf(main.items));
    for (const key of ['main', ...after.shelves.map((shelf) => shelf.key)]) {
      expect((await client.allPages(jogadora.cookie, key, 'balanced')).slugs).not.toContain(rated);
    }

    await client.helpers.as(jogadora.cookie).delete(`/api/me/ratings/${rated}`);

    expect(await client.snapshot(jogadora.cookie)).toEqual(before);
  });

  it('com um jogo novo no catálogo, a recarga refaz a semelhança do jogo de origem', async () => {
    const fazenda = LIKED_GAME_KEYS[0]!;
    expect((await client.allPages(jogadora.cookie, fazenda, 'balanced')).slugs).not.toContain(
      'fazenda-nova',
    );
    await catalog.game({
      name: 'Fazenda Nova',
      genres: ['Simulator'],
      tags: ['Farming Sim', 'Cozy'],
      popularity: 0.5,
    });
    try {
      await reload();

      // A prateleira são os candidatos com algum atributo da Origem Fazenda: só a família dela.
      // O conjunto exato pega a semelhança velha em qualquer posição que o jogo novo ocupe.
      const { slugs } = await client.allPages(jogadora.cookie, fazenda, 'balanced');
      expect([...slugs].sort()).toEqual([
        'fazenda-1',
        'fazenda-2',
        'fazenda-3',
        'fazenda-4',
        'fazenda-5',
        'fazenda-6',
        'fazenda-nova',
      ]);
    } finally {
      await prisma.game.delete({ where: { slug: 'fazenda-nova' } });
      await reload();
    }
  });
});
