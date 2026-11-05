import { userTieBreak } from './tie-break';
import { kthLargest, topBy } from './top';

describe('topBy', () => {
  // Muitos empates, inclusive no corte.
  const items = Array.from({ length: 200 }, (_, i) => ({ id: `g-${i}`, value: i % 7 }));
  const value = (item: (typeof items)[number]) => item.value;
  const id = (item: (typeof items)[number]) => item.id;

  it('dá o mesmo resultado que ordenar tudo e cortar', () => {
    for (const limit of [1, 5, 28, 29, 30, 199, 200, 500]) {
      const tieBreak = userTieBreak('u-1');
      const sorted = [...items]
        .sort((a, b) => b.value - a.value || tieBreak(a.id, b.id))
        .slice(0, limit);

      expect(topBy(items, value, id, limit, tieBreak)).toEqual(sorted);
    }
  });
});

describe('kthLargest', () => {
  it('dá o mesmo corte que ordenar tudo, com repetidos, negativos e zero', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const length of [1, 2, 3, 10, 101, 1000]) {
      const values = Array.from({ length }, () => Math.round((random() - 0.3) * 20) / 4);
      const sorted = Float64Array.from(values).sort();
      for (const k of new Set([1, 2, Math.ceil(length / 2), length].filter((k) => k <= length))) {
        expect(kthLargest(Float64Array.from(values), k)).toBe(sorted[length - k]);
      }
    }
  });
});
