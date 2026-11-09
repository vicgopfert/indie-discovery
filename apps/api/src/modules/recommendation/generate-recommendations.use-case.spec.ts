import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DiscoveryMode, ListType } from '../../generated/prisma/client';
import type { CatalogRepository } from '../catalog/catalog.repository';
import { CatalogService } from '../catalog/catalog.service';
import { FeatureLabels, featureLabelsConfigSchema } from '../catalog/feature-labels';
import type { ContentIndex } from './content-index';
import type { ContentIndexService } from './content-index.service';
import {
  GenerateRecommendationsUseCase,
  INDEX_UNAVAILABLE,
  LIST_NOT_FOUND,
} from './generate-recommendations.use-case';
import type {
  RecommendationRepository,
  RecommendedGameRow,
  UnindexedGame,
  UserState,
} from './recommendation.repository';
import { recommend } from './scoring/recommend';
import type { ScoringConfig } from './scoring/scoring-config';
import {
  featureId,
  featuresOf,
  gameId,
  gameOf,
  SHELF_LIBRARY,
  scoringConfig,
  scoringIndex,
  shelfIndex,
  TAGGED_LIBRARY,
  taggedGameOf,
  taggedIndex,
  TASTE_LIBRARY,
  tasteIndex,
} from './scoring/scoring.fixture';

const labels = new FeatureLabels(
  featureLabelsConfigSchema.parse({
    labelsRationale: 'motivo',
    labels: {
      GENRE: { platform: 'Plataforma', puzzle: 'Quebra-cabeça' },
      THEME: { fantasy: 'Fantasia', horror: 'Terror', action: 'Ação' },
    },
    hiddenFromFilters: { GENRE: ['indie'], THEME: [] },
    hiddenRationale: 'motivo',
  }),
);

const slugOf = (id: string) => id.replace(/^g-/, '');

// O banco: o estado do usuário e os jogos, com os atributos de cada um.
class FakeRepository implements Pick<RecommendationRepository, 'findUserState' | 'findGames'> {
  state: Omit<UserState, 'unindexedGames'> = {
    ratings: [],
    listEntries: [],
    preferenceFeatureIds: [],
  };
  outOfCatalog = new Set<string>();
  // O que o banco guarda dos jogos que saíram do índice; sem entrada, os do catálogo de pontuação.
  unindexedSources = new Map<string, UnindexedGame>();

  findUserState(_userId: string, isIndexed: (gameId: string) => boolean): Promise<UserState> {
    const gameIds = [...this.state.ratings, ...this.state.listEntries].map(({ gameId }) => gameId);
    const unindexed = gameIds.filter((id) => !isIndexed(id));
    return Promise.resolve({
      ...this.state,
      unindexedGames: new Map(
        unindexed.map((id) => [
          id,
          this.unindexedSources.get(id) ?? { slug: slugOf(id), features: featuresOf(slugOf(id)) },
        ]),
      ),
    });
  }

  findGames(ids: string[]): Promise<RecommendedGameRow[]> {
    return Promise.resolve(
      ids.map((id) => ({
        id,
        slug: slugOf(id),
        name: slugOf(id),
        coverImageId: `cover-${slugOf(id)}`,
        releaseStatus: 'RELEASED',
        firstReleaseDate: null,
        features: [],
        inCatalog: !this.outOfCatalog.has(slugOf(id)),
      })),
    );
  }
}

