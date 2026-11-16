import type { Library, LibraryGame } from '@indie/contracts';
import { describe, expect, it } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { gameStateIn } from './library-state';

const AT = '2026-11-16T12:00:00.000Z';
const celeste: LibraryGame = { ...sampleGame(), inCatalog: true };
const hades: LibraryGame = { ...sampleGame({ slug: 'hades', name: 'Hades' }), inCatalog: true };

const library: Library = {
  ratings: [{ game: celeste, score: 4, updatedAt: AT }],
  lists: {
    FAVORITE: [{ game: celeste, addedAt: AT }],
    COMPLETED: [{ game: celeste, addedAt: AT }],
    WANT_TO_PLAY: [{ game: hades, addedAt: AT }],
  },
};

describe('gameStateIn', () => {
  it('junta a nota e todas as listas do jogo', () => {
    expect(gameStateIn(library, 'celeste')).toEqual({
      rating: { score: 4, updatedAt: AT },
      lists: ['FAVORITE', 'COMPLETED'],
    });
  });

  it('jogo sem nota fica com a nota nula', () => {
    expect(gameStateIn(library, 'hades')).toEqual({ rating: null, lists: ['WANT_TO_PLAY'] });
  });

  it('jogo fora da biblioteca não tem nota nem lista', () => {
    expect(gameStateIn(library, 'ori')).toEqual({ rating: null, lists: [] });
  });
});
