import { DiscoveryMode } from '../../../generated/prisma/client';
import { buildProfile, type Interaction } from './profile';
import { rankCandidates } from './rank';
import { rated, scoringConfig, scoringIndex } from './scoring.fixture';
import { userTieBreak } from './tie-break';

const { POPULAR, BALANCED, DISCOVERY } = DiscoveryMode;

describe('rankCandidates', () => {
  const index = scoringIndex();

  function rank(
    interactions: Interaction[],
    mode: DiscoveryMode = BALANCED,
    limit = 10,
    userId = 'u-1',
  ) {
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    const excludedGameIds = new Set(interactions.map((i) => i.gameId));
    return rankCandidates(
      index,
      profile,
      { mode, limit, excludedGameIds, tieBreak: userTieBreak(userId) },
      scoringConfig,
    );
  }
  const slugs = (ranked: ReturnType<typeof rank>) => ranked.map(({ game }) => game.slug);

  it('quem gostou de Dead Cells recebe primeiro o Spelunky, que divide três atributos com ele', () => {
    expect(slugs(rank([rated(index, 'dead-cells', 5)]))[0]).toBe('spelunky');
  });

  it('deixa de fora o jogo avaliado, o de vetor vazio e os sem nada em comum', () => {
    const ranked = slugs(rank([rated(index, 'dead-cells', 5)]));

    expect(ranked).not.toContain('dead-cells');
    expect(ranked).not.toContain('no-tags');
    expect(ranked).not.toContain('horror-only');
    expect(ranked).not.toContain('climb-only');
  });

  it('devolve menos itens que o limite quando há poucos candidatos, sem completar', () => {
    expect(slugs(rank([rated(index, 'hades', 5)]))).toHaveLength(4);
  });

  it('pontua cos − λ · pop e ordena pela pontuação, em cada modo', () => {
    for (const mode of [POPULAR, BALANCED, DISCOVERY]) {
      const ranked = rank([rated(index, 'dead-cells', 5)], mode);
      const lambda = scoringConfig.popularityWeightByMode[mode];

      for (const { game, similarity, score } of ranked) {
        expect(score).toBeCloseTo(similarity - lambda * game.popularityNorm, 12);
      }
      const scores = ranked.map(({ score }) => score);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    }
  });

  it('trocar o modo muda a lista: o mais popular sobe em Populares e o menos em Descobertas', () => {
    const liked = [rated(index, 'hades', 5)];

    expect(slugs(rank(liked, POPULAR))[0]).toBe('popular-rogue');
    expect(slugs(rank(liked, DISCOVERY))[0]).toBe('obscure-rogue');
  });

  it('desempata pelo sorteio fixo do usuário, sem usar a popularidade', () => {
    // Limbo e Inside têm o mesmo vetor e a mesma popularidade.
    const limboFirst = (userId: string) => {
      const ranked = slugs(rank([rated(index, 'celeste', 5)], BALANCED, 10, userId));
      return ranked.indexOf('limbo') < ranked.indexOf('inside');
    };
    const users = Array.from({ length: 20 }, (_, i) => `u-${i}`);

    expect(new Set(users.map(limboFirst))).toEqual(new Set([true, false]));
    expect(users.map(limboFirst)).toEqual(users.map(limboFirst));
  });

  it('marca "pouco conhecido" no modo Descobertas quando só a popularidade pôs o jogo na lista', () => {
    // Pelo cosseno, o primeiro seria o Spelunky, sozinho.
    const liked = [rated(index, 'dead-cells', 5)];

    expect(rank(liked, DISCOVERY, 1).map(({ game, lowKnown }) => [game.slug, lowKnown])).toEqual([
      ['obscure-rogue', true],
    ]);
    expect(rank(liked, DISCOVERY, 2).find(({ game }) => game.slug === 'spelunky')).toMatchObject({
      lowKnown: false,
    });
  });

  it('não marca "pouco conhecido" fora do modo Descobertas', () => {
    for (const mode of [POPULAR, BALANCED]) {
      expect(rank([rated(index, 'dead-cells', 5)], mode, 2).some((r) => r.lowKnown)).toBe(false);
    }
  });

  it('não recomenda nada com o perfil vazio', () => {
    expect(rank([rated(index, 'hades', 3)])).toEqual([]);
  });
});