describe('GenerateRecommendationsUseCase', () => {
  let repository: FakeRepository;

  beforeEach(() => {
    repository = new FakeRepository();
  });

  const useCase = (index: ContentIndex | null = scoringIndex(), config = scoringConfig) =>
    new GenerateRecommendationsUseCase(
      { index } as ContentIndexService,
      repository as unknown as RecommendationRepository,
      new CatalogService({} as CatalogRepository, labels, 20),
      labels,
      config,
    );

  const withLists = (lists: Partial<ScoringConfig['lists']>): ScoringConfig => ({
    ...scoringConfig,
    lists: { ...scoringConfig.lists, ...lists },
  });

  const execute = (
    index?: ContentIndex | null,
    mode: DiscoveryMode = DiscoveryMode.BALANCED,
    config?: ScoringConfig,
  ) => useCase(index, config).overview('u-1', mode);

  const pageOf = (key: string, page = 1, index?: ContentIndex, config?: ScoringConfig) =>
    useCase(index, config).page('u-1', DiscoveryMode.BALANCED, key, page);

  const rate = (slug: string, score: number, ratedAt = 0) =>
    repository.state.ratings.push({ gameId: gameId(slug), score, ratedAt });
  const list = (slug: string, listType: ListType, addedAt = 0) =>
    repository.state.listEntries.push({ gameId: gameId(slug), listType, addedAt });

  const slugs = (result: Awaited<ReturnType<typeof execute>>) =>
    result.main.items.map(({ game }) => game.slug);

  it('com o índice carregando ou com falha, responde 503 em vez de lista vazia', async () => {
    rate('dead-cells', 5);

    await expect(execute(null)).rejects.toThrow(new ServiceUnavailableException(INDEX_UNAVAILABLE));
  });

  it('sem avaliações, listas nem preferências gravadas, indica a partida a frio', async () => {
    expect(await execute(undefined, DiscoveryMode.DISCOVERY)).toEqual({
      mode: 'DISCOVERY',
      basis: 'empty',
      main: { items: [], hasMore: false },
      shelves: [],
    });
  });

  it('sem perfil, o "ver mais" só tem a lista principal, vazia', async () => {
    expect(await pageOf('main')).toEqual({
      mode: 'BALANCED',
      basis: 'empty',
      key: 'main',
      feature: null,
      game: null,
      page: 1,
      items: [],
      hasMore: false,
    });
    await expect(pageOf('upcoming')).rejects.toThrow(new NotFoundException(LIST_NOT_FOUND));
  });

  it('com preferências que saíram do índice, recorre aos populares em vez da partida a frio', async () => {
    repository.state.preferenceFeatureIds.push('f-saiu-do-indice');

    const result = await execute();

    expect(result.basis).toBe('popular');
    expect(result.main.items.length).toBeGreaterThan(0);
    expect(result.shelves).toEqual([]);
    await expect(pageOf('upcoming')).rejects.toThrow(new NotFoundException(LIST_NOT_FOUND));
    const page = await pageOf('main');
    expect(page.basis).toBe('popular');
    expect(page.items.slice(0, result.main.items.length)).toEqual(result.main.items);
  });

  it('acha as preferências pelo id do atributo e explica com o nome em português', async () => {
    repository.state.preferenceFeatureIds.push(featureId('horror'), 'f-saiu-do-indice');

    const result = await execute();

    expect(result.basis).toBe('profile');
    expect(result.main.items[0]).toMatchObject({
      game: { slug: 'horror-only' },
      reason: { kind: 'features', features: [{ slug: 'horror', name: 'Terror' }] },
    });
  });

  it('traz os motivos na ordem da contribuição, não do nome', async () => {
    rate('dead-cells', 5);

    const hades = (await execute()).main.items.find(({ game }) => game.slug === 'hades');

    expect(hades?.reason).toEqual({
      kind: 'features',
      features: [
        { slug: 'roguelike', name: 'Roguelike' },
        { slug: 'fantasy', name: 'Fantasia' },
      ],
    });
  });

  it('junta a nota e as listas do mesmo jogo numa interação só', async () => {
    const index = scoringIndex();
    rate('celeste', 4);
    list('celeste', ListType.FAVORITE);
    list('hades', ListType.WANT_TO_PLAY);

    const result = await execute(index);
    const expected = recommend(
      index,
      {
        userId: 'u-1',
        mode: DiscoveryMode.BALANCED,
        interactions: [
          {
            gameId: gameId('celeste'),
            slug: 'celeste',
            score: 4,
            lists: [ListType.FAVORITE],
            vector: gameOf(index, 'celeste'),
            likedAt: 0,
          },
          {
            gameId: gameId('hades'),
            slug: 'hades',
            score: null,
            lists: [ListType.WANT_TO_PLAY],
            vector: gameOf(index, 'hades'),
            likedAt: null,
          },
        ],
        preferencePositions: [],
        hiddenPositions: new Set(),
      },
      scoringConfig,
    );

    expect(slugs(result)).toEqual(
      expected.lists[0]!.games.slice(0, scoringConfig.lists.overviewMainSize).map((g) => g.slug),
    );
  });

  it('jogo da biblioteca fora do índice entra no perfil com o vetor que teria no índice', async () => {
    rate('dead-cells', 5);
    rate('horror-only', 1);

    const inIndex = await execute(scoringIndex());
    const outOfIndex = await execute(scoringIndex({ without: ['dead-cells', 'horror-only'] }));

    expect(outOfIndex).toEqual(inIndex);
  });

  it('o jogo da biblioteca que saiu do catálogo ainda explica pelas etiquetas dele', async () => {
    rate('celeste', 5);
    repository.outOfCatalog.add('celeste');

    const result = await execute(scoringIndex({ without: ['celeste'] }));
    const climbOnly = result.main.items.find(({ game }) => game.slug === 'climb-only');

    expect(climbOnly?.reason).toEqual({
      kind: 'features',
      features: [{ slug: 'rock-climbing', name: 'Escalada' }],
    });
  });

  it('deixa de fora o jogo que saiu do catálogo depois da última carga do índice', async () => {
    rate('dead-cells', 5);
    const before = slugs(await execute());
    repository.outOfCatalog.add('spelunky');

    const after = slugs(await execute());

    expect(before).toContain('spelunky');
    expect(after).toEqual(before.filter((slug) => slug !== 'spelunky'));
  });

  it('usa o modo pedido e só marca "pouco conhecido" no modo Descobertas', async () => {
    rate('dead-cells', 5);
    const firstOf = async (mode: DiscoveryMode) => {
      const result = await execute(undefined, mode, withLists({ overviewMainSize: 1 }));
      return [result.mode, result.main.items[0]?.game.slug, result.main.items[0]?.lowKnown];
    };

    expect(await firstOf(DiscoveryMode.DISCOVERY)).toEqual(['DISCOVERY', 'obscure-rogue', true]);
    expect(await firstOf(DiscoveryMode.BALANCED)).toEqual(['BALANCED', 'spelunky', false]);
  });

  // Sem as prateleiras por jogo, que no catálogo pequeno levariam os jogos de terror antes.
  describe('com um gosto dominante e um secundário', () => {
    const index = tasteIndex();
    const small = withLists({
      overviewMainSize: 6,
      overviewShelfSize: 3,
      shelfMinItems: 1,
      likedGameShelves: 0,
    });
    const horror = { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' };
    const horrorGames = ['saga-fright', 'fright-a', 'fright-b', 'fright-c', 'fright-soon'];

    beforeEach(() => {
      for (const slug of TASTE_LIBRARY) rate(slug, 5);
    });

    it('monta as prateleiras na ordem da página, com o atributo em português', async () => {
      const { shelves } = await execute(index, DiscoveryMode.BALANCED, small);

      expect(shelves.map(({ key, kind, feature }) => [key, kind, feature])).toEqual([
        [
          'theme:action',
          'interest',
          { type: 'THEME', slug: 'action', name: 'Ação', title: 'Ação' },
        ],
        ['theme:horror', 'interest', horror],
        ['upcoming', 'upcoming', null],
      ]);
    });

    it('a lista principal traz o terror logo no começo, e a visão geral não repete jogos', async () => {
      const result = await execute(index, DiscoveryMode.BALANCED, small);
      const shown = [result.main, ...result.shelves].flatMap(({ items }) =>
        items.map(({ game }) => game.slug),
      );

      // Cotas de 75% e 25%: o terror entra na 3ª posição (e na 7ª, fora da visão geral).
      const isHorror = slugs(result).map((slug) => horrorGames.includes(slug));
      expect(isHorror).toEqual([false, false, true, false, false, false]);
      expect(new Set(shown).size).toBe(shown.length);
    });

    it('o "ver mais" de uma prateleira traz a lista completa, com repetição', async () => {
      const { main } = await execute(index, DiscoveryMode.BALANCED, small);
      const page = await pageOf('theme:horror', 1, index, small);
      const horrorInMain = main.items
        .map(({ game }) => game.slug)
        .filter((slug) => horrorGames.includes(slug));

      expect(page).toMatchObject({ key: 'theme:horror', feature: horror, page: 1, hasMore: false });
      expect(horrorInMain.length).toBeGreaterThan(0);
      expect(page.items.map(({ game }) => game.slug)).toEqual(expect.arrayContaining(horrorInMain));
    });

    it('responde 404 para a chave que não é uma lista atual do perfil', async () => {
      for (const key of ['genre:shooter', 'theme:nada', 'horror', 'genre:indie', 'GENRE:rpg']) {
        await expect(pageOf(key, 1, index)).rejects.toThrow(new NotFoundException(LIST_NOT_FOUND));
      }
    });
  });

  describe('prateleiras por jogo', () => {
    const index = shelfIndex();
    const small = withLists({ shelfMinItems: 1 });

    beforeEach(() => {
      for (const slug of SHELF_LIBRARY) rate(slug, 5);
    });

    it('vêm depois da principal, com o jogo de origem, sem repetir os jogos da página', async () => {
      const { main, shelves } = await execute(index, DiscoveryMode.BALANCED, small);
      const shown = [main, ...shelves].flatMap(({ items }) => items.map(({ game }) => game.slug));

      expect(shelves.slice(0, 2)).toMatchObject([
        {
          key: 'game:amnesia',
          kind: 'liked-game',
          feature: null,
          game: { slug: 'amnesia', name: 'amnesia', inCatalog: true },
        },
        { key: 'game:celeste', kind: 'liked-game', game: { slug: 'celeste' } },
      ]);
      expect(new Set(shown).size).toBe(shown.length);
    });

    it('o "ver mais" traz o jogo de origem, mesmo fora do catálogo', async () => {
      repository.outOfCatalog.add('celeste');
      const page = await pageOf('game:celeste', 1, index, small);

      expect(page).toMatchObject({
        key: 'game:celeste',
        feature: null,
        game: { slug: 'celeste', name: 'celeste', inCatalog: false },
      });
      expect(page.items.length).toBeGreaterThan(0);
    });

    it('responde 404 para o jogo que não gera prateleira', async () => {
      await expect(pageOf('game:hollow', 1, index, small)).rejects.toThrow(
        new NotFoundException(LIST_NOT_FOUND),
      );
    });

    it('as prateleiras de etiqueta trazem o título do vocabulário ou, sem ele, o nome', async () => {
      const featureOf = async (key: string) => (await pageOf(key, 1, index, small)).feature;

      expect(await featureOf('tag:difficult')).toMatchObject({
        name: 'Impiedoso',
        title: 'jogos difíceis',
      });
      expect(await featureOf('tag:roguelike')).toMatchObject({ title: 'roguelikes e roguelites' });
      expect(await featureOf('tag:platformer')).toMatchObject({ title: 'Plataforma' });
      expect(await featureOf('genre:rpg')).toMatchObject({ name: 'RPG', title: 'RPG' });
    });
  });

  describe('com etiquetas', () => {
    const tag = {
      type: 'TAG',
      slug: 'survival-horror',
      name: 'Terror de Sobrevivência',
      title: 'Terror de Sobrevivência',
    };

    beforeEach(() => {
      for (const slug of TAGGED_LIBRARY) rate(slug, 5);
    });

    it('a prateleira da etiqueta traz o nome gravado do vocabulário, e o "ver mais" também', async () => {
      const page = await pageOf('tag:survival-horror', 1, taggedIndex());

      expect(page).toMatchObject({ key: 'tag:survival-horror', feature: tag });
      expect(page.items.map(({ game }) => game.slug).sort()).toEqual(['scare-a', 'scare-b']);
    });

    it('o jogo da biblioteca fora do catálogo conta com as etiquetas gravadas', async () => {
      // Sem as etiquetas de scare-2, a etiqueta cobriria só scare-1 e perderia para Terror, que
      // também está em scare-2.
      repository.unindexedSources.set(gameId('scare-2'), {
        slug: 'scare-2',
        ...taggedGameOf('scare-2'),
      });
      const index = taggedIndex({ without: ['scare-2'] });

      expect((await pageOf('tag:survival-horror', 1, index)).feature).toEqual(tag);
      repository.unindexedSources.set(gameId('scare-2'), {
        slug: 'scare-2',
        features: taggedGameOf('scare-2').features.filter(({ type }) => type !== 'TAG'),
      });
      await expect(pageOf('tag:survival-horror', 1, index)).rejects.toThrow(
        new NotFoundException(LIST_NOT_FOUND),
      );
    });
  });
});
