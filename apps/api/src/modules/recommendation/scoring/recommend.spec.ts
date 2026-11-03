import { DiscoveryMode, ListType } from '../../../generated/prisma/client';
import { recommend, type RecommendationInput } from './recommend';
import { featurePosition, rated, scoringConfig, scoringIndex } from './scoring.fixture';

describe('recommend', () => {
  const index = scoringIndex();

  const input = (overrides: Partial<RecommendationInput>): RecommendationInput => ({
    userId: 'u-1',
    mode: DiscoveryMode.BALANCED,
    limit: 10,
    interactions: [],
    preferencePositions: [],
    ...overrides,
  });
  const slugs = (result: ReturnType<typeof recommend>) => result.items.map(({ game }) => game.slug);

  it('sem avaliações, listas nem preferências, não recomenda e indica a partida a frio', () => {
    expect(recommend(index, input({}), scoringConfig)).toEqual({ basis: 'empty', items: [] });
  });

  it('recomenda pelo perfil, com motivo em cada item', () => {
    const result = recommend(
      index,
      input({ interactions: [rated(index, 'dead-cells', 5)] }),
      scoringConfig,
    );

    expect(result.basis).toBe('profile');
    expect(slugs(result)[0]).toBe('spelunky');
    expect(result.items.every(({ reason }) => reason !== null)).toBe(true);
  });

  it('só com preferências declaradas, já recomenda', () => {
    const result = recommend(
      index,
      input({ preferencePositions: [featurePosition(index, 'horror')] }),
      scoringConfig,
    );

    expect(result.basis).toBe('profile');
    expect(slugs(result)[0]).toBe('horror-only');
  });

  it('deixa de fora todo jogo avaliado ou em lista, mesmo neutro ou sem vetor', () => {
    const result = recommend(
      index,
      input({
        interactions: [
          rated(index, 'dead-cells', 5),
          rated(index, 'spelunky', 3),
          rated(index, 'hades', null, [ListType.WANT_TO_PLAY]),
          { gameId: 'g-popular-rogue', score: 4, lists: [], vector: null },
        ],
      }),
      scoringConfig,
    );

    expect(result.items.length).toBeGreaterThan(0);
    for (const slug of ['dead-cells', 'spelunky', 'hades', 'popular-rogue']) {
      expect(slugs(result)).not.toContain(slug);
    }
  });

  it('com o perfil sem componente positiva, recorre aos populares dos preferidos', () => {
    const result = recommend(
      index,
      input({
        mode: DiscoveryMode.DISCOVERY,
        interactions: [rated(index, 'hades', 1)],
        preferencePositions: [featurePosition(index, 'fantasy')],
      }),
      scoringConfig,
    );

    expect(result.basis).toBe('popular');
    expect(slugs(result)).toEqual(['popular-rogue', 'dead-cells', 'obscure-rogue']);
    expect(result.items.some(({ lowKnown }) => lowKnown)).toBe(false);
  });

  it('o mesmo estado gera sempre a mesma lista', () => {
    const state = input({
      mode: DiscoveryMode.DISCOVERY,
      interactions: [rated(index, 'celeste', 5), rated(index, 'hades', 2)],
      preferencePositions: [featurePosition(index, 'puzzle')],
    });

    expect(recommend(scoringIndex(), state, scoringConfig)).toEqual(
      recommend(index, state, scoringConfig),
    );
  });
});
