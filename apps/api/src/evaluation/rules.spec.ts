import { DiscoveryMode, ReleaseStatus } from '../generated/prisma/client';
import type { IndexedGame } from '../modules/recommendation/content-index';
import type { CriteriaResult } from './criteria';
import { readEvaluationConfig } from './evaluation-config';
import type { EvaluationProfile } from './profiles';
import { ALL } from './results';
import {
  blockSharesChecks,
  blockSharesRule,
  candidate,
  lambdaChecks,
  lambdaPairChecks,
  lambdaPairRule,
  type PairCandidate,
  preferenceWeightChecks,
  preferenceWeightRule,
  shelfLimitRule,
  upcomingRecords,
} from './rules';
import { listOf, type Method, type ProfileOutcome } from './run';

const evaluation = readEvaluationConfig();
const bootstrap = { seed: 1, resamples: 200, confidence: 0.95 };
const POPULAR = listOf(DiscoveryMode.POPULAR);
const BALANCED = listOf(DiscoveryMode.BALANCED);
const DISCOVERY = listOf(DiscoveryMode.DISCOVERY);

const game = (id: string, popularityNorm: number, upcoming = false): IndexedGame => ({
  id,
  slug: id,
  releaseStatus: upcoming ? ReleaseStatus.UPCOMING : ReleaseStatus.RELEASED,
  popularityNorm,
  featurePositions: Int32Array.from([0]),
  weights: Float64Array.from([1]),
});

const games = (prefix: string, popularityNorm: number, upcoming = false) =>
  Array.from({ length: 10 }, (_, i) => game(`${prefix}-${i}`, popularityNorm, upcoming));

interface ListSpec {
  games: IndexedGame[];
  rank?: number;
  lowKnown?: number;
}

function outcome(
  profile: Partial<EvaluationProfile>,
  lists: Partial<Record<Method, ListSpec>>,
): ProfileOutcome {
  const holdouts = profile.holdouts ?? ['h'];
  const entries = Object.entries(lists) as [Method, ListSpec][];
  return {
    profile: {
      id: 'p',
      family: 'attribute',
      sampling: 'uniform',
      stratum: 'GENRE',
      ratings: [],
      preferencePositions: [],
      ...profile,
      holdouts,
    },
    interests: [0],
    genresAndThemes: [],
    lists: new Map(
      entries.map(([method, { games: list, lowKnown }]) => [
        method,
        { games: list, lowKnown: lowKnown ?? null },
      ]),
    ),
    ranks: new Map(entries.map(([method, { rank }]) => [method, holdouts.map(() => rank ?? -1)])),
  };
}

// As 8 combinações da regra b, com dois perfis cada.
function sharesOutcomes(rank: number): ProfileOutcome[] {
  const keys: Partial<EvaluationProfile>[] = (['uniform', 'popularity'] as const).flatMap(
    (sampling) => [
      ...(['GENRE', 'THEME', 'TAG'] as const).map((stratum) => ({ sampling, stratum })),
      { family: 'coherent' as const, sampling, stratum: null },
    ],
  );
  return keys.flatMap((key) =>
    [0, 1].map((i) =>
      outcome({ ...key, id: `${i}` }, { [BALANCED]: { games: games('b', 0.5), rank } }),
    ),
  );
}

describe('regra b, fatias e normalização', () => {
  it('a variante igual à atual não passa: a diferença de acerto não fica acima de zero', () => {
    const checks = blockSharesChecks(sharesOutcomes(0), sharesOutcomes(0), evaluation, bootstrap);

    expect(checks).toHaveLength(16);
    expect(
      checks.every(({ group }) => group!.stratum !== ALL || group!.family === 'coherent'),
    ).toBe(true);
    const hits = checks.filter(({ condition }) => condition.startsWith('acerto'));
    expect(hits.every(({ interval, passes }) => interval!.value === 0 && !passes)).toBe(true);
    const coverage = checks.filter(({ condition }) => condition.startsWith('interesses'));
    expect(coverage.every(({ passes }) => passes)).toBe(true);
  });

  it('a variante que acerta mais em todas as combinações passa, e a regra a escolhe', () => {
    const checks = blockSharesChecks(sharesOutcomes(-1), sharesOutcomes(0), evaluation, bootstrap);
    const better = candidate('fatias 30/30/40', null, checks);
    const equal = candidate(
      'fatias 34/33/33',
      null,
      blockSharesChecks(sharesOutcomes(-1), sharesOutcomes(-1), evaluation, bootstrap),
    );

    expect(better.passes).toBe(true);
    expect(blockSharesRule('fatias 40/30/30', [equal, better]).chosen).toBe('fatias 30/30/40');
    expect(blockSharesRule('fatias 40/30/30', [equal]).chosen).toBe('fatias 40/30/30');
  });
});

