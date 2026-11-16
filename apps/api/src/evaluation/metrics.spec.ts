import { ReleaseStatus } from '../generated/prisma/client';
import type { IndexedGame } from '../modules/recommendation/content-index';
import {
  bootstrapInterval,
  hitCounts,
  hitRate,
  listMetrics,
  lowKnownRate,
  overlap,
  pairedBootstrap,
  sampledSum,
  subsampleInterval,
} from './metrics';
import type { EvaluationProfile } from './profiles';
import { METHODS, type Method, type ProfileOutcome, type Ranked } from './run';

const game = (
  id: string,
  popularityNorm: number,
  features: number[],
  releaseStatus: ReleaseStatus = ReleaseStatus.RELEASED,
): IndexedGame => ({
  id,
  slug: id,
  releaseStatus,
  popularityNorm,
  featurePositions: Int32Array.from(features),
  weights: Float64Array.from(features, () => 1),
});

const A = game('a', 0.8, [0, 1]);
const B = game('b', 0.4, [1]);
const C = game('c', 0.2, [2], ReleaseStatus.UPCOMING);
const D = game('d', 0.6, [3]);

const BALANCED: Method = 'BALANCED/interleaved';
const DISCOVERY: Method = 'DISCOVERY/interleaved';

function outcome(
  lists: Partial<Record<Method, Ranked>>,
  ranks: Partial<Record<Method, number[]>> = {},
  extra: { interests?: number[]; genresAndThemes?: number[]; preferences?: number[] } = {},
): ProfileOutcome {
  const profile: EvaluationProfile = {
    id: 'p',
    family: 'attribute',
    sampling: 'uniform',
    stratum: 'GENRE',
    ratings: [],
    preferencePositions: extra.preferences ?? [],
    holdouts: (ranks[BALANCED] ?? []).map((_, i) => `h-${i}`),
  };
  return {
    profile,
    interests: extra.interests ?? [],
    genresAndThemes: extra.genresAndThemes ?? [],
    lists: new Map(METHODS.map((m) => [m, lists[m] ?? { games: [], lowKnown: null }])),
    ranks: new Map(METHODS.map((m) => [m, ranks[m] ?? []])),
  };
}

describe('métricas da avaliação offline', () => {
  it('acerto: jogos escondidos dentro do corte sobre todos os escondidos, por perfil', () => {
    const outcomes = [
      outcome({}, { [BALANCED]: [0, 15, -1] }),
      outcome({}, { [BALANCED]: [9] }),
      outcome({}, {}),
    ];

    expect(hitCounts(outcomes, BALANCED, 10)).toEqual({ hits: [1, 1], holdouts: [3, 1] });
    expect(hitRate(hitCounts(outcomes, BALANCED, 10))).toBe(0.5);
    expect(hitRate(hitCounts(outcomes, BALANCED, 20))).toBe(0.75);
    expect(hitRate(hitCounts([outcome({})], BALANCED, 10))).toBeNull();
  });

  it('listas: cobertura do catálogo, ARP e fração de em breve', () => {
    const outcomes = [
      outcome({ [BALANCED]: { games: [A, B], lowKnown: null } }),
      outcome({ [BALANCED]: { games: [A, C], lowKnown: null } }),
    ];
    const metrics = listMetrics(outcomes, BALANCED, 20, 10);

    expect(metrics.catalogCoverage).toBe(0.3);
    expect(metrics.averagePopularity).toBeCloseTo((0.6 + 0.5) / 2, 12);
    expect(metrics.upcoming).toBe(0.25);
  });

  it('cobertura: média por perfil da fração dos atributos com algum jogo no corte', () => {
    const outcomes = [
      outcome(
        { [BALANCED]: { games: [A, D], lowKnown: null } },
        {},
        { interests: [0, 2], genresAndThemes: [1, 3], preferences: [3, 4, 5, 6] },
      ),
      outcome({ [BALANCED]: { games: [C], lowKnown: null } }, {}, { interests: [2] }),
    ];
    const metrics = listMetrics(outcomes, BALANCED, 20, 10);

    expect(metrics.interestCoverage).toBe(0.75);
    expect(metrics.genreThemeCoverage).toBe(1);
    expect(metrics.preferenceCoverage).toBe(0.25);
    expect(listMetrics(outcomes, BALANCED, 1, 10).genreThemeCoverage).toBe(0.5);
  });

  it('pouco conhecido: só nas listas com a marca, sobre os itens delas', () => {
    const outcomes = [
      outcome({ [DISCOVERY]: { games: [A, B, C, D], lowKnown: 3 } }),
      outcome({ [DISCOVERY]: { games: [A, B, C, D], lowKnown: 1 } }),
    ];

    expect(lowKnownRate(outcomes, DISCOVERY)).toBe(0.5);
    expect(lowKnownRate(outcomes, BALANCED)).toBeNull();
  });

  it('sobreposição: fração de jogos em comum entre as listas do mesmo perfil', () => {
    const outcomes = [
      outcome({
        [BALANCED]: { games: [A, B, C, D], lowKnown: null },
        [DISCOVERY]: { games: [B, D, A, C], lowKnown: 2 },
      }),
      outcome({
        [BALANCED]: { games: [A, B], lowKnown: null },
        [DISCOVERY]: { games: [C, D], lowKnown: 2 },
      }),
    ];

    expect(overlap(outcomes, BALANCED, DISCOVERY, 20)).toBe(0.5);
    expect(overlap(outcomes, BALANCED, DISCOVERY, 2)).toBe(0.25);
  });
});

