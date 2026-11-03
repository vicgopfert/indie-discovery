import { popularFallback } from './fallback';
import { featurePosition, gameId, scoringIndex } from './scoring.fixture';
import { userTieBreak } from './tie-break';

describe('popularFallback', () => {
  const index = scoringIndex();

  function fallback(preferences: string[], excluded: string[] = [], limit = 4) {
    return popularFallback(index, {
      limit,
      excludedGameIds: new Set(excluded.map(gameId)),
      preferencePositions: preferences.map((p) => featurePosition(index, p)),
      tieBreak: userTieBreak('u-1'),
    });
  }

  it('traz os mais populares dos gêneros e temas preferidos, com eles como motivo', () => {
    const items = fallback(['fantasy'], ['hades']);

    expect(items.map(({ game }) => game.slug)).toEqual([
      'popular-rogue',
      'dead-cells',
      'obscure-rogue',
    ]);
    for (const { reason } of items) {
      expect(reason).toEqual({
        kind: 'features',
        features: [expect.objectContaining({ slug: 'fantasy' })],
      });
    }
  });

  it('sem preferências, traz os mais populares do catálogo, sem motivo e sem o vetor vazio', () => {
    const items = fallback([], ['hades']);

    expect(items.map(({ game }) => game.slug).slice(0, 2)).toEqual(['popular-rogue', 'celeste']);
    expect(items.map(({ game }) => game.slug)).not.toContain('no-tags');
    expect(items.every(({ reason }) => reason === null)).toBe(true);
  });

  it('usa o catálogo inteiro quando nenhum candidato tem um preferido', () => {
    const items = fallback(['horror'], ['inside', 'limbo', 'horror-only']);

    expect(items.map(({ game }) => game.slug)[0]).toBe('popular-rogue');
  });
});
