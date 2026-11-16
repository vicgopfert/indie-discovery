import { differenceText, intervalText, methodLabel, renderReport, renderRound2 } from './report';
import { ALL, type GroupResult } from './results';
import { METHODS } from './run';

const group = (stratum: string, hit: number | null): GroupResult => ({
  family: 'attribute',
  sampling: 'uniform',
  stratum,
  profiles: 2,
  holdouts: 8,
  methods: METHODS.map((method) => ({
    method,
    hit: { 10: hit, 20: hit },
    list: {
      catalogCoverage: 0.5,
      averagePopularity: 0.25,
      upcoming: 0,
      interestCoverage: 1,
      genreThemeCoverage: null,
      preferenceCoverage: null,
    },
    lowKnown: method.startsWith('DISCOVERY') ? 0.4 : null,
  })),
  overlap: { balancedDiscovery: 0.3, popularBalanced: 0.9 },
});

describe('relatório da avaliação offline', () => {
  it('nomeia os métodos em português', () => {
    expect(methodLabel('DISCOVERY/interleaved')).toBe('Descobertas, intercalada');
    expect(methodLabel('POPULAR/single')).toBe('Populares, lista única');
    expect(methodLabel('popular')).toBe('Populares dos gêneros e temas (alternativa 1)');
  });

  it('mostra a diferença e o intervalo em pontos percentuais', () => {
    expect(differenceText({ difference: 0.0123, low: -0.004, high: 0.03 })).toBe(
      '+1,23 [-0,40; +3,00]',
    );
    expect(differenceText(null)).toBe('—');
  });

  it('traz uma tabela por família e o acerto por tipo de atributo', () => {
    const markdown = renderReport({
      title: 'Avaliação offline: teste',
      meta: { Semente: 71 },
      profiles: [
        { family: 'attribute', sampling: 'uniform', stratum: 'GENRE', count: 2, attributes: 2 },
      ],
      cutoffs: [10, 20],
      groups: [group(ALL, 0.125), group('GENRE', 0.25)],
      comparisons: [],
      criteria: null,
    });

    expect(markdown).toContain('### A, por atributo, uniforme');
    expect(markdown).toContain('| Equilibrado, intercalada | 12,50% | 12,50% | 50,0% | 0,250 |');
    expect(markdown).toContain('## Acerto por tipo de atributo (família A)');
    expect(markdown).toContain('| Descobertas, intercalada | 25,00% | 25,00% |');
    expect(markdown).toContain('Equilibrado × Descobertas 30,0%');
  });
});

describe('relatório da rodada 2', () => {
  it('escreve intervalos na unidade de cada condição', () => {
    expect(intervalText({ value: 0.0123, low: -0.004, high: 0.03 }, 'points')).toBe(
      '+1,23 [-0,40; +3,00]',
    );
    expect(intervalText({ value: 0.5, low: 0.45, high: 0.55 }, 'percent')).toBe(
      '50,0% [45,0%; 55,0%]',
    );
    expect(intervalText({ value: 0.8, low: 0.6, high: Infinity }, 'ratio')).toBe('0,80 [0,60; ∞]');
  });

  it('mostra a decisão de cada regra, as condições de cada valor e a coluna da reserva', () => {
    const markdown = renderRound2({
      title: 'Rodada 2',
      meta: {},
      chosen: { β: '1' },
      upcoming: [
        {
          family: 'attribute',
          sampling: 'uniform',
          stratum: ALL,
          mode: 'DISCOVERY',
          share: 0.4,
          dominates: false,
        },
      ],
      rules: [
        {
          rule: 'c',
          title: 'λ do Descobertas e do Populares, por pares',
          current: '0,3; −0,2',
          chosen: '0,3; −0,2',
          note: 'Nenhum par passa.',
          candidates: [
            {
              name: '0,3; −0,2',
              value: null,
              passes: false,
              eligible: true,
              checks: [
                {
                  group: { family: 'coherent', sampling: 'popularity', stratum: ALL },
                  condition: '"pouco conhecido"@20',
                  unit: 'percent',
                  interval: { value: 0.55, low: 0.5, high: 0.6 },
                  threshold: 0.5,
                  side: 'atMost',
                  passes: false,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(markdown).toContain('## Regra c: λ do Descobertas e do Populares, por pares');
    expect(markdown).toContain(
      '| Valor | Passa | Condições que falham | Cumpre o que o atual cumpre |',
    );
    expect(markdown).toContain('| 0,3; −0,2 | não | 1 de 1 | sim |');
    expect(markdown).toContain(
      '| B, coerentes, pela popularidade | "pouco conhecido"@20 | 55,0% [50,0%; 60,0%] | inteiro ≤ 50,0% | não passa |',
    );
    expect(markdown).toContain('| A, por atributo, uniforme | Descobertas | 40,0% | não |');
  });
});
