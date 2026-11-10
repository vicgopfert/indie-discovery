import { gameId, gameOf, shelfIndex } from './scoring.fixture';
import { SimilarityCache, sourceSimilarity } from './source-similarity';

describe('sourceSimilarity', () => {
  const index = shelfIndex();
  const cosine = (a: string, b: string) => {
    const x = gameOf(index, a);
    const y = gameOf(index, b);
    let dot = 0;
    x.featurePositions.forEach((p, i) => {
      const j = y.featurePositions.indexOf(p);
      if (j >= 0) dot += x.weights[i]! * y.weights[j]!;
    });
    return dot;
  };

  it('traz, em ordem de posição, os jogos do índice com algum atributo do jogo de origem', () => {
    const { positions, values } = sourceSimilarity(index, gameOf(index, 'celeste'));
    const slugs = [...positions].map((p) => index.games[p]!.slug);

    expect([...positions]).toEqual([...positions].sort((a, b) => a - b));
    expect(slugs.sort()).toEqual(
      [
        'celeste',
        'dead',
        'hades',
        'hard-a',
        'hard-b',
        'hollow',
        'metro-a',
        'metro-b',
        'plat-a',
      ].sort(),
    );
    [...positions].forEach((p, j) => {
      expect(values[j]).toBeCloseTo(cosine('celeste', index.games[p]!.slug), 12);
    });
  });

  it('deixa de fora quem não divide nenhum atributo', () => {
    const { positions } = sourceSimilarity(index, gameOf(index, 'amnesia'));

    expect([...positions].map((p) => index.games[p]!.slug).sort()).toEqual(['amnesia', 'fright-a']);
  });
});

describe('SimilarityCache', () => {
  const index = shelfIndex();
  const liked = (slug: string) => ({ gameId: gameId(slug), slug, vector: gameOf(index, slug) });

  it('guarda a semelhança por jogo: a segunda vez devolve a mesma', () => {
    const cache = new SimilarityCache(index, 2);
    const first = cache.of(liked('celeste'));

    expect(cache.of(liked('celeste'))).toBe(first);
    expect(first).toEqual(sourceSimilarity(index, gameOf(index, 'celeste')));
  });

  it('acima do limite, sai o usado há mais tempo', () => {
    const cache = new SimilarityCache(index, 2);
    const celeste = cache.of(liked('celeste'));
    const hades = cache.of(liked('hades'));
    cache.of(liked('celeste'));
    cache.of(liked('amnesia'));

    expect(cache.size).toBe(2);
    expect(cache.of(liked('celeste'))).toBe(celeste);
    expect(cache.of(liked('hades'))).not.toBe(hades);
  });

  it('com limite zero, não guarda nada', () => {
    const cache = new SimilarityCache(index, 0);
    const first = cache.of(liked('celeste'));

    expect(cache.size).toBe(0);
    expect(cache.of(liked('celeste'))).not.toBe(first);
  });
});
