import {
  type GameLibraryState,
  GameLibraryStateSchema,
  GameListsSchema,
  LIST_PARAMS,
  type ListType,
  RatingSchema,
} from '@indie/contracts';
import { apiFetch } from '@/lib/api-client';

// Na URL a lista vai em minúsculas (favorite, completed, want-to-play).
const LIST_PATHS = Object.fromEntries(
  Object.entries(LIST_PARAMS).map(([param, list]) => [list, param]),
) as Record<ListType, keyof typeof LIST_PARAMS>;

const game = (slug: string) => encodeURIComponent(slug);

export const getGameLibrary = (slug: string) =>
  apiFetch(`/me/library/${game(slug)}`, { schema: GameLibraryStateSchema });

export type LibraryAction =
  | { kind: 'rate'; score: number }
  | { kind: 'unrate' }
  | { kind: 'add'; list: ListType }
  | { kind: 'remove'; list: ListType };

// Devolve o estado do jogo depois da ação, a partir do que a API respondeu.
export async function applyLibraryAction(
  slug: string,
  action: LibraryAction,
  current: GameLibraryState,
): Promise<GameLibraryState> {
  switch (action.kind) {
    case 'rate': {
      const rating = await apiFetch(`/me/ratings/${game(slug)}`, {
        method: 'PUT',
        body: { score: action.score },
        schema: RatingSchema,
      });
      return { ...current, rating };
    }
    case 'unrate':
      await apiFetch(`/me/ratings/${game(slug)}`, { method: 'DELETE' });
      return { ...current, rating: null };
    // "Concluídos" e "quero jogar" se excluem: as listas certas vêm na resposta.
    case 'add': {
      const { lists } = await apiFetch(`/me/lists/${LIST_PATHS[action.list]}/${game(slug)}`, {
        method: 'PUT',
        schema: GameListsSchema,
      });
      return { ...current, lists };
    }
    case 'remove':
      await apiFetch(`/me/lists/${LIST_PATHS[action.list]}/${game(slug)}`, { method: 'DELETE' });
      return { ...current, lists: current.lists.filter((list) => list !== action.list) };
  }
}
