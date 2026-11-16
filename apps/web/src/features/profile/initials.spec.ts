import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it.each([
    ['Victor Gopfert', 'VG'],
    ['Ana', 'A'],
    ['ana maria souza', 'AS'],
    ['  Bruno   Lima  ', 'BL'],
    ['Maria da Silva', 'MS'],
    ['João dos Santos e Souza', 'JS'],
    ['Élida Ávila', 'ÉÁ'],
    ['de', 'D'],
    ['Da Costa', 'C'],
  ])('"%s" vira "%s"', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('não quebra um emoji composto ao meio', () => {
    expect(initials('👩‍💻 Dev')).toBe('👩‍💻D');
  });

  it('nome em branco não tem iniciais', () => {
    expect(initials('   ')).toBe('');
  });
});
