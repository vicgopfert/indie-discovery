import { DiscoveryMode, ReleaseStatus } from '../../../generated/prisma/client';
import type { ContentIndex, DisplayedAttribute, IndexedGame } from '../content-index';
import type { Interest } from './interests';
import type { ScoredCandidates } from './score';
import type { ListsConfig } from './scoring-config';
import type { TieBreak } from './tie-break';
import { topBy } from './top';

export const MAIN_LIST_KEY = 'main';
export const UPCOMING_LIST_KEY = 'upcoming';

export const interestListKey = ({ type, slug }: DisplayedAttribute) =>
  `${type.toLowerCase()}:${slug}`;

export function listAttribute(
  position: number,
  { features }: Pick<ContentIndex, 'features'>,
): DisplayedAttribute {
  const { type, slug, name } = features[position]!;
  return { type, slug, name };
}

export interface RankedList {
  key: string;
  kind: 'main' | 'upcoming' | 'interest';
  attribute: DisplayedAttribute | null;
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

// Cada lista é um conjunto de candidatos, pelos índices k de ScoredCandidates.
interface Pools {
  all: readonly number[];
  upcoming: readonly number[];
  byInterest: readonly (readonly number[])[];
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
  candidates: ScoredCandidates,
  catalog: Pick<ContentIndex, 'games' | 'features'>,
  { mode, interests, tieBreak }: ListOptions,
  config: ListsConfig,
): RankedList[] {
  const pools = poolsOf(candidates, catalog, interests);
  const shares = interests.map(({ share }) => share);
  const order = (value: Float64Array) =>
    orderLists(pools, shares, value, candidates, catalog.games, tieBreak, config);
  const byScore = order(candidates.score);
  const bySimilarity = mode === DiscoveryMode.DISCOVERY ? order(candidates.similarity) : null;

  return [
    {
      key: MAIN_LIST_KEY,
      kind: 'main',
      attribute: null,
      games: byScore.main,
      bySimilarity: bySimilarity?.main ?? null,
    },
    {
      key: UPCOMING_LIST_KEY,
      kind: 'upcoming',
      attribute: null,
      games: byScore.upcoming,
      bySimilarity: bySimilarity?.upcoming ?? null,
    },
    ...interests.map(({ position }, slot): RankedList => {
      const label = listAttribute(position, catalog);
      return {
        key: interestListKey(label),
        kind: 'interest',
        attribute: label,
        games: byScore.shelves[slot]!,
        bySimilarity: bySimilarity?.shelves[slot] ?? null,
      };
    }),
  ];
}

// Uma passada pelos candidatos, com a prateleira de cada atributo numa tabela pela posição dele
// (-1 fora dos interesses): um Map consultado para cada atributo de cada candidato custava cerca
// de um terço da montagem das listas (B-76).
function poolsOf(
  { count, gamePositions }: ScoredCandidates,
  { games, features }: Pick<ContentIndex, 'games' | 'features'>,
  interests: readonly Interest[],
): Pools {
  const featureSlot = new Int16Array(features.length).fill(-1);
  interests.forEach(({ position }, slot) => {
    featureSlot[position] = slot;
  });

  const all: number[] = [];
  const upcoming: number[] = [];
  const byInterest = interests.map((): number[] => []);
  for (let k = 0; k < count; k++) {
    const game = games[gamePositions[k]!]!;
    all.push(k);
    for (let i = 0; i < game.featurePositions.length; i++) {
      const slot = featureSlot[game.featurePositions[i]!]!;
      if (slot >= 0) byInterest[slot]!.push(k);
    }
    if (game.releaseStatus === ReleaseStatus.UPCOMING) upcoming.push(k);
  }
  return { all, upcoming, byInterest };
}

// Com menos de 2 interesses não há o que intercalar: a principal é a ordem da pontuação. As
// prateleiras bastam para preencher a principal porque o teto dela não passa o delas, e a lista
// geral até o teto da principal sempre tem jogos não usados para completá-la.
function orderLists(
  { all, upcoming, byInterest }: Pools,
  shares: readonly number[],
  value: Float64Array,
  { gamePositions }: ScoredCandidates,
  games: readonly IndexedGame[],
  tieBreak: TieBreak,
  config: ListsConfig,
): OrderedLists {
  const gameOf = (k: number) => games[gamePositions[k]!]!;
  const top = (pool: readonly number[], cap: number) =>
    topBy(
      pool,
      (k) => value[k]!,
      (k) => gameOf(k).id,
      cap,
      tieBreak,
    ).map(gameOf);
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
