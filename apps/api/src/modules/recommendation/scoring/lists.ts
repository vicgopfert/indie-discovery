import { DiscoveryMode, ReleaseStatus } from '../../../generated/prisma/client';
import type { IndexedFeature, IndexedGame } from '../content-index';
import type { Interest } from './interests';
import type { ScoredCandidate } from './rank';
import type { ListsConfig } from './scoring-config';
import { type TieBreak, topBy } from './tie-break';

export const MAIN_LIST_KEY = 'main';
export const UPCOMING_LIST_KEY = 'upcoming';

export const interestListKey = ({ type, slug }: IndexedFeature) => `${type.toLowerCase()}:${slug}`;

export interface RankedList {
  key: string;
  kind: 'main' | 'upcoming' | 'interest';
  feature: IndexedFeature | null;
  // A lista completa, até o teto da configuração.
  games: readonly IndexedGame[];
  // Só no modo Descobertas: a mesma lista montada com λ = 0, para o "pouco conhecido".
  bySimilarity: readonly IndexedGame[] | null;
}

export interface ListOptions {
  mode: DiscoveryMode;
  interests: readonly Interest[];
  tieBreak: TieBreak;
}

interface Pools {
  all: readonly ScoredCandidate[];
  upcoming: readonly ScoredCandidate[];
  byInterest: readonly (readonly ScoredCandidate[])[];
}

interface OrderedLists {
  main: IndexedGame[];
  upcoming: IndexedGame[];
  shelves: IndexedGame[][];
}

// Na ordem da página: a principal, "Em breve no seu gosto" e uma prateleira por interesse. As
// prateleiras são recortes do mesmo conjunto de candidatos, todas ordenadas pela pontuação do
// perfil inteiro: sobem primeiro os jogos que também batem com os outros gostos.
export function buildLists(
  candidates: readonly ScoredCandidate[],
  features: readonly IndexedFeature[],
  { mode, interests, tieBreak }: ListOptions,
  config: ListsConfig,
): RankedList[] {
  const slotByPosition = new Map(interests.map(({ position }, slot) => [position, slot]));
  const byInterest = interests.map((): ScoredCandidate[] => []);
  const upcoming: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    for (const position of candidate.game.featurePositions) {
      const slot = slotByPosition.get(position);
      if (slot !== undefined) byInterest[slot]!.push(candidate);
    }
    if (candidate.game.releaseStatus === ReleaseStatus.UPCOMING) upcoming.push(candidate);
  }

  const pools = { all: candidates, upcoming, byInterest };
  const shares = interests.map(({ share }) => share);
  const byScore = orderLists(pools, shares, (c) => c.score, tieBreak, config);
  const bySimilarity =
    mode === DiscoveryMode.DISCOVERY
      ? orderLists(pools, shares, (c) => c.similarity, tieBreak, config)
      : null;

  return [
    {
      key: MAIN_LIST_KEY,
      kind: 'main',
      feature: null,
      games: byScore.main,
      bySimilarity: bySimilarity?.main ?? null,
    },
    {
      key: UPCOMING_LIST_KEY,
      kind: 'upcoming',
      feature: null,
      games: byScore.upcoming,
      bySimilarity: bySimilarity?.upcoming ?? null,
    },
    ...interests.map(({ position }, slot): RankedList => {
      const feature = features[position]!;
      return {
        key: interestListKey(feature),
        kind: 'interest',
        feature,
        games: byScore.shelves[slot]!,
        bySimilarity: bySimilarity?.shelves[slot] ?? null,
      };
    }),
  ];
}

// Com menos de 2 interesses não há o que intercalar: a principal é a ordem da pontuação. As
// prateleiras bastam para preencher a principal porque o teto dela não passa o delas, e a lista
// geral até o teto da principal sempre tem jogos não usados para completá-la.
function orderLists(
  { all, upcoming, byInterest }: Pools,
  shares: readonly number[],
  value: (candidate: ScoredCandidate) => number,
  tieBreak: TieBreak,
  config: ListsConfig,
): OrderedLists {
  const top = (pool: readonly ScoredCandidate[], cap: number) =>
    topBy(pool, value, (c) => c.game.id, cap, tieBreak).map(({ game }) => game);
  const ranked = top(all, config.mainCap);
  const shelves = byInterest.map((pool) => top(pool, config.shelfCap));
  return {
    main: shelves.length < 2 ? ranked : interleave(shelves, shares, ranked, config.mainCap),
    upcoming: top(upcoming, config.shelfCap),
    shelves,
  };
}

// Posição a posição, entra o próximo jogo ainda não usado da prateleira com o maior déficit em
// relação à cota, share_k · n − c_k; no empate, a que vem antes, de maior cota. O jogo de dois
// interesses conta para a prateleira que o pôs. Esgotadas as prateleiras, segue pelo resto.
export function interleave(
  shelves: readonly (readonly IndexedGame[])[],
  shares: readonly number[],
  rest: readonly IndexedGame[],
  cap: number,
): IndexedGame[] {
  const used = new Set<string>();
  const cursors = shelves.map(() => 0);
  const counts = shelves.map(() => 0);
  const result: IndexedGame[] = [];
  const take = (game: IndexedGame) => {
    used.add(game.id);
    result.push(game);
  };
  const nextOf = (slot: number) => {
    const shelf = shelves[slot]!;
    while (cursors[slot]! < shelf.length && used.has(shelf[cursors[slot]!]!.id)) cursors[slot]!++;
    return shelf[cursors[slot]!];
  };

  while (result.length < cap) {
    const n = result.length + 1;
    let best = -1;
    let bestDeficit = -Infinity;
    shelves.forEach((_, slot) => {
      if (nextOf(slot) === undefined) return;
      const deficit = shares[slot]! * n - counts[slot]!;
      if (deficit > bestDeficit) {
        best = slot;
        bestDeficit = deficit;
      }
    });
    if (best < 0) break;
    take(nextOf(best)!);
    counts[best]!++;
  }
  for (const game of rest) {
    if (result.length >= cap) break;
    if (!used.has(game.id)) take(game);
  }
  return result;
}
