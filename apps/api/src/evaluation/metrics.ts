import { ReleaseStatus } from '../generated/prisma/client';
import type { IndexedGame } from '../modules/recommendation/content-index';
import { mulberry32 } from './random';
import type { Method, ProfileOutcome } from './run';

// Por perfil, os acertos e os jogos escondidos: o acerto do grupo é a soma de um sobre a do outro,
// e o bootstrap reamostra os perfis, não os jogos escondidos.
export interface HitCounts {
  hits: readonly number[];
  holdouts: readonly number[];
}

export function hitCounts(
  outcomes: readonly ProfileOutcome[],
  method: Method,
  k: number,
): HitCounts {
  const withHoldouts = outcomes.filter(({ ranks }) => ranks.get(method)!.length > 0);
  return {
    hits: withHoldouts.map(({ ranks }) => ranks.get(method)!.filter((r) => r >= 0 && r < k).length),
    holdouts: withHoldouts.map(({ ranks }) => ranks.get(method)!.length),
  };
}

export function hitRate({ hits, holdouts }: HitCounts): number | null {
  const total = sum(holdouts);
  return total === 0 ? null : sum(hits) / total;
}

export interface ListMetrics {
  // Fração do catálogo que aparece em alguma lista.
  catalogCoverage: number;
  // Média, entre os perfis, da popularidade normalizada média da lista (ARP).
  averagePopularity: number | null;
  // Fração dos itens que são "em breve".
  upcoming: number | null;
  // Média, entre os perfis, da fração dos interesses com algum jogo na lista.
  interestCoverage: number | null;
  // A mesma conta com os gêneros e temas positivos do perfil, a definição antiga (seção 12).
  genreThemeCoverage: number | null;
  // A mesma conta com as preferências da partida a frio.
  preferenceCoverage: number | null;
}

export function listMetrics(
  outcomes: readonly ProfileOutcome[],
  method: Method,
  k: number,
  catalogSize: number,
): ListMetrics {
  const top = outcomes.map(({ lists }) => lists.get(method)!.games.slice(0, k));
  const items = top.flat();
  return {
    catalogCoverage: new Set(items.map(({ id }) => id)).size / catalogSize,
    averagePopularity: mean(
      top.filter((games) => games.length > 0).map((games) => mean(games.map(popularity))!),
    ),
    upcoming:
      items.length === 0
        ? null
        : items.filter(({ releaseStatus }) => releaseStatus === ReleaseStatus.UPCOMING).length /
          items.length,
    interestCoverage: coverage(outcomes, top, ({ interests }) => interests),
    genreThemeCoverage: coverage(outcomes, top, ({ genresAndThemes }) => genresAndThemes),
    preferenceCoverage: coverage(outcomes, top, ({ profile }) => profile.preferencePositions),
  };
}

// Fração dos itens marcados "pouco conhecido", só no modo Descobertas e só na profundidade
// guardada: a marca depende de quantos itens são mostrados.
export function lowKnownRate(outcomes: readonly ProfileOutcome[], method: Method): number | null {
  const marked = outcomes
    .map(({ lists }) => lists.get(method)!)
    .filter(({ lowKnown }) => lowKnown !== null);
  const items = sum(marked.map(({ games }) => games.length));
  return items === 0 ? null : sum(marked.map(({ lowKnown }) => lowKnown!)) / items;
}

// Média, entre os perfis com algum atributo, da fração dos atributos com algum jogo na lista.
function coverage(
  outcomes: readonly ProfileOutcome[],
  top: readonly (readonly IndexedGame[])[],
  attributesOf: (outcome: ProfileOutcome) => readonly number[],
): number | null {
  return mean(coverageByProfile(outcomes, top, attributesOf).filter((value) => value !== null));
}

// Por perfil, a fração dos atributos com algum jogo na lista; null no perfil sem atributo.
export function coverageByProfile(
  outcomes: readonly ProfileOutcome[],
  top: readonly (readonly IndexedGame[])[],
  attributesOf: (outcome: ProfileOutcome) => readonly number[],
): (number | null)[] {
  return outcomes.map((outcome, i) => {
    const attributes = attributesOf(outcome);
    if (attributes.length === 0) return null;
    const present = attributes.filter((position) =>
      top[i]!.some(({ featurePositions }) => featurePositions.includes(position)),
    );
    return present.length / attributes.length;
  });
}

