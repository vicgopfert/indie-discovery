import { DiscoveryMode } from '../generated/prisma/client';
import type { CriteriaResult } from './criteria';
import type { EvaluationConfig } from './evaluation-config';
import {
  type BootstrapConfig,
  bootstrapInterval,
  coverageByProfile,
  hitCounts,
  type Interval,
  listMetrics,
  pairedBootstrap,
  sampledSum,
  subsampleInterval,
} from './metrics';
import { ALL, type GroupKey, groupId, groupOutcomes } from './results';
import { listOf, type Method, type ProfileOutcome } from './run';

// As regras da rodada 2 (docs/avaliacao-offline.md), com os limiares de `rules` em
// config/evaluation.json. Uma condição só conta como atingida se o intervalo de 95% inteiro
// estiver do lado dela.

export type Unit = 'points' | 'decimal' | 'ratio' | 'percent' | 'criterion';

// above: limite inferior > limiar; atLeast: ≥; atMost: limite superior ≤ limiar; notBelow: limite
// superior ≥ limiar, isto é, o intervalo não fica inteiro abaixo dele.
export type Side = 'above' | 'atLeast' | 'atMost' | 'notBelow';

export interface Check {
  group: GroupKey | null;
  condition: string;
  unit: Unit;
  interval: Interval | null;
  threshold: number | null;
  side: Side | null;
  passes: boolean;
}

export interface Candidate {
  name: string;
  value: number | null;
  checks: Check[];
  passes: boolean;
  criteria?: CriteriaResult | null;
  // Na reserva da regra c: cumpre toda condição que o atual cumpre.
  eligible?: boolean;
}

export interface RuleResult {
  rule: string;
  title: string;
  current: string;
  candidates: Candidate[];
  chosen: string;
  note: string;
}

type Rules = Pick<EvaluationConfig, 'rules' | 'cutoffs'>;

function check(
  group: GroupKey | null,
  condition: string,
  unit: Unit,
  interval: Interval | null,
  threshold: number,
  side: Side,
): Check {
  const passes =
    interval !== null &&
    {
      above: interval.low > threshold,
      atLeast: interval.low >= threshold,
      atMost: interval.high <= threshold,
      notBelow: interval.high >= threshold,
    }[side];
  return { group, condition, unit, interval, threshold, side, passes };
}

export function candidate(name: string, value: number | null, checks: Check[]): Candidate {
  return { name, value, checks, passes: checks.every(({ passes }) => passes) };
}

// Intervalo da média entre os perfis com valor.
function meanInterval(
  values: readonly (number | null)[],
  bootstrap: BootstrapConfig,
): Interval | null {
  const present = values.filter((value) => value !== null);
  return bootstrapInterval(
    present.length,
    (sample) => sampledSum(present, sample) / sample.length,
    bootstrap,
  );
}

// Intervalo da média, entre os perfis com os dois valores, de a menos b.
function pairedMean(
  a: readonly (number | null)[],
  b: readonly (number | null)[],
  bootstrap: BootstrapConfig,
): Interval | null {
  return meanInterval(
    a.map((value, i) => (value === null || b[i] === null ? null : value - b[i]!)),
    bootstrap,
  );
}

// Intervalo da soma de um valor sobre a soma de outro, nos perfis sorteados. Um sorteio com
// denominador zero conta como razão infinita se o numerador for positivo, e 1 se também for zero.
function ratioOfSums(
  numerators: readonly number[],
  denominators: readonly number[],
  bootstrap: BootstrapConfig,
): Interval | null {
  return bootstrapInterval(
    numerators.length,
    (sample) => {
      const numerator = sampledSum(numerators, sample);
      const denominator = sampledSum(denominators, sample);
      if (denominator > 0) return numerator / denominator;
      return numerator > 0 ? Infinity : 1;
    },
    bootstrap,
  );
}

// Por perfil, a popularidade média do top-k; null na lista vazia.
function popularityByProfile(outcomes: readonly ProfileOutcome[], method: Method, k: number) {
  return outcomes.map(({ lists }) => {
    const games = lists.get(method)!.games.slice(0, k);
    return games.length === 0
      ? null
      : games.reduce((total, { popularityNorm }) => total + popularityNorm, 0) / games.length;
  });
}

