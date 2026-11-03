import type { IndexedGame } from '../content-index';
import type { RankedList } from './lists';
import type { ListsConfig } from './scoring-config';

export interface ShownGame {
  game: IndexedGame;
  lowKnown: boolean;
}

export interface ShownList {
  list: RankedList;
  items: ShownGame[];
  hasMore: boolean;
}

// Na visão geral, um jogo aparece em um lugar só: a principal primeiro e, na ordem da página,
// cada prateleira com os jogos dela que ainda não apareceram. A prateleira que fica abaixo do
// mínimo some, e os jogos dela continuam livres para as seguintes.
export function overview(lists: readonly RankedList[], config: ListsConfig): ShownList[] {
  const [main, ...shelves] = lists;
  const seen = new Set<string>();
  const shownLists: ShownList[] = [];
  const add = (list: RankedList, positions: number[]) => {
    const items = show(list, positions);
    for (const { game } of items) seen.add(game.id);
    shownLists.push({ list, items, hasMore: list.games.length > items.length });
  };

  add(main!, range(0, Math.min(config.overviewMainSize, main!.games.length)));
  for (const shelf of shelves) {
    const positions: number[] = [];
    for (let i = 0; i < shelf.games.length && positions.length < config.overviewShelfSize; i++) {
      if (!seen.has(shelf.games[i]!.id)) positions.push(i);
    }
    if (positions.length >= config.shelfMinItems) add(shelf, positions);
  }
  return shownLists;
}

// No "ver mais", a lista é lida sozinha: a repetição com as outras é permitida. Além do teto, a
// página vem vazia.
export function listPage(
  list: RankedList,
  page: number,
  config: ListsConfig,
): Omit<ShownList, 'list'> {
  const start = (page - 1) * config.pageSize;
  const end = Math.min(start + config.pageSize, list.games.length);
  return {
    items: show(list, range(start, end)),
    hasMore: start + config.pageSize < list.games.length,
  };
}

// "Pouco conhecido": o jogo está entre os N primeiros da lista, N a posição do último mostrado,
// e não estaria se a mesma lista fosse montada com λ = 0.
function show(list: RankedList, positions: readonly number[]): ShownGame[] {
  const depth = positions.length === 0 ? 0 : positions[positions.length - 1]! + 1;
  const reference = list.bySimilarity && new Set(list.bySimilarity.slice(0, depth));
  return positions.map((position) => {
    const game = list.games[position]!;
    return { game, lowKnown: reference !== null && !reference.has(game) };
  });
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(end - start, 0) }, (_, i) => start + i);
}
