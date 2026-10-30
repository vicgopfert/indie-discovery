import {
  catalogPopularityScale,
  normalizedPopularity,
  PopularityQuantizationError,
  PopularityUnitMismatchError,
  popularityScale,
  reconstructedCount,
} from './popularity';

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

describe('catalogPopularityScale', () => {
  it('usa o máximo e a mediana do catálogo quando a unidade coincide', () => {
    const signal = popularityScale([1, 2, 5, 40].map((count) => count * UNIT));

    expect(
      catalogPopularityScale(
        [1, 5, 7].map((count) => count * UNIT),
        signal,
      ),
    ).toEqual({
      unit: UNIT,
      maxCount: 7,
      medianCount: 5,
    });
  });

  it('falha quando a unidade do catálogo diverge da do conjunto avaliado', () => {
    const signal = popularityScale([1, 6].map((count) => count * UNIT));

    expect(() =>
      catalogPopularityScale(
        [2, 6].map((count) => count * UNIT),
        signal,
      ),
    ).toThrow(PopularityUnitMismatchError);
  });
});

describe('reconstructedCount', () => {
  const scale = popularityScale([UNIT, 5 * UNIT, 763 * UNIT])!;

  it('converte a fração da IGDB em número de pessoas', () => {
    expect(reconstructedCount(5 * UNIT, scale)).toBe(5);
    expect(reconstructedCount(0, scale)).toBe(0);
    expect(reconstructedCount(5 * UNIT, null)).toBe(0);
  });

  it('dá a mesma contagem quando a base de usuários da IGDB cresce', () => {
    const grownUnit = 0.000001132616991;
    const grown = popularityScale([grownUnit, 5 * grownUnit, 764 * grownUnit])!;

    expect(reconstructedCount(5 * grownUnit, grown)).toBe(reconstructedCount(5 * UNIT, scale));
  });
});

describe('normalizedPopularity', () => {
  const scale = popularityScale([UNIT, 5 * UNIT, 763 * UNIT])!;

  it('aplica a escala logarítmica sobre a contagem, não sobre a fração', () => {
    expect(normalizedPopularity(763, scale)).toBe(1);
    expect(normalizedPopularity(5, scale)).toBeCloseTo(Math.log(6) / Math.log(764), 12);
    expect(normalizedPopularity(5, scale)).toBeGreaterThan(0.25);
  });

  it('dá zero ao jogo sem valor', () => {
    expect(normalizedPopularity(0, scale)).toBe(0);
    expect(normalizedPopularity(0, null)).toBe(0);
  });
});