// Intervalo da cobertura do catálogo de a menos a de b, a fração do catálogo que aparece em algum
// top-k dos perfis, nas mesmas subamostras sem reposição.
function coverageDifference(
  outcomes: readonly ProfileOutcome[],
  a: Method,
  b: Method,
  k: number,
  catalogSize: number,
  fraction: number,
  bootstrap: BootstrapConfig,
): Interval | null {
  const ids = new Map<string, number>();
  const positionsOf = (method: Method) =>
    outcomes.map(({ lists }) =>
      Int32Array.from(lists.get(method)!.games.slice(0, k), ({ id }) => {
        let position = ids.get(id);
        if (position === undefined) ids.set(id, (position = ids.size));
        return position;
      }),
    );
  const first = positionsOf(a);
  const second = positionsOf(b);
  const seenFirst = new Uint32Array(ids.size);
  const seenSecond = new Uint32Array(ids.size);
  let round = 0;
  const distinct = (lists: readonly Int32Array[], seen: Uint32Array, sample: Uint32Array) => {
    let count = 0;
    for (const profile of sample) {
      for (const position of lists[profile]!) {
        if (seen[position] === round) continue;
        seen[position] = round;
        count++;
      }
    }
    return count;
  };
  return subsampleInterval(
    outcomes.length,
    fraction,
    (sample) => {
      round++;
      return (
        (distinct(first, seenFirst, sample) - distinct(second, seenSecond, sample)) / catalogSize
      );
    },
    bootstrap,
  );
}

function groupsWhere(
  outcomes: readonly ProfileOutcome[],
  keep: (key: GroupKey) => boolean,
): { key: GroupKey; outcomes: ProfileOutcome[] }[] {
  return groupOutcomes(outcomes).filter(({ key }) => keep(key));
}

// Regra b: gênero, tema e etiqueta da família A nas duas amostragens, mais a família B.
const isSharesGroup = ({ family, stratum }: GroupKey) =>
  (family === 'attribute' && stratum !== ALL) || family === 'coherent';

// Regra c: as famílias A e B nas duas amostragens, no agregado.
const isLambdaGroup = ({ family, stratum }: GroupKey) =>
  (family === 'attribute' || family === 'coherent') && stratum === ALL;

const criteriaChecks = (criteria: CriteriaResult): Check[] =>
  (
    [
      ['C1 revisado', criteria.c1Revised],
      ['C2, Amnesia', criteria.c2],
      ['C3, perfis realistas', criteria.c3],
      ['C4, preferências', criteria.c4.passing === criteria.c4.total],
      ['C5 (a)', criteria.c5Passes.main],
      ['C5 (b)', criteria.c5Passes.second],
      ['C5 (c)', criteria.c5Passes.none],
    ] as const
  ).map(([condition, passes]) => ({
    group: null,
    condition,
    unit: 'criterion',
    interval: null,
    threshold: null,
    side: null,
    passes,
  }));

// Regra a: o menor limite que passa no C1 revisado mantendo C2 a C5; se nenhum, o atual.
export function shelfLimitRule(
  current: string,
  limits: readonly { name: string; value: number; criteria: CriteriaResult }[],
): RuleResult {
  const candidates = [...limits]
    .sort((a, b) => a.value - b.value)
    .map(({ name, value, criteria }) => ({
      ...candidate(name, value, criteriaChecks(criteria)),
      criteria,
    }));
  const chosen = candidates.find(({ passes }) => passes);
  return {
    rule: 'a',
    title: 'Limite de frequência das prateleiras',
    current,
    candidates,
    chosen: chosen?.name ?? current,
    note:
      chosen === undefined
        ? 'Nenhum limite passa no C1 revisado mantendo C2 a C5: fica o atual, e o C1 continua como limitação.'
        : `O menor limite que passa no C1 revisado mantendo C2 a C5 é ${chosen.name}.`,
  };
}

