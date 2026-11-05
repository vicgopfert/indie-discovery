import { ListType } from '../../../generated/prisma/client';
import {
  buildProfile,
  hasPositiveComponent,
  interactionsOf,
  interactionWeight,
  profileDot,
} from './profile';
import {
  FEATURES,
  featurePosition,
  gameId,
  gameOf,
  rated,
  scoringConfig,
  scoringIndex,
} from './scoring.fixture';

const { FAVORITE, COMPLETED, WANT_TO_PLAY } = ListType;

describe('interactionWeight', () => {
  const weight = (score: number | null, lists: ListType[] = []) =>
    interactionWeight({ score, lists }, scoringConfig);

  it('centra a nota em 3: notas 1 e 2 afastam, 3 é neutra, 4 e 5 aproximam', () => {
    expect([1, 2, 3, 4, 5].map((score) => weight(score))).toEqual([-2, -1, 0, 1, 2]);
  });

  it('soma o bônus de cada lista, e o jogo sem nota fica só com os bônus', () => {
    expect(weight(null, [FAVORITE])).toBe(2);
    expect(weight(null, [WANT_TO_PLAY])).toBe(0.5);
    expect(weight(4, [FAVORITE, COMPLETED])).toBe(4);
    expect(weight(null, [FAVORITE, WANT_TO_PLAY])).toBe(2.5);
  });
});

describe('buildProfile', () => {
  const index = scoringIndex();
  const featureCount = index.features.length;

  it('soma os vetores dos jogos pelo peso de cada um', () => {
    const profile = buildProfile(
      [rated(index, 'hades', 5), rated(index, 'celeste', 2)],
      [],
      featureCount,
      scoringConfig,
    );

    const hades = gameOf(index, 'hades');
    const celeste = gameOf(index, 'celeste');
    for (let position = 0; position < featureCount; position++) {
      const weightIn = (game: typeof hades) => {
        const i = game.featurePositions.indexOf(position);
        return i < 0 ? 0 : game.weights[i]!;
      };
      expect(profile.vector[position]).toBeCloseTo(2 * weightIn(hades) - weightIn(celeste), 12);
    }
  });

  it('dá o mesmo vetor em qualquer ordem das interações, até o último bit', () => {
    // Nesta combinação, a soma em ponto flutuante muda com a ordem.
    const interactions = [
      rated(index, 'dead-cells', 5),
      rated(index, 'hades', 4),
      rated(index, 'popular-rogue', 2),
    ];
    const vectorOf = (order: number[]) =>
      buildProfile(
        order.map((i) => interactions[i]!),
        [],
        featureCount,
        scoringConfig,
      ).vector;
    const orders = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];

    for (const order of orders) expect(vectorOf(order)).toEqual(vectorOf([0, 1, 2]));
  });

  it('acrescenta β na posição de cada gênero ou tema preferido, uma vez só', () => {
    const horror = featurePosition(index, 'horror');
    const profile = buildProfile([], [horror, horror], featureCount, scoringConfig);

    expect(profile.vector[horror]).toBe(scoringConfig.preferenceWeight);
    expect(profile.norm).toBe(scoringConfig.preferenceWeight);
  });

  it('guarda para o motivo só os jogos que moveram o perfil', () => {
    const profile = buildProfile(
      [
        rated(index, 'hades', 5),
        rated(index, 'spelunky', 3),
        { gameId: 'g-fora-do-indice', score: 5, lists: [], vector: null, styles: [] },
      ],
      [],
      featureCount,
      scoringConfig,
    );

    expect(profile.games.map((g) => [g.gameId, g.weight])).toEqual([['g-hades', 2]]);
  });

  it('só tem componente positiva com algum jogo bem avaliado, em lista ou preferência', () => {
    const positive = (interactions: ReturnType<typeof rated>[], preferences: number[] = []) =>
      hasPositiveComponent(buildProfile(interactions, preferences, featureCount, scoringConfig));

    expect(positive([rated(index, 'hades', 1), rated(index, 'celeste', 2)])).toBe(false);
    expect(positive([rated(index, 'hades', 3)])).toBe(false);
    expect(positive([rated(index, 'hades', null, [WANT_TO_PLAY])])).toBe(true);
    expect(positive([], [featurePosition(index, 'horror')])).toBe(true);
  });

  it('dá cosseno 1 com o próprio jogo quando o perfil é um jogo só', () => {
    const profile = buildProfile([rated(index, 'hades', 5)], [], featureCount, scoringConfig);

    expect(profileDot(profile, gameOf(index, 'hades')) / profile.norm).toBeCloseTo(1, 12);
  });
});

describe('interactionsOf', () => {
  const index = scoringIndex({ without: ['celeste'] });

  it('junta a nota e as listas do mesmo jogo numa interação só', () => {
    const [hades, ...rest] = interactionsOf(index, {
      ratings: [{ gameId: gameId('hades'), score: 5 }],
      listEntries: [
        { gameId: gameId('hades'), listType: FAVORITE },
        { gameId: gameId('hades'), listType: COMPLETED },
      ],
      unindexedGames: new Map(),
    });

    expect(rest).toEqual([]);
    expect(hades).toMatchObject({
      gameId: gameId('hades'),
      score: 5,
      lists: [FAVORITE, COMPLETED],
    });
    expect(hades!.vector).toBe(gameOf(index, 'hades'));
  });

  it('monta o vetor do jogo fora do índice com os atributos gravados no banco', () => {
    const full = scoringIndex();
    const celeste = gameOf(full, 'celeste');
    const features = [...celeste.featurePositions].map((p) => {
      const { type, igdbId, slug } = FEATURES.find((f) => f.slug === full.features[p]!.slug)!;
      return { type, igdbId, slug };
    });
    const [interaction] = interactionsOf(index, {
      ratings: [{ gameId: gameId('celeste'), score: 4 }],
      listEntries: [],
      unindexedGames: new Map([[gameId('celeste'), { features, summary: '' }]]),
    });

    expect(interaction).toMatchObject({ gameId: gameId('celeste'), score: 4, lists: [] });
    expect([...interaction!.vector!.weights]).toEqual([...celeste.weights]);
  });
});
