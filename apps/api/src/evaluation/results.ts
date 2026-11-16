import { DiscoveryMode } from '../generated/prisma/client';
import type { ScoringConfig } from '../modules/recommendation/scoring/scoring-config';
import type { TfidfConfig } from '../modules/recommendation/tfidf';
import type { EvaluationConfig } from './evaluation-config';
import {
  type BootstrapConfig,
  type Difference,
  hitCounts,
  hitRate,
  type ListMetrics,
  listMetrics,
  lowKnownRate,
  overlap,
  pairedBootstrap,
} from './metrics';
import type { Family, Sampling } from './profiles';
import { METHODS, type Method, MODES, type ProfileOutcome } from './run';

export const ALL = 'all';

export interface GroupKey {
  family: Family;
  sampling: Sampling | null;
  // O tipo do atributo (família A) ou o tipo de perfil (semente 71); ALL junta os do grupo.
  stratum: string;
}

export interface MethodResult {
  method: Method;
  // Pelo corte.
  hit: Record<number, number | null>;
  // No maior corte.
  list: ListMetrics;
  lowKnown: number | null;
}

export interface GroupResult extends GroupKey {
  profiles: number;
  holdouts: number;
  methods: MethodResult[];
  overlap: { balancedDiscovery: number | null; popularBalanced: number | null };
}

export interface ComparisonResult extends GroupKey {
  label: string;
  a: Method;
  b: Method;
  // Pelo corte.
  difference: Record<number, Difference | null>;
}

// Os grupos de cada família e amostragem: o conjunto todo e, quando há, cada estrato.
export function groupOutcomes(
  outcomes: readonly ProfileOutcome[],
): { key: GroupKey; outcomes: ProfileOutcome[] }[] {
  const groups = new Map<string, { key: GroupKey; outcomes: ProfileOutcome[] }>();
  const add = (key: GroupKey, outcome: ProfileOutcome) => {
    const id = `${key.family}|${key.sampling}|${key.stratum}`;
    let group = groups.get(id);
    if (group === undefined) groups.set(id, (group = { key, outcomes: [] }));
    group.outcomes.push(outcome);
  };
  for (const outcome of outcomes) {
    const { family, sampling, stratum } = outcome.profile;
    add({ family, sampling, stratum: ALL }, outcome);
    if (stratum !== null) add({ family, sampling, stratum }, outcome);
  }
  return [...groups.values()];
}

export function summarize(
  outcomes: readonly ProfileOutcome[],
  { cutoffs }: Pick<EvaluationConfig, 'cutoffs'>,
  catalogSize: number,
): GroupResult[] {
  const depth = Math.max(...cutoffs);
  const methods = METHODS.filter((method) => outcomes[0]?.lists.has(method));
  const overlapOf = (group: readonly ProfileOutcome[], a: Method, b: Method) =>
    methods.includes(a) && methods.includes(b) ? overlap(group, a, b, depth) : null;
  return groupOutcomes(outcomes).map(({ key, outcomes: group }) => ({
    ...key,
    profiles: group.length,
    holdouts: group.reduce((sum, { profile }) => sum + profile.holdouts.length, 0),
    methods: methods.map((method) => ({
      method,
      hit: Object.fromEntries(cutoffs.map((k) => [k, hitRate(hitCounts(group, method, k))])),
      list: listMetrics(group, method, depth, catalogSize),
      lowKnown: lowKnownRate(group, method),
    })),
    overlap: {
      balancedDiscovery: overlapOf(
        group,
        `${DiscoveryMode.BALANCED}/interleaved`,
        `${DiscoveryMode.DISCOVERY}/interleaved`,
      ),
      popularBalanced: overlapOf(
        group,
        `${DiscoveryMode.POPULAR}/interleaved`,
        `${DiscoveryMode.BALANCED}/interleaved`,
      ),
    },
  }));
}