describe('regra c, λ', () => {
  const profiles = (discovery: ListSpec) =>
    [0, 1, 2].map((i) =>
      outcome(
        { id: `${i}` },
        {
          [POPULAR]: { games: games('p', 0.9), rank: 0 },
          [BALANCED]: { games: games('e', 0.5), rank: 0 },
          [DISCOVERY]: { ...discovery, games: games(`d${i}`, 0.1) },
        },
      ),
    );

  it('confere ARP, "pouco conhecido", razão de acerto e cobertura só no agregado', () => {
    const checks = lambdaChecks(
      profiles({ games: [], rank: 0, lowKnown: 5 }),
      DiscoveryMode.DISCOVERY,
      evaluation,
      bootstrap,
      100,
    );

    expect(checks.map(({ group }) => group!.stratum)).toEqual([ALL, ALL, ALL, ALL]);
    expect(checks.map(({ interval }) => interval!.value)).toEqual([
      expect.closeTo(0.4, 10),
      1,
      0.5,
      expect.closeTo(0.2, 10),
    ]);
    expect(checks.every(({ passes }) => passes)).toBe(true);
  });

  it('falha quando o Descobertas marca demais ou acerta pouco', () => {
    const [, ratio, lowKnown] = lambdaChecks(
      profiles({ games: [], rank: -1, lowKnown: 8 }),
      DiscoveryMode.DISCOVERY,
      evaluation,
      bootstrap,
      100,
    );

    expect(ratio!.passes).toBe(false);
    expect(lowKnown!.passes).toBe(false);
  });

  it('o Populares confere só a diferença de ARP e a razão de acerto', () => {
    const checks = lambdaChecks(
      profiles({ games: [], rank: 0, lowKnown: 5 }),
      DiscoveryMode.POPULAR,
      evaluation,
      bootstrap,
      100,
    );

    expect(checks.map(({ condition }) => condition)).toEqual([
      'ARP do Populares − Equilibrado',
      'acerto@20 do Populares ÷ o do Equilibrado',
    ]);
  });

  it('no par, confere as condições dos dois modos com as listas do par', () => {
    const checks = lambdaPairChecks(
      profiles({ games: [], rank: 0, lowKnown: 5 }),
      evaluation,
      bootstrap,
      100,
    );

    expect(checks.map(({ condition }) => condition)).toEqual([
      'ARP do Equilibrado − Descobertas',
      'acerto@20 do Descobertas ÷ o do Equilibrado',
      '"pouco conhecido"@20',
      'cobertura do catálogo@20, Descobertas − Populares',
      'ARP do Populares − Equilibrado',
      'acerto@20 do Populares ÷ o do Equilibrado',
    ]);
  });

  const pairOf = (
    discovery: number,
    popular: number,
    checks: PairCandidate['checks'] = [],
    passes?: boolean,
  ): PairCandidate => ({
    ...candidate(`${discovery}; ${popular}`, null, checks),
    ...(passes === undefined ? {} : { passes }),
    pair: { discovery, popular },
  });

  it('escolhe o par com o maior |λ| do Descobertas e, no empate, do Populares', () => {
    const candidates = [
      pairOf(0.1, -0.3, [], true),
      pairOf(0.2, -0.05, [], true),
      pairOf(0.2, -0.1, [], true),
      pairOf(0.3, -0.2, [], false),
    ];

    expect(lambdaPairRule('0.3; -0.2', candidates).chosen).toBe('0.2; -0.1');
  });

  describe('reserva, quando nenhum par passa', () => {
    // Três condições: a primeira o atual cumpre pelo intervalo, a segunda só pelo ponto medido, a
    // terceira não cumpre.
    const conditions = ['arp', 'razão', 'cobertura'];
    const check = (condition: string, interval: { value: number; low: number; high: number }) => ({
      group: null,
      condition,
      unit: 'ratio' as const,
      interval,
      threshold: 0.7,
      side: 'atLeast' as const,
      passes: interval.low >= 0.7,
    });
    const withValues = (
      discovery: number,
      popular: number,
      intervals: [number, number, number][],
    ) =>
      pairOf(
        discovery,
        popular,
        intervals.map(([point, low, high], i) =>
          check(conditions[i]!, { value: point, low, high }),
        ),
      );
    const current = withValues(0.3, -0.2, [
      [0.9, 0.8, 1],
      [0.75, 0.6, 0.9],
      [0.4, 0.3, 0.5],
    ]);

    it('adota o par que cumpre tudo o que o atual cumpre e falha em menos condições', () => {
      const fewer = withValues(0.1, -0.1, [
        [0.9, 0.8, 1],
        [0.72, 0.65, 0.8],
        [0.8, 0.75, 0.9],
      ]);
      // Falha em menos condições, mas perde a primeira, que o atual cumpre pelo intervalo.
      const losesInterval = withValues(0.2, -0.05, [
        [0.8, 0.6, 1],
        [0.9, 0.8, 1],
        [0.9, 0.8, 1],
      ]);
      // Perde a segunda, que o atual cumpre pelo ponto medido.
      const losesPoint = withValues(0.15, -0.3, [
        [0.9, 0.8, 1],
        [0.65, 0.6, 0.7],
        [0.9, 0.8, 1],
      ]);
      const rule = lambdaPairRule('0.3; -0.2', [fewer, losesInterval, losesPoint, current]);

      expect(rule.chosen).toBe('0.1; -0.1');
      expect(rule.note).toContain('falha em menos condições (1 contra 2)');
      expect(
        Object.fromEntries(rule.candidates.map(({ name, eligible }) => [name, eligible])),
      ).toEqual({ '0.1; -0.1': true, '0.2; -0.05': false, '0.15; -0.3': false, '0.3; -0.2': true });
    });

    it('no empate, o maior |λ| do Descobertas e depois do Populares; sem outro, fica o atual', () => {
      const tie = (discovery: number, popular: number) =>
        withValues(discovery, popular, [
          [0.9, 0.8, 1],
          [0.75, 0.65, 0.8],
          [0.9, 0.8, 1],
        ]);
      expect(
        lambdaPairRule('0.3; -0.2', [tie(0.05, -0.3), tie(0.1, -0.05), tie(0.1, -0.1), current])
          .chosen,
      ).toBe('0.1; -0.1');

      const worse = withValues(0.05, -0.05, [
        [0.5, 0.4, 0.6],
        [0.9, 0.8, 1],
        [0.9, 0.8, 1],
      ]);
      expect(lambdaPairRule('0.3; -0.2', [worse, current]).chosen).toBe('0.3; -0.2');
    });
  });
});

