import { normalizedPopularity, PopularityQuantizationError, popularityScale } from './popularity';

const UNIT = 0.000001134116025;

describe('popularityScale', () => {
  it('reconstrói a contagem pela menor fração e registra o máximo e a mediana', () => {
    const scale = popularityScale([UNIT, 5 * UNIT, 2 * UNIT, 763 * UNIT, 0]);

    expect(scale).toEqual({ unit: UNIT, maxCount: 763, medianCount: 3.5 });
  });

  it('falha quando algum valor não é múltiplo inteiro da menor fração', () => {
    const run = () => popularityScale([UNIT, 2 * UNIT, 2.5 * UNIT, 7.4 * UNIT]);

    expect(run).toThrow(PopularityQuantizationError);
    expect(run).toThrow('2 de 4');
  });

  it('não define escala sem nenhum valor positivo', () => {
    expect(popularityScale([0, 0])).toBeNull();
  });
});

describe('normalizedPopularity', () => {
  const scale = popularityScale([UNIT, 5 * UNIT, 763 * UNIT])!;

  it('aplica a escala logarítmica sobre a contagem, não sobre a fração', () => {
    expect(normalizedPopularity(763 * UNIT, scale)).toBe(1);
    expect(normalizedPopularity(5 * UNIT, scale)).toBeCloseTo(Math.log(6) / Math.log(764), 12);
    expect(normalizedPopularity(5 * UNIT, scale)).toBeGreaterThan(0.25);
  });

  it('dá zero ao jogo sem valor', () => {
    expect(normalizedPopularity(0, scale)).toBe(0);
    expect(normalizedPopularity(0, null)).toBe(0);
  });
});