export function blockSharesChecks(
  current: readonly ProfileOutcome[],
  variant: readonly ProfileOutcome[],
  { rules, cutoffs }: Rules,
  bootstrap: BootstrapConfig,
): Check[] {
  const { mode, cutoff, minDifference } = rules.blockShares;
  const method = listOf(mode);
  const depth = Math.max(...cutoffs);
  const before = new Map(
    groupsWhere(current, isSharesGroup).map(({ key, outcomes }) => [groupId(key), outcomes]),
  );
  const coverage = (outcomes: readonly ProfileOutcome[]) =>
    coverageByProfile(
      outcomes,
      outcomes.map(({ lists }) => lists.get(method)!.games.slice(0, depth)),
      ({ interests }) => interests,
    );
  return groupsWhere(variant, isSharesGroup).flatMap(({ key, outcomes }) => {
    const base = before.get(groupId(key))!;
    const hit = pairedBootstrap(
      hitCounts(outcomes, method, cutoff),
      hitCounts(base, method, cutoff),
      bootstrap,
    );
    return [
      check(
        key,
        `acerto@${cutoff}, diferença`,
        'points',
        hit && { value: hit.difference, low: hit.low, high: hit.high },
        minDifference,
        'above',
      ),
      check(
        key,
        `interesses@${depth}, diferença`,
        'points',
        pairedMean(coverage(outcomes), coverage(base), bootstrap),
        0,
        'notBelow',
      ),
    ];
  });
}

// Regra b: troca só se alguma variante passar em todas as combinações; havendo mais de uma, a de
// maior melhora no pior caso (a menor diferença de acerto entre as combinações).
export function blockSharesRule(current: string, variants: readonly Candidate[]): RuleResult {
  const passing = variants.filter(({ passes }) => passes);
  const worst = ({ checks }: Candidate) =>
    Math.min(
      ...checks
        .filter(({ condition }) => condition.startsWith('acerto'))
        .map(({ interval }) => interval!.value),
    );
  const chosen = [...passing].sort((a, b) => worst(b) - worst(a))[0];
  return {
    rule: 'b',
    title: 'Fatias dos blocos e normalização',
    current,
    candidates: [...variants],
    chosen: chosen?.name ?? current,
    note:
      chosen === undefined
        ? `Nenhuma variante melhora o acerto com o intervalo inteiro acima de zero nas 8 combinações: fica ${current}.`
        : `${passing.length} variante(s) passam; fica a de maior melhora no pior caso.`,
  };
}

export function lambdaChecks(
  outcomes: readonly ProfileOutcome[],
  mode: typeof DiscoveryMode.DISCOVERY | typeof DiscoveryMode.POPULAR,
  { rules }: Rules,
  bootstrap: BootstrapConfig,
  catalogSize: number,
): Check[] {
  const { cutoff, minArpGap, maxLowKnown, minHitRatio, coverageSubsample } = rules.lambda;
  const target = listOf(mode);
  const balanced = listOf(DiscoveryMode.BALANCED);
  const popular = listOf(DiscoveryMode.POPULAR);
  const discovery = mode === DiscoveryMode.DISCOVERY;
  return groupsWhere(outcomes, isLambdaGroup).flatMap(({ key, outcomes: group }) => {
    const [higher, lower] = discovery ? [balanced, target] : [target, balanced];
    const withHoldouts = group.filter(({ profile }) => profile.holdouts.length > 0);
    const hits = (method: Method) => hitCounts(withHoldouts, method, cutoff).hits;
    const checks = [
      check(
        key,
        discovery ? 'ARP do Equilibrado − Descobertas' : 'ARP do Populares − Equilibrado',
        'decimal',
        pairedMean(
          popularityByProfile(group, higher, cutoff),
          popularityByProfile(group, lower, cutoff),
          bootstrap,
        ),
        minArpGap,
        'atLeast',
      ),
      check(
        key,
        `acerto@${cutoff} do ${discovery ? 'Descobertas' : 'Populares'} ÷ o do Equilibrado`,
        'ratio',
        ratioOfSums(hits(target), hits(balanced), bootstrap),
        minHitRatio,
        'atLeast',
      ),
    ];
    if (!discovery) return checks;
    const marked = group
      .map(({ lists }) => lists.get(target)!)
      .filter(({ lowKnown }) => lowKnown !== null);
    return [
      ...checks,
      check(
        key,
        `"pouco conhecido"@${cutoff}`,
        'percent',
        ratioOfSums(
          marked.map(({ lowKnown }) => lowKnown!),
          marked.map(({ games }) => games.length),
          bootstrap,
        ),
        maxLowKnown,
        'atMost',
      ),
      check(
        key,
        `cobertura do catálogo@${cutoff}, Descobertas − Populares`,
        'points',
        coverageDifference(
          group,
          target,
          popular,
          cutoff,
          catalogSize,
          coverageSubsample,
          bootstrap,
        ),
        0,
        'atLeast',
      ),
    ];
  });
}

