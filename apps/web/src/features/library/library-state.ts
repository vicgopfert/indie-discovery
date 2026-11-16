import { type GameLibraryState, type Library, LIST_TYPES } from '@indie/contracts';

// A nota e as listas de um jogo, tiradas da biblioteca inteira já carregada.
export function gameStateIn(library: Library, slug: string): GameLibraryState {
  const rating = library.ratings.find(({ game }) => game.slug === slug);
  return {
    rating: rating ? { score: rating.score, updatedAt: rating.updatedAt } : null,
    lists: LIST_TYPES.filter((list) => library.lists[list].some(({ game }) => game.slug === slug)),
  };
}