// Média, entre os perfis, da fração de jogos em comum entre duas listas do mesmo perfil.
export function overlap(
  outcomes: readonly ProfileOutcome[],
  a: Method,
  b: Method,
  k: number,
): number | null {
  return mean(
    outcomes.flatMap(({ lists }) => {
      const first = lists.get(a)!.games.slice(0, k);
      const second = new Set(lists.get(b)!.games.slice(0, k));
      const size = Math.max(first.length, second.size);
      return size === 0 ? [] : [first.filter((game) => second.has(game)).length / size];
    }),
  );
}

export interface BootstrapConfig {
  seed: number;
  resamples: number;
  confidence: number;
}

export interface Interval {
  value: number;
  low: number;
  high: number;
}

export interface Difference {
  // Acerto de a menos acerto de b, nos mesmos perfis e jogos escondidos.
  difference: number;
  low: number;
  high: number;
}

// Intervalo de confiança de uma estatística dos perfis pelo bootstrap: os perfis são sorteados com
// reposição, e a estatística é recalculada sobre os sorteados; percentis da distribuição. A mesma
// semente em toda conta dá os mesmos sorteios, o que pareia as estatísticas dos mesmos perfis.
export function bootstrapInterval(
  profiles: number,
  statistic: (sample: Uint32Array) => number,
  { seed, resamples, confidence }: BootstrapConfig,
): Interval | null {
  if (profiles === 0) return null;
  const random = mulberry32(seed);
  const sample = new Uint32Array(profiles);
  const values = Float64Array.from({ length: resamples }, () => {
    for (let i = 0; i < profiles; i++) sample[i] = Math.floor(random() * profiles);
    return statistic(sample);
  });
  return percentiles(statistic(allProfiles(profiles)), values, confidence);
}

// Intervalo pela subamostragem: cada sorteio leva uma fração dos perfis, sem repetir nenhum. Serve
// à estatística que conta itens distintos do grupo, que o sorteio com reposição puxa para baixo.
export function subsampleInterval(
  profiles: number,
  fraction: number,
  statistic: (sample: Uint32Array) => number,
  { seed, resamples, confidence }: BootstrapConfig,
): Interval | null {
  if (profiles === 0) return null;
  const size = Math.max(1, Math.round(profiles * fraction));
  const random = mulberry32(seed);
  const order = allProfiles(profiles);
  const values = Float64Array.from({ length: resamples }, () => {
    for (let i = 0; i < size; i++) {
      const j = i + Math.floor(random() * (profiles - i));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    return statistic(order.subarray(0, size));
  });
  return percentiles(statistic(allProfiles(profiles)), values, confidence);
}

const allProfiles = (profiles: number) => Uint32Array.from({ length: profiles }, (_, i) => i);

function percentiles(value: number, values: Float64Array, confidence: number): Interval {
  values.sort();
  const tail = (1 - confidence) / 2;
  return {
    value,
    low: values[Math.floor(tail * values.length)]!,
    high: values[Math.ceil((1 - tail) * values.length) - 1]!,
  };
}

// Soma dos valores dos perfis sorteados.
export function sampledSum(values: ArrayLike<number>, sample: Uint32Array): number {
  let total = 0;
  for (const profile of sample) total += values[profile]!;
  return total;
}

// Intervalo da diferença de acerto pelo bootstrap pareado: as duas configurações são recalculadas
// nos mesmos perfis sorteados, como acertos sobre jogos escondidos.
export function pairedBootstrap(
  a: HitCounts,
  b: HitCounts,
  bootstrap: BootstrapConfig,
): Difference | null {
  if (b.holdouts.length !== a.holdouts.length) return null;
  const interval = bootstrapInterval(
    a.holdouts.length,
    (sample) =>
      (sampledSum(a.hits, sample) - sampledSum(b.hits, sample)) / sampledSum(a.holdouts, sample),
    bootstrap,
  );
  if (interval === null) return null;
  const rate = (hits: readonly number[]) => sum(hits) / sum(a.holdouts);
  return { difference: rate(a.hits) - rate(b.hits), low: interval.low, high: interval.high };
}

const popularity = ({ popularityNorm }: IndexedGame) => popularityNorm;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : sum(values) / values.length;
}