// O ponto medido do lado do limiar, sem olhar o intervalo.
export function pointPasses({ interval, threshold, side }: Check): boolean {
  if (interval === null || threshold === null || side === null) return false;
  const { value } = interval;
  return {
    above: value > threshold,
    atLeast: value >= threshold,
    atMost: value <= threshold,
    notBelow: value >= threshold,
  }[side];
}

const checkKey = ({ group, condition }: Check) =>
  `${group === null ? '' : groupId(group)}|${condition}`;

const failures = ({ checks }: Candidate) => checks.filter(({ passes }) => !passes).length;

export interface LambdaPair {
  discovery: number;
  popular: number;
}

export type PairCandidate = Candidate & { pair: LambdaPair };

// Regra c sobre o par (fixada em 16/11/2026): as condições dos dois modos, todas calculadas com as
// listas do par, porque a ordem de ARP e a cobertura do Descobertas envolvem os dois.
export function lambdaPairChecks(
  outcomes: readonly ProfileOutcome[],
  rules: Rules,
  bootstrap: BootstrapConfig,
  catalogSize: number,
): Check[] {
  return [DiscoveryMode.DISCOVERY, DiscoveryMode.POPULAR].flatMap((mode) =>
    lambdaChecks(outcomes, mode, rules, bootstrap, catalogSize),
  );
}

// Regra c por pares: o par que passa em todas as combinações com o maior |λ| do Descobertas e, no
// empate, do Populares. Se nenhum passa, a reserva: entre os pares que cumprem toda condição que o
// atual cumpre, pelo ponto medido e pelo intervalo, o que falha em menos condições, com o mesmo
// desempate; se nenhum, o atual.
export function lambdaPairRule(current: string, candidates: readonly PairCandidate[]): RuleResult {
  const byMagnitude = ({ pair: a }: PairCandidate, { pair: b }: PairCandidate) =>
    Math.abs(b.discovery) - Math.abs(a.discovery) || Math.abs(b.popular) - Math.abs(a.popular);
  const base = candidates.find(({ name }) => name === current)!;
  const byInterval = new Set(base.checks.filter(({ passes }) => passes).map(checkKey));
  const byPoint = new Set(base.checks.filter(pointPasses).map(checkKey));
  const keepsCurrent = ({ checks }: Candidate) =>
    checks.every(
      (check) =>
        (!byInterval.has(checkKey(check)) || check.passes) &&
        (!byPoint.has(checkKey(check)) || pointPasses(check)),
    );
  const rule = {
    rule: 'c',
    title: 'λ do Descobertas e do Populares, por pares',
    current,
    candidates: candidates
      .map((candidate) => ({ ...candidate, eligible: keepsCurrent(candidate) }))
      .sort((a, b) => -byMagnitude(a, b)),
  };
  const passing = candidates.filter(({ passes }) => passes).sort(byMagnitude)[0];
  if (passing !== undefined) {
    return {
      ...rule,
      chosen: passing.name,
      note: `O par com o maior |λ| do Descobertas, e depois do Populares, que passa em todas as combinações é ${passing.name}.`,
    };
  }
  const chosen = candidates
    .filter(keepsCurrent)
    .sort((a, b) => failures(a) - failures(b) || byMagnitude(a, b))[0];
  return {
    ...rule,
    chosen: chosen?.name ?? current,
    note:
      chosen === undefined || chosen.name === current
        ? `Nenhum par passa em todas as combinações, e pela reserva fica ${current}: nenhum outro par cumpre tudo o que ele cumpre falhando em menos condições.`
        : `Nenhum par passa em todas as combinações. Pela reserva, ${chosen.name} cumpre tudo o que ${current} cumpre e falha em menos condições (${failures(chosen)} contra ${failures(base)}).`,
  };
}