describe('bootstrap pareado', () => {
  const config = { seed: 71, resamples: 500, confidence: 0.95 };

  it('configurações iguais dão diferença zero e intervalo [0; 0]', () => {
    const counts = { hits: [1, 0, 2, 1], holdouts: [4, 4, 4, 4] };

    expect(pairedBootstrap(counts, counts, config)).toEqual({ difference: 0, low: 0, high: 0 });
  });

  it('a melhor em todos os perfis tem o intervalo inteiro acima de zero', () => {
    const better = { hits: [2, 1, 3, 2, 1, 2], holdouts: [4, 4, 4, 4, 4, 4] };
    const worse = { hits: [1, 0, 1, 1, 0, 1], holdouts: [4, 4, 4, 4, 4, 4] };
    const result = pairedBootstrap(better, worse, config)!;

    expect(result.difference).toBeCloseTo(7 / 24, 12);
    expect(result.low).toBeGreaterThan(0);
    expect(result.high).toBeGreaterThanOrEqual(result.difference);
    expect(pairedBootstrap(better, worse, config)).toEqual(result);
  });

  it('diferença que muda de sinal entre perfis tem intervalo cruzando zero', () => {
    const a = { hits: [4, 0, 4, 0, 4, 0], holdouts: [4, 4, 4, 4, 4, 4] };
    const b = { hits: [0, 4, 0, 4, 0, 4], holdouts: [4, 4, 4, 4, 4, 4] };
    const result = pairedBootstrap(a, b, config)!;

    expect(result.difference).toBe(0);
    expect(result.low).toBeLessThan(0);
    expect(result.high).toBeGreaterThan(0);
  });

  it('sem perfis ou com conjuntos diferentes não há intervalo', () => {
    expect(pairedBootstrap({ hits: [], holdouts: [] }, { hits: [], holdouts: [] }, config)).toBe(
      null,
    );
    expect(
      pairedBootstrap({ hits: [1], holdouts: [2] }, { hits: [1, 1], holdouts: [2, 2] }, config),
    ).toBeNull();
  });
});

describe('bootstrap de uma estatística dos perfis', () => {
  const config = { seed: 7, resamples: 500, confidence: 0.95 };
  const mean = (values: readonly number[]) => (sample: Uint32Array) =>
    sampledSum(values, sample) / sample.length;

  it('estatística constante tem intervalo de um ponto só', () => {
    expect(bootstrapInterval(4, mean([2, 2, 2, 2]), config)).toEqual({ value: 2, low: 2, high: 2 });
  });

  it('o valor é o da amostra inteira, dentro do intervalo, e a semente repete o sorteio', () => {
    const values = [0, 1, 2, 3, 4, 5, 6, 7];
    const result = bootstrapInterval(values.length, mean(values), config)!;

    expect(result.value).toBe(3.5);
    expect(result.low).toBeLessThan(3.5);
    expect(result.high).toBeGreaterThan(3.5);
    expect(bootstrapInterval(values.length, mean(values), config)).toEqual(result);
  });

  it('sem perfis não há intervalo', () => {
    expect(bootstrapInterval(0, () => 1, config)).toBeNull();
  });
});

describe('subamostragem sem reposição', () => {
  const config = { seed: 7, resamples: 300, confidence: 0.95 };

  it('cada sorteio leva a fração pedida de perfis distintos', () => {
    const sizes = new Set<number>();
    subsampleInterval(
      10,
      0.5,
      (sample) => {
        expect(new Set(sample).size).toBe(sample.length);
        sizes.add(sample.length);
        return 0;
      },
      config,
    );

    expect([...sizes].sort((a, b) => a - b)).toEqual([5, 10]);
  });

  it('a contagem de distintos não é puxada para baixo como no sorteio com reposição', () => {
    // Cada perfil traz um item só dele: a amostra inteira tem 20 distintos.
    const distinct = (sample: Uint32Array) => new Set(sample).size / sample.length;
    const subsample = subsampleInterval(20, 0.5, distinct, config)!;
    const bootstrap = bootstrapInterval(20, distinct, config)!;

    expect(subsample).toEqual({ value: 1, low: 1, high: 1 });
    expect(bootstrap.high).toBeLessThan(1);
  });
});
