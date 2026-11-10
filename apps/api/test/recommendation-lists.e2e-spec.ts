import {
  ApiErrorSchema,
  type Recommendation,
  type RecommendationOverview,
  RecommendationOverviewSchema,
  type RecommendationPage,
  RecommendationPageSchema,
  RECOMMENDATIONS_PAGE_MAX,
  UserSchema,
} from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { ContentIndexService } from '../src/modules/recommendation/content-index.service';
import {
  LIST_NOT_FOUND,
  SCORING_CONFIG,
} from '../src/modules/recommendation/generate-recommendations.use-case';
import {
  type ListsConfig,
  readScoringConfig,
  type ScoringConfig,
} from '../src/modules/recommendation/scoring/scoring-config';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CatalogBuilder } from './support/catalog-builder';
import {
  INTEREST_KEYS,
  LIKED_GAME_KEYS,
  seedRecommendationCatalog,
  writeLibrary,
} from './support/recommendation-catalog';
import { createApp, sessionHelpers } from './support/recommendation-app';

const MODES = ['popular', 'balanced', 'discovery'] as const;
type Mode = (typeof MODES)[number];

const slugsOf = (items: readonly Recommendation[]) => items.map(({ game }) => game.slug);

function isSubsequence(part: readonly string[], whole: readonly string[]) {
  let i = 0;
  for (const slug of whole) if (slug === part[i]) i++;
  return i === part.length;
}

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

  it('cada modo gera uma lista principal diferente, e só o Descobertas marca "pouco conhecido"', async () => {
    const mains = new Map<Mode, string[]>();
    for (const mode of MODES) {
      const shown = await client.overview(jogadora.cookie, mode);
      const items = [shown.main, ...shown.shelves].flatMap((list) => list.items);
      expect(items.some(({ lowKnown }) => lowKnown)).toBe(mode === 'discovery');
      mains.set(mode, (await client.allPages(jogadora.cookie, 'main', mode)).slugs);
    }

    expect(mains.get('popular')).not.toEqual(mains.get('balanced'));
    expect(mains.get('popular')).not.toEqual(mains.get('discovery'));
    expect(mains.get('balanced')).not.toEqual(mains.get('discovery'));
  });

  describe('visão geral', () => {
    it.each(MODES)(
      '(%s) traz cada espécie de lista na ordem da página, sem repetir jogos, nos tamanhos da configuração',
      async (mode) => {
        const { main, shelves } = await client.overview(jogadora.cookie, mode);

        expect(shelves.map(({ key, kind }) => [key, kind])).toEqual([
          ...LIKED_GAME_KEYS.map((key) => [key, 'liked-game']),
          ...INTEREST_KEYS.map((key) => [key, 'interest']),
          ['upcoming', 'upcoming'],
        ]);
        expect(main.items).toHaveLength(lists.overviewMainSize);
        for (const { items } of shelves) {
          expect(items.length).toBeGreaterThanOrEqual(lists.shelfMinItems);
          expect(items.length).toBeLessThanOrEqual(lists.overviewShelfSize);
        }
        const shown = [main, ...shelves].flatMap(({ items }) => slugsOf(items));
        expect(new Set(shown).size).toBe(shown.length);
      },
    );

    it.each(MODES)(
      '(%s) o que mostra de cada lista está no "ver mais" dela, na mesma ordem, e hasMore diz se há mais',
      async (mode) => {
        const { main, shelves } = await client.overview(jogadora.cookie, mode);

        const fullMain = (await client.allPages(jogadora.cookie, 'main', mode)).slugs;
        expect(fullMain.slice(0, main.items.length)).toEqual(slugsOf(main.items));
        expect(main.hasMore).toBe(fullMain.length > main.items.length);
        for (const { key, items, hasMore } of shelves) {
          const full = (await client.allPages(jogadora.cookie, key, mode)).slugs;
          expect(isSubsequence(slugsOf(items), full)).toBe(true);
          expect(hasMore).toBe(full.length > items.length);
        }
      },
    );

    it('o "ver mais" da prateleira por jogo responde 404 depois que a nota cai abaixo do mínimo', async () => {
      const detetive = LIKED_GAME_KEYS[1]!;
      const { shelves } = await client.overview(jogadora.cookie, 'balanced');
      expect(shelves.map(({ key }) => key)).toContain(detetive);

      await client.helpers
        .as(jogadora.cookie)
        .put('/api/me/ratings/origem-detetive', { score: lists.likedGameMinScore - 1 });

      const response = await client.helpers
        .as(jogadora.cookie)
        .get(`/api/recommendations/lists/${detetive}`);
      expect(response.status).toBe(404);
      expect(ApiErrorSchema.parse(response.body).message).toBe(LIST_NOT_FOUND);
    });
  });
});

// Os tetos reais (100 e 200) pediriam mais de 200 candidatos numa prateleira; com tetos pequenos,
// o teste afirma números exatos e prova que a rota respeita os que a configuração disser.
describe('Paginação do "ver mais" com tetos reduzidos (B-36)', () => {
  const caps = { pageSize: 3, mainCap: 6, shelfCap: 9 };
  let app: INestApplication<App>;
  let client: ReturnType<typeof recommendationClient>;
  let cookie: string;

  beforeAll(async () => {
    const config = readScoringConfig();
    const lists = { ...config.lists, ...caps };
    app = await createApp((builder) =>
      builder.overrideProvider(SCORING_CONFIG).useValue({ ...config, lists }),
    );
    const prisma = app.get(PrismaService);
    client = recommendationClient(app, lists);
    await seedRecommendationCatalog(prisma);
    await app.get(ContentIndexService).reload();
    const jogadora = await client.player('jogadora@example.com');
    await writeLibrary(prisma, jogadora.userId);
    cookie = jogadora.cookie;
  });

  afterAll(() => app.close());

  // O catálogo tem mais candidatos que os dois tetos: 28 nas prateleiras de interesse e 12 em
  // Quebra-cabeça.
  it.each([
    ['main', caps.mainCap],
    ['genre:puzzle', caps.shelfCap],
  ])('a lista %s para no teto de %i, de página em página, sem repetir jogos', async (key, cap) => {
    const { pages, slugs } = await client.allPages(cookie, key, 'balanced');

    expect(pages.map(({ page, items, hasMore }) => [page, items.length, hasMore])).toEqual(
      Array.from({ length: cap / caps.pageSize }, (_, i) => [
        i + 1,
        caps.pageSize,
        i + 1 < cap / caps.pageSize,
      ]),
    );
    expect(new Set(slugs).size).toBe(cap);
    const beyond = await client.page(cookie, key, 'balanced', pages.length + 1);
    expect(beyond).toMatchObject({ items: [], hasMore: false });
  });

  it('nenhuma lista da visão geral passa do teto dela', async () => {
    for (const mode of MODES) {
      const { shelves } = await client.overview(cookie, mode);
      expect((await client.allPages(cookie, 'main', mode)).slugs.length).toBeLessThanOrEqual(
        caps.mainCap,
      );
      for (const { key } of shelves) {
        expect((await client.allPages(cookie, key, mode)).slugs.length).toBeLessThanOrEqual(
          caps.shelfCap,
        );
      }
    }
  });

  it('recusa a página além do máximo da rota', async () => {
    const response = await client.helpers
      .as(cookie)
      .get(`/api/recommendations/lists/main?page=${RECOMMENDATIONS_PAGE_MAX + 1}`);

    expect(response.status).toBe(400);
  });
});
