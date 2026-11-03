import { ServiceUnavailableException } from '@nestjs/common';
import { DiscoveryMode, ListType } from '../../generated/prisma/client';
import type { CatalogRepository } from '../catalog/catalog.repository';
import { CatalogService } from '../catalog/catalog.service';
import { FeatureLabels, featureLabelsConfigSchema } from '../catalog/feature-labels';
import type { ContentIndex } from './content-index';
import type { ContentIndexService } from './content-index.service';
import {
  GenerateRecommendationsUseCase,
  INDEX_UNAVAILABLE,
} from './generate-recommendations.use-case';
import type {
  RecommendationRepository,
  RecommendedGameRow,
  UserState,
} from './recommendation.repository';
import { recommend } from './scoring/recommend';
import {
  featureId,
  featuresOf,
  gameId,
  gameOf,
  scoringConfig,
  scoringIndex,
} from './scoring/scoring.fixture';

const labels = new FeatureLabels(
  featureLabelsConfigSchema.parse({
    labelsRationale: 'motivo',
    labels: {
      GENRE: { platform: 'Plataforma', puzzle: 'Quebra-cabeça' },
      THEME: { fantasy: 'Fantasia', horror: 'Terror' },
    },
    hiddenFromFilters: { GENRE: [], THEME: [] },
    hiddenRationale: 'motivo',
  }),
);

const slugOf = (id: string) => id.replace(/^g-/, '');

// O banco: o estado do usuário e os jogos, com os atributos de cada um.
class FakeRepository implements Pick<RecommendationRepository, 'findUserState' | 'findGames'> {
  state: Omit<UserState, 'unindexedFeatures'> = {
    ratings: [],
    listEntries: [],
    preferenceFeatureIds: [],
  };
  outOfCatalog = new Set<string>();

  findUserState(_userId: string, isIndexed: (gameId: string) => boolean): Promise<UserState> {
    const gameIds = [...this.state.ratings, ...this.state.listEntries].map(({ gameId }) => gameId);
    const unindexed = gameIds.filter((id) => !isIndexed(id));
    return Promise.resolve({
      ...this.state,
      unindexedFeatures: new Map(unindexed.map((id) => [id, featuresOf(slugOf(id))])),
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

  const useCase = (index: ContentIndex | null = scoringIndex()) =>
    new GenerateRecommendationsUseCase(
      { index } as ContentIndexService,
      repository as unknown as RecommendationRepository,
      new CatalogService({} as CatalogRepository, labels, 20),
      labels,
      scoringConfig,
    );

  const execute = (
    index?: ContentIndex | null,
    mode: DiscoveryMode = DiscoveryMode.BALANCED,
    limit = 10,
  ) => useCase(index).execute('u-1', mode, limit);

  const rate = (slug: string, score: number) =>
    repository.state.ratings.push({ gameId: gameId(slug), score });

  const slugs = (result: Awaited<ReturnType<typeof execute>>) =>
    result.items.map(({ game }) => game.slug);

  it('com o índice carregando ou com falha, responde 503 em vez de lista vazia', async () => {
    rate('dead-cells', 5);

    await expect(execute(null)).rejects.toThrow(new ServiceUnavailableException(INDEX_UNAVAILABLE));
  });

  it('sem avaliações, listas nem preferências gravadas, indica a partida a frio', async () => {
    expect(await execute(undefined, DiscoveryMode.DISCOVERY)).toEqual({
      mode: 'DISCOVERY',
      basis: 'empty',
      items: [],
    });
  });

  it('com preferências que saíram do índice, recorre aos populares em vez da partida a frio', async () => {
    repository.state.preferenceFeatureIds.push('f-saiu-do-indice');

    const result = await execute();

    expect(result.basis).toBe('popular');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('acha as preferências pelo id do atributo e explica com o nome em português', async () => {
    repository.state.preferenceFeatureIds.push(featureId('horror'), 'f-saiu-do-indice');

    const result = await execute();

    expect(result.basis).toBe('profile');
    expect(result.items[0]).toMatchObject({
      game: { slug: 'horror-only' },
      reason: { kind: 'features', features: [{ slug: 'horror', name: 'Terror' }] },
    });
  });

  it('traz os motivos na ordem da contribuição, não do nome', async () => {
    rate('dead-cells', 5);

    const hades = (await execute()).items.find(({ game }) => game.slug === 'hades');

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
    repository.state.listEntries.push({ gameId: gameId('celeste'), listType: ListType.FAVORITE });
    repository.state.listEntries.push({ gameId: gameId('hades'), listType: ListType.WANT_TO_PLAY });

    const result = await execute(index);
    const expected = recommend(
      index,
      {
        userId: 'u-1',
        mode: DiscoveryMode.BALANCED,
        limit: 10,
        interactions: [
          {
            gameId: gameId('celeste'),
            score: 4,
            lists: [ListType.FAVORITE],
            vector: gameOf(index, 'celeste'),
          },
          {
            gameId: gameId('hades'),
            score: null,
            lists: [ListType.WANT_TO_PLAY],
            vector: gameOf(index, 'hades'),
          },
        ],
        preferencePositions: [],
      },
      scoringConfig,
    );

    expect(slugs(result)).toEqual(expected.items.map(({ game }) => game.slug));
  });

  it('jogo da biblioteca fora do índice entra no perfil com o vetor que teria no índice', async () => {
    rate('dead-cells', 5);
    rate('horror-only', 1);

    const inIndex = await execute(scoringIndex());
    const outOfIndex = await execute(scoringIndex({ without: ['dead-cells', 'horror-only'] }));

    expect(outOfIndex).toEqual(inIndex);
  });

  it('o motivo pode citar o jogo da biblioteca que saiu do catálogo, marcado', async () => {
    rate('celeste', 5);
    repository.outOfCatalog.add('celeste');

    const result = await execute(scoringIndex({ without: ['celeste'] }));
    const climbOnly = result.items.find(({ game }) => game.slug === 'climb-only');

    expect(climbOnly?.reason).toEqual({
      kind: 'liked-game',
      game: { slug: 'celeste', name: 'celeste', inCatalog: false },
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
      const result = await execute(undefined, mode, 1);
      return [result.mode, result.items[0]?.game.slug, result.items[0]?.lowKnown];
    };

    expect(await firstOf(DiscoveryMode.DISCOVERY)).toEqual(['DISCOVERY', 'obscure-rogue', true]);
    expect(await firstOf(DiscoveryMode.BALANCED)).toEqual(['BALANCED', 'spelunky', false]);
  });
});
