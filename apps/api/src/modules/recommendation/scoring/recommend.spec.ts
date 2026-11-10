import { DiscoveryMode, ListType } from '../../../generated/prisma/client';
import type { LikedGame } from './liked-games';
import { recommend, type RecommendationInput } from './recommend';
import {
  featurePosition,
  GENERIC_LIBRARY,
  genericIndex,
  rated,
  scoringConfig,
  scoringIndex,
  TASTE_LIBRARY,
  tasteIndex,
} from './scoring.fixture';
import { sourceSimilarity } from './source-similarity';

const { POPULAR, BALANCED, DISCOVERY } = DiscoveryMode;

describe('recommend', () => {
  const index = scoringIndex();

  const input = (overrides: Partial<RecommendationInput>): RecommendationInput => ({
    userId: 'u-1',
    mode: BALANCED,
    interactions: [],
    preferencePositions: [],
    hiddenPositions: new Set(),
    ...overrides,
  });
  const mainOf = (result: ReturnType<typeof recommend>) => result.lists[0]!;
  const slugs = (result: ReturnType<typeof recommend>) =>
    mainOf(result).games.map(({ slug }) => slug);

  // O caso de uso manda para a partida a frio antes; aqui chega quem só tem preferências que
  // saíram do índice.
  it('com o perfil vazio, recorre aos populares do catálogo inteiro, sem motivo nem prateleiras', () => {
    const result = recommend(index, input({}), scoringConfig);

    expect(result.basis).toBe('popular');
    expect(result.lists.map(({ key }) => key)).toEqual(['main']);
    expect(slugs(result).slice(0, 2)).toEqual(['popular-rogue', 'hades']);
    expect(
      mainOf(result)
        .games.map((game) => result.reasonOf(game))
        .every((r) => r === null),
    ).toBe(true);
  });

  it('com o perfil sem componente positiva, recorre aos populares dos preferidos', () => {
    const result = recommend(
      index,
      input({
        mode: DISCOVERY,
        interactions: [rated(index, 'hades', 1)],
        preferencePositions: [featurePosition(index, 'fantasy')],
      }),
      scoringConfig,
    );

    expect(result.basis).toBe('popular');
    expect(slugs(result)).toEqual(['popular-rogue', 'dead-cells', 'obscure-rogue']);
    expect(mainOf(result).bySimilarity).toBeNull();
  });

  it('recomenda pelo perfil, com motivo em cada jogo', () => {
    const result = recommend(
      index,
      input({ interactions: [rated(index, 'dead-cells', 5)] }),
      scoringConfig,
    );

    expect(result.basis).toBe('profile');
    expect(slugs(result)[0]).toBe('spelunky');
    expect(mainOf(result).games.every((game) => result.reasonOf(game) !== null)).toBe(true);
  });

  it('só com preferências declaradas, já recomenda', () => {
    const result = recommend(
      index,
      input({ preferencePositions: [featurePosition(index, 'horror')] }),
      scoringConfig,
    );

    expect(result.basis).toBe('profile');
    expect(slugs(result)[0]).toBe('horror-only');
  });

  it('deixa de fora todo jogo avaliado ou em lista, mesmo neutro ou sem vetor, de todas as listas', () => {
    const result = recommend(
      index,
      input({
        interactions: [
          rated(index, 'dead-cells', 5),
          rated(index, 'spelunky', 3),
          rated(index, 'hades', null, [ListType.WANT_TO_PLAY]),
          {
            gameId: 'g-popular-rogue',
            slug: 'popular-rogue',
            score: 4,
            lists: [],
            vector: null,
            likedAt: null,
          },
        ],
      }),
      scoringConfig,
    );
    const listed = result.lists.flatMap(({ games }) => games.map(({ slug }) => slug));

    expect(slugs(result).length).toBeGreaterThan(0);
    for (const slug of ['dead-cells', 'spelunky', 'hades', 'popular-rogue']) {
      expect(listed).not.toContain(slug);
    }
  });

  it('com um interesse só, a principal é a ordem da pontuação', () => {
    // Hades e Dead Cells dividem um gênero e um tema: o primeiro a entrar cobre os dois jogos, e o
    // segundo não cobre nada novo.
    const result = recommend(
      index,
      input({ interactions: [rated(index, 'hades', 5), rated(index, 'dead-cells', 5)] }),
      scoringConfig,
    );

    expect(result.lists.map(({ key }) => key)).toEqual([
      'main',
      'game:dead-cells',
      'game:hades',
      'theme:fantasy',
      'upcoming',
    ]);
    expect(slugs(result).slice(0, 2).sort()).toEqual(['obscure-rogue', 'popular-rogue']);
    // Os outros pela pontuação: Spelunky divide o gênero, Plataforma e Pixel Art com Dead Cells.
    expect(slugs(result).slice(2)).toEqual(['spelunky', 'celeste', 'limbo', 'inside', 'free-solo']);
  });

  it('com only, monta só a lista pedida; a chave fora do perfil não traz nenhuma', () => {
    const interactions = [rated(index, 'hades', 5), rated(index, 'dead-cells', 5)];
    const similarityOf = jest.fn((liked: LikedGame) => sourceSimilarity(index, liked.vector));
    const keys = (only: string) =>
      recommend(index, input({ interactions, similarityOf, only }), scoringConfig).lists.map(
        ({ key }) => key,
      );

    expect(keys('main')).toEqual(['main']);
    expect(keys('theme:fantasy')).toEqual(['theme:fantasy']);
    expect(similarityOf).not.toHaveBeenCalled();
    expect(keys('game:hades')).toEqual(['game:hades']);
    expect(similarityOf).toHaveBeenCalledTimes(1);
    expect(keys('game:celeste')).toEqual([]);
  });

  it('trocar o modo muda a lista: o mais popular sobe em Populares e o menos em Descobertas', () => {
    const liked = [rated(index, 'hades', 5)];

    expect(
      slugs(recommend(index, input({ interactions: liked, mode: POPULAR }), scoringConfig))[0],
    ).toBe('popular-rogue');
    expect(
      slugs(recommend(index, input({ interactions: liked, mode: DISCOVERY }), scoringConfig))[0],
    ).toBe('obscure-rogue');
  });

  it('desempata pelo sorteio fixo do usuário, sem usar a popularidade', () => {
    // Limbo e Inside têm o mesmo vetor e a mesma popularidade.
    const limboFirst = (userId: string) => {
      const ranked = slugs(
        recommend(
          index,
          input({ userId, interactions: [rated(index, 'celeste', 5)] }),
          scoringConfig,
        ),
      );
      return ranked.indexOf('limbo') < ranked.indexOf('inside');
    };
    const users = Array.from({ length: 20 }, (_, i) => `u-${i}`);

    expect(new Set(users.map(limboFirst))).toEqual(new Set([true, false]));
    expect(users.map(limboFirst)).toEqual(users.map(limboFirst));
  });

  it('com gosto dominante e secundário, monta as prateleiras por jogo, uma por interesse e a de "em breve"', () => {
    const taste = tasteIndex();
    const result = recommend(
      taste,
      input({
        interactions: TASTE_LIBRARY.map((slug) => rated(taste, slug, 5)),
        hiddenPositions: new Set([featurePosition(taste, 'indie')]),
      }),
      scoringConfig,
    );

    // Os oito jogos têm o mesmo peso, e todos estão em alguma prateleira de interesse: sem data,
    // vale o id do jogo.
    expect(result.lists.map(({ key }) => key)).toEqual([
      'main',
      'game:dread-1',
      'game:dread-2',
      'theme:action',
      'theme:horror',
      'upcoming',
    ]);
  });

  it('com Aventura nos dois gostos, a principal ainda intercala os dois (regressão do B-71)', () => {
    const generic = genericIndex();
    const listsWith = (interestMaxDocumentRatio: number) =>
      recommend(
        generic,
        input({ interactions: GENERIC_LIBRARY.map((slug) => rated(generic, slug, 5)) }),
        { ...scoringConfig, lists: { ...scoringConfig.lists, interestMaxDocumentRatio } },
      ).lists;

    expect(listsWith(1).map(({ key, kind }) => (kind === 'liked-game' ? kind : key))).toEqual([
      'main',
      'liked-game',
      'liked-game',
      'genre:adventure',
      'upcoming',
    ]);

    const lists = listsWith(scoringConfig.lists.interestMaxDocumentRatio);
    expect(lists.filter(({ kind }) => kind === 'interest')).toHaveLength(2);
    // Cotas de 75% e 25%: o gosto secundário entra na 3ª posição.
    expect(lists[0]!.games.slice(0, 4).map(({ slug }) => slug.split('-')[0])).toEqual([
      'quest',
      'quest',
      'scare',
      'quest',
    ]);
  });

  it('o mesmo estado gera sempre as mesmas listas', () => {
    const state = input({
      mode: DISCOVERY,
      interactions: [
        rated(index, 'celeste', 5),
        rated(index, 'hades', 2),
        rated(index, 'inside', 4),
      ],
      preferencePositions: [featurePosition(index, 'puzzle')],
    });

    expect(recommend(scoringIndex(), state, scoringConfig).lists).toEqual(
      recommend(index, state, scoringConfig).lists,
    );
  });
});
