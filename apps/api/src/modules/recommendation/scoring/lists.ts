import { DiscoveryMode, ReleaseStatus } from '../../../generated/prisma/client';
import type { ContentIndex, DisplayedAttribute, IndexedGame } from '../content-index';
import type { Interest } from './interests';
import type { LikedGame } from './liked-games';
import type { ScoredCandidates } from './score';
import type { ListsConfig } from './scoring-config';
import { type SimilarityOf, sourceSimilarity } from './source-similarity';
import type { TieBreak } from './tie-break';
import { topBy, topIndices } from './top';

export const MAIN_LIST_KEY = 'main';
export const UPCOMING_LIST_KEY = 'upcoming';

export const interestListKey = ({ type, slug }: DisplayedAttribute) =>
  `${type.toLowerCase()}:${slug}`;

export const likedGameListKey = (slug: string) => `game:${slug}`;

// O atributo da prateleira de interesse, com o título do vocabulário (nulo nos gêneros e temas).
export interface ShelfAttribute extends DisplayedAttribute {
  title: string | null;
}

export function listAttribute(
  position: number,
  { features }: Pick<ContentIndex, 'features'>,
): ShelfAttribute {
  const { type, slug, name, title } = features[position]!;
  return { type, slug, name, title };
}

export interface RankedList {
  key: string;
  kind: 'main' | 'liked-game' | 'interest' | 'upcoming';
  attribute: ShelfAttribute | null;
  // O jogo da biblioteca de "Porque você gostou de <jogo>".
  likedGameId: string | null;
  // A lista completa, até o teto da configuração.
  games: readonly IndexedGame[];
  // Só no modo Descobertas: a mesma lista montada com λ = 0, para o "pouco conhecido".
  bySimilarity: readonly IndexedGame[] | null;
}

export interface ListOptions {
  mode: DiscoveryMode;
  // O λ do modo, em cos − λ · pop.
  popularityWeight: number;
  interests: readonly Interest[];
  likedGames: readonly LikedGame[];
  tieBreak: TieBreak;
  // A semelhança de cada jogo de origem, guardada entre requisições pelo caso de uso; sem ela,
  // calculada na hora.
  similarityOf?: SimilarityOf;
  // Só esta lista, para o "ver mais"; sem ela, todas, para a visão geral.
  only?: string;
}

// Cada lista é um conjunto de candidatos, pelos índices k de ScoredCandidates.
interface Pools {
  all: readonly number[];
  upcoming: readonly number[];
  byInterest: readonly (readonly number[])[];
}

// Na ordem da página: a principal, "Porque você gostou de <jogo>", uma prateleira por interesse e
// "Em breve no seu gosto". As prateleiras são recortes do mesmo conjunto de candidatos. As de
// interesse e "Em breve" seguem a pontuação do perfil inteiro: sobem primeiro os jogos que também
// batem com os outros gostos. Com `only`, monta só o que aquela lista precisa: a principal, as
// prateleiras de interesse que alimentam as cotas; as outras, só a própria (B-79). Uma chave que
// não é do perfil não monta nada.
export function buildLists(
  candidates: ScoredCandidates,
  catalog: Pick<ContentIndex, 'games' | 'features'>,
  options: ListOptions,
  config: ListsConfig,
): RankedList[] {
  const { mode, interests, likedGames, only } = options;
  const wanted = (key: string) => only === undefined || only === key;
  const labels = interests.map(({ position }) => listAttribute(position, catalog));
  const wantsMain = wanted(MAIN_LIST_KEY);
  const wantsUpcoming = wanted(UPCOMING_LIST_KEY);
  const slots = labels.flatMap((label, slot) => (wanted(interestListKey(label)) ? [slot] : []));
  const liked = likedGames.filter(({ slug }) => wanted(likedGameListKey(slug)));

  const needsPools = wantsMain || wantsUpcoming || slots.length > 0;
  const pools = needsPools ? poolsOf(candidates, catalog, interests) : null;
  const shares = interests.map(({ share }) => share);
  const rankersOf = (value: Float64Array) =>
    rankers(pools!, shares, value, candidates, catalog.games, options.tieBreak, config);
  const byScore = needsPools ? rankersOf(candidates.score) : null;
  const bySimilarity =
    needsPools && mode === DiscoveryMode.DISCOVERY ? rankersOf(candidates.similarity) : null;

  return [
    ...(wantsMain
      ? [
          {
            key: MAIN_LIST_KEY,
            kind: 'main' as const,
            attribute: null,
            likedGameId: null,
            games: byScore!.main(),
            bySimilarity: bySimilarity?.main() ?? null,
          },
        ]
      : []),
    ...likedGameLists(candidates, catalog, liked, options, config),
    ...slots.map((slot): RankedList => ({
      key: interestListKey(labels[slot]!),
      kind: 'interest',
      attribute: labels[slot]!,
      likedGameId: null,
      games: byScore!.shelf(slot),
      bySimilarity: bySimilarity?.shelf(slot) ?? null,
    })),
    ...(wantsUpcoming
      ? [
          {
            key: UPCOMING_LIST_KEY,
            kind: 'upcoming' as const,
            attribute: null,
            likedGameId: null,
            games: byScore!.upcoming(),
            bySimilarity: bySimilarity?.upcoming() ?? null,
          },
        ]
      : []),
  ];
}