describe('regra d, β', () => {
  const coldStart = (rank: number) =>
    [0, 1].map((i) =>
      outcome(
        {
          id: `${i}`,
          family: 'cold-start',
          sampling: null,
          stratum: null,
          preferencePositions: [0],
        },
        { [BALANCED]: { games: games('c', 0.5), rank } },
      ),
    );

  it('troca só pelo β com cobertura das preferências e acerto maior', () => {
    const current = candidate(
      'β = 1',
      1,
      preferenceWeightChecks(coldStart(-1), null, evaluation, bootstrap),
    );
    const better = candidate(
      'β = 2',
      2,
      preferenceWeightChecks(coldStart(-1), coldStart(0), evaluation, bootstrap),
    );
    const equal = candidate(
      'β = 0,5',
      0.5,
      preferenceWeightChecks(coldStart(-1), coldStart(-1), evaluation, bootstrap),
    );

    expect(current.checks.map(({ interval }) => interval!.value)).toEqual([1]);
    expect(preferenceWeightRule(current, [equal, better]).chosen).toBe('β = 2');
    expect(preferenceWeightRule(current, [equal]).chosen).toBe('β = 1');
  });
});

describe('regra a, limite das prateleiras', () => {
  const criteria = (c1Revised: boolean): CriteriaResult => ({
    regression: { games: [], shelves: [] },
    c1Original: true,
    c1Revised,
    c2: true,
    realistic: [],
    c3: true,
    c4: { passing: 10, total: 10 },
    c5: { main: 1, second: 0.9, none: 0 },
    c5Passes: { main: true, second: true, none: true },
    repeatedIdeas: 0,
    specificity: { shelves: 0, median: null, aboveTenPercent: null },
  });

  it('adota o menor limite que passa; se nenhum, fica o atual', () => {
    const rule = shelfLimitRule('limite de 10%', [
      { name: 'limite de 20%', value: 0.2, criteria: criteria(true) },
      { name: 'limite de 10%', value: 0.1, criteria: criteria(false) },
      { name: 'limite de 15%', value: 0.15, criteria: criteria(true) },
    ]);

    expect(rule.chosen).toBe('limite de 15%');
    expect(rule.candidates.map(({ value }) => value)).toEqual([0.1, 0.15, 0.2]);
    expect(
      shelfLimitRule('limite de 10%', [
        { name: 'limite de 10%', value: 0.1, criteria: criteria(false) },
      ]).chosen,
    ).toBe('limite de 10%');
  });
});

describe('"em breve"', () => {
  it('domina o modo em que passa de 50% do top-20', () => {
    const records = upcomingRecords(
      [
        outcome(
          {},
          {
            [BALANCED]: { games: games('e', 0.5) },
            [DISCOVERY]: { games: games('d', 0.1, true) },
          },
        ),
      ],
      evaluation,
      100,
    );

    expect(records.map(({ mode, share, dominates }) => [mode, share, dominates])).toEqual([
      [DiscoveryMode.BALANCED, 0, false],
      [DiscoveryMode.DISCOVERY, 1, true],
    ]);
  });
});
