import { userTieBreak } from './tie-break';

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
