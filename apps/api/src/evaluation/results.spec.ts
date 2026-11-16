import { readTfidfConfig } from '../modules/recommendation/tfidf';
import { scoringConfig } from '../modules/recommendation/scoring/scoring.fixture';
import { readEvaluationConfig } from './evaluation-config';
import type { EvaluationProfile } from './profiles';
import { ALL, baselineComparisons, groupOutcomes, summarize, variantsOf } from './results';
import { METHODS, type Method, type ProfileOutcome } from './run';

const evaluation = readEvaluationConfig();
const tfidf = readTfidfConfig();
const bootstrap = { seed: 1, resamples: 200, confidence: 0.95 };

function outcome(
  id: string,
  profile: Partial<EvaluationProfile>,
  rank: Partial<Record<Method, number>> = {},
): ProfileOutcome {
  const holdouts = profile.holdouts ?? ['h'];
  return {
    profile: {
      id,
      family: 'attribute',
      sampling: 'uniform',
      stratum: 'GENRE',
      ratings: [],
      preferencePositions: [],
      ...profile,
      holdouts,
    },
    interests: [],
    genresAndThemes: [],
    lists: new Map(METHODS.map((m) => [m, { games: [], lowKnown: null }])),
    ranks: new Map(METHODS.map((m) => [m, holdouts.map(() => rank[m] ?? -1)])),
  };
}

describe('grupos e comparações', () => {
  const outcomes = [
    outcome('g1', { stratum: 'GENRE' }, { 'BALANCED/interleaved': 0 }),
    outcome('t1', { stratum: 'THEME' }, { 'BALANCED/interleaved': 5, 'BALANCED/single': 0 }),
    outcome('c1', { family: 'coherent', stratum: null }),
    outcome('d1', { family: 'seed', sampling: null, stratum: 'rated', holdouts: [] }),
  ];

  it('agrupa por família e amostragem, com o conjunto todo e cada estrato', () => {
    const keys = groupOutcomes(outcomes).map(
      ({ key, outcomes: group }) => `${key.family}|${key.stratum}|${group.length}`,
    );

    expect(keys).toEqual([
      `attribute|${ALL}|2`,
      'attribute|GENRE|1',
      'attribute|THEME|1',
      `coherent|${ALL}|1`,
      `seed|${ALL}|1`,
      'seed|rated|1',
    ]);
  });

  it('resume o acerto de cada método por corte', () => {
    const [attributes] = summarize(outcomes, { cutoffs: [1, 10] }, 100);
    const balanced = attributes!.methods.find(({ method }) => method === 'BALANCED/interleaved')!;

    expect(attributes!.holdouts).toBe(2);
    expect(balanced.hit).toEqual({ 1: 0.5, 10: 1 });
  });

  it('compara a intercalada com a lista única e as linhas de base, só nos grupos com escondidos', () => {
    const comparisons = baselineComparisons(outcomes, { cutoffs: [10] }, bootstrap);

    expect(comparisons.some(({ family }) => family === 'seed')).toBe(false);
    const theme = comparisons.find(
      ({ stratum, a, label }) =>
        stratum === 'THEME' && a === 'BALANCED/interleaved' && label === 'single',
    )!;
    expect(theme.b).toBe('BALANCED/single');
    expect(theme.difference[10]).toMatchObject({ difference: 0 });
    // 4 grupos com escondidos × 3 modos × 3 comparações.
    expect(comparisons).toHaveLength(36);
  });
});

describe('variantes da rodada 2', () => {
  it('cada grupo muda só o seu valor e deixa de fora o valor atual', () => {
    const limits = variantsOf('shelfLimit', evaluation, tfidf, scoringConfig);
    expect(limits.map(({ scoring }) => scoring.lists.specificMaxDocumentRatio)).toEqual(
      evaluation.variants.shelfLimit.filter(
        (limit) => limit !== scoringConfig.lists.specificMaxDocumentRatio,
      ),
    );
    expect(limits.every(({ tfidf: t, mode }) => t === tfidf && mode === null)).toBe(true);

    const weights = variantsOf('preferenceWeight', evaluation, tfidf, scoringConfig);
    expect(weights.map(({ scoring }) => scoring.preferenceWeight)).not.toContain(
      scoringConfig.preferenceWeight,
    );
  });

  it('as fatias incluem a normalização global, e o λ muda um modo de cada vez', () => {
    const shares = variantsOf('blockShares', evaluation, tfidf, scoringConfig);
    expect(shares.map(({ name }) => name)).toContain('normalização global');
    expect(shares.filter(({ tfidf: t }) => t.normalization === 'block')).toHaveLength(
      evaluation.variants.blockShares.length - 1,
    );

    for (const { scoring, mode } of variantsOf('lambda', evaluation, tfidf, scoringConfig)) {
      const changed = Object.entries(scoring.popularityWeightByMode).filter(
        ([mode, lambda]) =>
          scoringConfig.popularityWeightByMode[
            mode as keyof typeof scoring.popularityWeightByMode
          ] !== lambda,
      );
      expect(changed.map(([changedMode]) => changedMode)).toEqual([mode]);
      expect(scoring.popularityWeightByMode.BALANCED).toBe(0);
    }
  });
});