// Na mesma configuração: a lista intercalada contra a lista única e contra as duas linhas de base,
// em cada modo, nos grupos com jogos escondidos.
export function baselineComparisons(
  outcomes: readonly ProfileOutcome[],
  { cutoffs }: Pick<EvaluationConfig, 'cutoffs'>,
  bootstrap: BootstrapConfig,
): ComparisonResult[] {
  const pairs = MODES.flatMap((mode) =>
    (['single', 'random', 'popular'] as const).map((other) => ({
      a: `${mode}/interleaved` as Method,
      b: other === 'single' ? (`${mode}/single` as Method) : other,
      label: other,
    })),
  );
  return withHoldouts(outcomes).flatMap(({ key, outcomes: group }) =>
    pairs.map(({ a, b, label }) => ({
      ...key,
      label,
      a,
      b,
      difference: Object.fromEntries(
        cutoffs.map((k) => [
          k,
          pairedBootstrap(hitCounts(group, a, k), hitCounts(group, b, k), bootstrap),
        ]),
      ),
    })),
  );
}

function withHoldouts(outcomes: readonly ProfileOutcome[]) {
  return groupOutcomes(outcomes).filter(({ outcomes: group }) =>
    group.some(({ profile }) => profile.holdouts.length > 0),
  );
}

export const groupId = ({ family, sampling, stratum }: GroupKey) =>
  `${family}|${sampling}|${stratum}`;

export type VariantGroup = 'shelfLimit' | 'blockShares' | 'lambda' | 'preferenceWeight';

export const VARIANT_GROUPS: readonly VariantGroup[] = [
  'shelfLimit',
  'blockShares',
  'lambda',
  'preferenceWeight',
];

export interface Variant {
  name: string;
  tfidf: TfidfConfig;
  scoring: ScoringConfig;
  // O único modo cujas listas mudam (o λ); null quando mudam todos.
  mode: DiscoveryMode | null;
}

// As variantes da rodada 2 (decisão 6 do plano): cada uma muda um valor da configuração atual.
export function variantsOf(
  group: VariantGroup,
  { variants }: EvaluationConfig,
  tfidf: TfidfConfig,
  scoring: ScoringConfig,
): Variant[] {
  const withScoring = (
    name: string,
    change: Partial<ScoringConfig>,
    mode: DiscoveryMode | null = null,
  ): Variant => ({ name, tfidf, scoring: { ...scoring, ...change }, mode });
  switch (group) {
    case 'shelfLimit':
      return variants.shelfLimit
        .filter((limit) => limit !== scoring.lists.specificMaxDocumentRatio)
        .map((limit) =>
          withScoring(`limite ${limit}`, {
            lists: { ...scoring.lists, specificMaxDocumentRatio: limit },
          }),
        );
    case 'blockShares':
      return [
        ...variants.blockShares
          .filter(
            (shares) => !sameShares(shares, tfidf.blockShares) || tfidf.normalization !== 'block',
          )
          .map((blockShares) => ({
            name: `fatias ${blockShares.GENRE}/${blockShares.THEME}/${blockShares.TAG}`,
            tfidf: { ...tfidf, normalization: 'block' as const, blockShares },
            scoring,
            mode: null,
          })),
        ...(tfidf.normalization === 'global'
          ? []
          : [
              {
                name: 'normalização global',
                tfidf: { ...tfidf, normalization: 'global' as const },
                scoring,
                mode: null,
              },
            ]),
      ];
    case 'lambda':
      return [
        ...variants.discoveryLambda.map((lambda) => [DiscoveryMode.DISCOVERY, lambda] as const),
        ...variants.popularLambda.map((lambda) => [DiscoveryMode.POPULAR, lambda] as const),
      ]
        .filter(([mode, lambda]) => scoring.popularityWeightByMode[mode] !== lambda)
        .map(([mode, lambda]) =>
          withScoring(
            `λ ${mode} ${lambda}`,
            { popularityWeightByMode: { ...scoring.popularityWeightByMode, [mode]: lambda } },
            mode,
          ),
        );
    case 'preferenceWeight':
      return variants.preferenceWeight
        .filter((weight) => weight !== scoring.preferenceWeight)
        .map((weight) => withScoring(`β ${weight}`, { preferenceWeight: weight }));
  }
}

function sameShares(a: TfidfConfig['blockShares'], b: TfidfConfig['blockShares']) {
  return a.GENRE === b.GENRE && a.THEME === b.THEME && a.TAG === b.TAG;
}
