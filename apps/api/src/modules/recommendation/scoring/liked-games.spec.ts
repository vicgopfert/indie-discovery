import { ListType } from '../../../generated/prisma/client';
import type { Interest } from './interests';
import { pickLikedGames } from './liked-games';
import type { Interaction } from './profile';
import { gameId, rated, scoringConfig, shelfIndex } from './scoring.fixture';

const { FAVORITE, COMPLETED, WANT_TO_PLAY } = ListType;

describe('pickLikedGames', () => {
  const index = shelfIndex();
  const covering = (...slugs: string[]): Interest[] => [
    { position: 0, coverage: 1, share: 1, supportGameIds: slugs.map(gameId) },
  ];
  const pick = (interactions: Interaction[], interests: Interest[] = []) =>
    pickLikedGames(interactions, interests, scoringConfig).map(({ slug }) => slug);

  it('só jogos com nota 4 ou mais ou em favoritos', () => {
    expect(
      pick([
        rated(index, 'hollow', 3),
        rated(index, 'dead', 4),
        rated(index, 'hades', null, [FAVORITE]),
        rated(index, 'celeste', null, [COMPLETED]),
        rated(index, 'amnesia', null, [WANT_TO_PLAY]),
      ]).sort(),
    ).toEqual(['dead', 'hades']);
  });

  it('um jogo só em "quero jogar" ou só em "concluídos" nunca gera a prateleira', () => {
    expect(
      pick([
        rated(index, 'celeste', null, [COMPLETED]),
        rated(index, 'amnesia', null, [WANT_TO_PLAY]),
        rated(index, 'hollow', null, [COMPLETED, WANT_TO_PLAY]),
      ]),
    ).toEqual([]);
  });

  it('o favorito com nota baixa, que não move o perfil, fica de fora', () => {
    // Nota 1 e favorito: w = −2 + 2 = 0.
    expect(pick([rated(index, 'hollow', 1, [FAVORITE])])).toEqual([]);
  });

  it('primeiro o jogo que nenhuma prateleira de interesse cobre, depois pelo peso', () => {
    // Hollow Knight é favorito com nota 5 (w = 4), mas Amnesia é o gosto de um jogo só.
    const library = [
      rated(index, 'hollow', 5, [FAVORITE]),
      rated(index, 'dead', 5),
      rated(index, 'amnesia', 4),
    ];

    expect(pick(library, covering('hollow', 'dead'))).toEqual(['amnesia', 'hollow']);
    expect(pick(library, covering('hollow', 'dead', 'amnesia'))).toEqual(['hollow', 'dead']);
  });

  it('no empate do peso, o curtido mais recentemente; depois, o id', () => {
    const library = [
      rated(index, 'hollow', 5, [], 300),
      rated(index, 'dead', 5, [], 100),
      rated(index, 'hades', 5, [], 200),
    ];

    expect(pick(library)).toEqual(['hollow', 'hades']);
    expect(pick(library.map((i) => ({ ...i, likedAt: 100 })))).toEqual(['dead', 'hades']);
  });

  it('para no máximo da configuração e ignora o jogo sem vetor', () => {
    const library = [
      { ...rated(index, 'hollow', 5), vector: null },
      rated(index, 'dead', 5),
      rated(index, 'hades', 5),
      rated(index, 'celeste', 5),
    ];

    expect(pick(library)).toEqual(['celeste', 'dead']);
    expect(
      pickLikedGames(library, [], {
        ...scoringConfig,
        lists: { ...scoringConfig.lists, likedGameShelves: 0 },
      }),
    ).toEqual([]);
  });
});
