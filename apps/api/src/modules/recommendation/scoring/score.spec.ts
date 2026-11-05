import { DiscoveryMode } from '../../../generated/prisma/client';
import { buildProfile, type Interaction } from './profile';
import { scoreCandidates } from './score';
import { candidateList, rated, scoringConfig, scoringIndex } from './scoring.fixture';

const { POPULAR, BALANCED, DISCOVERY } = DiscoveryMode;

describe('scoreCandidates', () => {
  const index = scoringIndex();

  function score(interactions: Interaction[], mode: DiscoveryMode = BALANCED) {
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    const excludedGameIds = new Set(interactions.map((i) => i.gameId));
    return candidateList(
      index,
      scoreCandidates(index, profile, { mode, excludedGameIds }, scoringConfig),
    );
  }
  const slugs = (scored: ReturnType<typeof score>) => scored.map(({ game }) => game.slug);

  it('quem gostou de Dead Cells tem o Spelunky, que divide três atributos com ele, como o mais parecido', () => {
    const scored = score([rated(index, 'dead-cells', 5)]);
    const best = scored.reduce((a, b) => (b.similarity > a.similarity ? b : a));

    expect(best.game.slug).toBe('spelunky');
  });

  it('deixa de fora o jogo avaliado, o de vetor vazio e os sem nada em comum', () => {
    const scored = slugs(score([rated(index, 'dead-cells', 5)]));

    expect(scored).not.toContain('dead-cells');
    expect(scored).not.toContain('no-tags');
    expect(scored).not.toContain('horror-only');
    expect(scored).not.toContain('climb-only');
  });

  it('pontua todos os candidatos, sem corte', () => {
    expect(slugs(score([rated(index, 'hades', 5)])).sort()).toEqual([
      'dead-cells',
      'obscure-rogue',
      'popular-rogue',
      'spelunky',
    ]);
  });

  it('pontua cos − λ · pop em cada modo', () => {
    for (const mode of [POPULAR, BALANCED, DISCOVERY]) {
      const lambda = scoringConfig.popularityWeightByMode[mode];

      for (const { game, similarity, score: value } of score(
        [rated(index, 'dead-cells', 5)],
        mode,
      )) {
        expect(value).toBeCloseTo(similarity - lambda * game.popularityNorm, 12);
      }
    }
  });

  it('não pontua nada com o perfil vazio', () => {
    expect(score([rated(index, 'hades', 3)])).toEqual([]);
  });
});
