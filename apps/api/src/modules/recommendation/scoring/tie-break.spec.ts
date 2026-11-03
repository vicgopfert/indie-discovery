import { topBy, userTieBreak } from './tie-break';

describe('userTieBreak', () => {
  const games = Array.from({ length: 20 }, (_, i) => `g-${i}`);
  const orderFor = (userId: string) => [...games].sort(userTieBreak(userId));

  it('dá sempre a mesma ordem para o mesmo usuário', () => {
    expect(orderFor('u-1')).toEqual(orderFor('u-1'));
  });

  it('dá ordens diferentes para usuários diferentes', () => {
    expect(orderFor('u-1')).not.toEqual(orderFor('u-2'));
  });

  it('só empata o jogo consigo mesmo', () => {
    const tieBreak = userTieBreak('u-1');

    expect(tieBreak('g-1', 'g-1')).toBe(0);
    expect(tieBreak('g-1', 'g-2')).toBe(-tieBreak('g-2', 'g-1'));
    expect(tieBreak('g-1', 'g-2')).not.toBe(0);
  });
});

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