// Regra d, numa variante de β contra o atual (β = 1), ou no próprio atual (sem a diferença).
export function preferenceWeightChecks(
  current: readonly ProfileOutcome[],
  variant: readonly ProfileOutcome[] | null,
  { rules }: Rules,
  bootstrap: BootstrapConfig,
): Check[] {
  const { mode, cutoff, minPreferenceCoverage } = rules.preferenceWeight;
  const method = listOf(mode);
  const coldStart = (outcomes: readonly ProfileOutcome[]) =>
    groupsWhere(outcomes, ({ family }) => family === 'cold-start')[0]!;
  const { key, outcomes } = coldStart(variant ?? current);
  const coverage = coverageByProfile(
    outcomes,
    outcomes.map(({ lists }) => lists.get(method)!.games.slice(0, cutoff)),
    ({ profile }) => profile.preferencePositions,
  );
  const checks = [
    check(
      key,
      `preferências@${cutoff}`,
      'percent',
      meanInterval(coverage, bootstrap),
      minPreferenceCoverage,
      'atLeast',
    ),
  ];
  if (variant === null) return checks;
  const hit = pairedBootstrap(
    hitCounts(outcomes, method, cutoff),
    hitCounts(coldStart(current).outcomes, method, cutoff),
    bootstrap,
  );
  return [
    ...checks,
    check(
      key,
      `acerto@${cutoff}, diferença`,
      'points',
      hit && { value: hit.difference, low: hit.low, high: hit.high },
      0,
      'above',
    ),
  ];
}

// Regra d: entre os β que passam, o de maior acerto; se nenhum, o atual.
export function preferenceWeightRule(
  current: Candidate,
  variants: readonly Candidate[],
): RuleResult {
  const gain = ({ checks }: Candidate) => checks.at(-1)!.interval!.value;
  const chosen = variants.filter(({ passes }) => passes).sort((a, b) => gain(b) - gain(a))[0];
  return {
    rule: 'd',
    title: 'Peso das preferências (β)',
    current: current.name,
    candidates: [current, ...variants].sort((a, b) => a.value! - b.value!),
    chosen: chosen?.name ?? current.name,
    note:
      chosen === undefined
        ? `Nenhum outro β tem cobertura das preferências e acerto maior com o intervalo inteiro acima de zero: fica ${current.name}.`
        : `${chosen.name} tem cobertura das preferências e acerto maior com o intervalo inteiro acima de zero.`,
  };
}

export interface UpcomingRecord extends GroupKey {
  mode: DiscoveryMode;
  share: number | null;
  dominates: boolean;
}

// "Em breve" domina um modo se passar do limiar no top-k; abaixo disso, só registrado.
export function upcomingRecords(
  outcomes: readonly ProfileOutcome[],
  { rules, cutoffs }: Rules,
  catalogSize: number,
): UpcomingRecord[] {
  const depth = Math.max(...cutoffs);
  return groupsWhere(outcomes, ({ stratum }) => stratum === ALL).flatMap(
    ({ key, outcomes: group }) =>
      [DiscoveryMode.POPULAR, DiscoveryMode.BALANCED, DiscoveryMode.DISCOVERY]
        .filter((mode) => group[0]!.lists.has(listOf(mode)))
        .map((mode) => {
          const share = listMetrics(group, listOf(mode), depth, catalogSize).upcoming;
          return {
            ...key,
            mode,
            share,
            dominates: share !== null && share > rules.upcomingDominance,
          };
        }),
  );
}
