import { mulberry32, sample, seedOf, weightedSample } from './random';

describe('sorteios com semente', () => {
  it('a mesma semente dá a mesma sequência, e outra semente dá outra', () => {
    const draw = (seed: number) => Array.from({ length: 5 }, mulberry32(seed));

    expect(draw(71)).toEqual(draw(71));
    expect(draw(71)).not.toEqual(draw(72));
  });

  it('a semente de uma combinação não depende de outras combinações', () => {
    expect(seedOf(71, 'random', 'perfil-1')).toBe(seedOf(71, 'random', 'perfil-1'));
    expect(seedOf(71, 'random', 'perfil-1')).not.toBe(seedOf(71, 'random', 'perfil-2'));
  });

  it('sample devolve itens distintos e recusa pedir mais do que há', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const picked = sample(mulberry32(1), items, 4);

    expect(new Set(picked).size).toBe(4);
    expect(picked.every((item) => items.includes(item))).toBe(true);
    expect(() => sample(mulberry32(1), items, 6)).toThrow('Não há 6 itens');
  });

  it('weightedSample não sorteia peso zero nem repete item', () => {
    const weights: Record<string, number> = { a: 0, b: 1, c: 5, d: 0, e: 2 };
    const picked = weightedSample(mulberry32(3), Object.keys(weights), (k) => weights[k]!, 3);

    expect([...picked].sort()).toEqual(['b', 'c', 'e']);
    expect(() =>
      weightedSample(mulberry32(3), Object.keys(weights), (k) => weights[k]!, 4),
    ).toThrow('peso positivo');
  });

  it('weightedSample sorteia na proporção do peso', () => {
    const random = mulberry32(5);
    const counts = { raro: 0, comum: 0 };
    for (let i = 0; i < 4000; i++) {
      const [item] = weightedSample(
        random,
        ['raro', 'comum'] as const,
        (k) => (k === 'raro' ? 1 : 9),
        1,
      );
      counts[item!]++;
    }

    expect(counts.comum / 4000).toBeCloseTo(0.9, 1);
  });
});