// Os candidatos do perfil com algum atributo do jogo de origem, por cos(v_origem, v_j) − λ · pop,
// com o mesmo desempate. A semelhança com os jogos do índice não depende do perfil e vem guardada;
// aqui ela só é filtrada pelos candidatos, na ordem deles, e recebe o λ do modo.
function likedGameLists(
  candidates: ScoredCandidates,
  catalog: Pick<ContentIndex, 'games' | 'features'>,
  likedGames: readonly LikedGame[],
  { mode, popularityWeight, tieBreak, similarityOf }: ListOptions,
  config: ListsConfig,
): RankedList[] {
  if (likedGames.length === 0) return [];
  const { games } = catalog;
  const similarityFor =
    similarityOf ?? (({ vector }: LikedGame) => sourceSimilarity(catalog, vector));
  const candidateAt = new Int32Array(games.length).fill(-1);
  for (let k = 0; k < candidates.count; k++) candidateAt[candidates.gamePositions[k]!] = k;
  const gameOf = (k: number) => games[candidates.gamePositions[k]!]!;

  return likedGames.map((liked): RankedList => {
    const { positions, values } = similarityFor(liked);
    const pool: number[] = [];
    const similarities: number[] = [];
    for (let j = 0; j < positions.length; j++) {
      const k = candidateAt[positions[j]!]!;
      if (k < 0) continue;
      pool.push(k);
      similarities.push(values[j]!);
    }
    const similarity = Float64Array.from(similarities);
    const score = similarity.map(
      (value, j) => value - popularityWeight * gameOf(pool[j]!).popularityNorm,
    );
    const top = (values: Float64Array) =>
      topIndices(values, (j) => gameOf(pool[j]!).id, config.shelfCap, tieBreak).map((j) =>
        gameOf(pool[j]!),
      );
    return {
      key: likedGameListKey(liked.slug),
      kind: 'liked-game',
      attribute: null,
      likedGameId: liked.gameId,
      games: top(score),
      bySimilarity: mode === DiscoveryMode.DISCOVERY ? top(similarity) : null,
    };
  });
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

// Cada lista é ordenada só quando pedida, e cada prateleira uma vez só: a principal usa todas. Com
// menos de 2 interesses não há o que intercalar: a principal é a ordem da pontuação. As
// prateleiras bastam para preencher a principal porque o teto dela não passa o delas, e a lista
// geral até o teto da principal sempre tem jogos não usados para completá-la.
function rankers(
  { all, upcoming, byInterest }: Pools,
  shares: readonly number[],
  value: Float64Array,
  { gamePositions }: ScoredCandidates,
  games: readonly IndexedGame[],
  tieBreak: TieBreak,
  config: ListsConfig,
) {
  const gameOf = (k: number) => games[gamePositions[k]!]!;
  const top = (pool: readonly number[], cap: number) =>
    topBy(
      pool,
      (k) => value[k]!,
      (k) => gameOf(k).id,
      cap,
      tieBreak,
    ).map(gameOf);
  const shelves = new Map<number, IndexedGame[]>();
  const shelf = (slot: number) => {
    let games = shelves.get(slot);
    if (games === undefined) {
      games = top(byInterest[slot]!, config.shelfCap);
      shelves.set(slot, games);
    }
    return games;
  };
  return {
    shelf,
    main: () => {
      const ranked = top(all, config.mainCap);
      if (byInterest.length < 2) return ranked;
      return interleave(
        byInterest.map((_, slot) => shelf(slot)),
        shares,
        ranked,
        config.mainCap,
      );
    },
    upcoming: () => top(upcoming, config.shelfCap),
  };
}

// Posição a posição, entra o próximo jogo ainda não usado da prateleira com o maior déficit em
// relação à cota, share_k · n − c_k; no empate, a que vem antes na página. O jogo de dois
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
