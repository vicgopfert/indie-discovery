import {
  type CuratedStyle,
  readStylesConfig,
  styleAssigner,
  styleMatcher,
  stylesConfigSchema,
} from './styles';

const styles: CuratedStyle[] = [
  {
    slug: 'roguelike',
    name: 'Roguelike',
    category: 'gameplay',
    keywords: ['roguelike', 'roguelite'],
    summaryTerms: ['roguelike', 'rogue-lite'],
  },
  {
    slug: 'cozy',
    name: 'Aconchegante',
    category: 'tone',
    keywords: ['cozy'],
    summaryTerms: ['cozy', 'cosy'],
  },
];

describe('readStylesConfig', () => {
  it('lê e valida o arquivo versionado, com 30 a 50 estilos', () => {
    const config = readStylesConfig();

    expect(config.styles.length).toBeGreaterThanOrEqual(30);
    expect(config.styles.length).toBeLessThanOrEqual(50);
  });

  it('recusa slug repetido e palavra-chave em dois estilos', () => {
    const parse = (list: CuratedStyle[]) =>
      stylesConfigSchema.safeParse({ rule: 'regra', styles: list }).success;

    expect(parse(styles)).toBe(true);
    expect(parse([...styles, { ...styles[1]!, keywords: ['other'] }])).toBe(false);
    expect(parse([...styles, { ...styles[1]!, slug: 'other', keywords: ['Roguelite'] }])).toBe(
      false,
    );
  });
});

describe('styleMatcher', () => {
  const match = styleMatcher(styles);

  it('casa a palavra-chave pelo slug e o termo do resumo, com o trecho', () => {
    expect(
      match({ keywords: ['roguelite', 'pixel-art'], summary: 'A cozy farming game.' }),
    ).toEqual([
      { style: 'roguelike', source: 'keyword', term: 'roguelite' },
      { style: 'cozy', source: 'summary', term: 'cozy', excerpt: 'A cozy farming game.' },
    ]);
  });

  it('procura o termo como palavra inteira, sem diferenciar maiúsculas', () => {
    expect(match({ keywords: [], summary: 'A ROGUE-LITE dungeon.' })).toMatchObject([
      { style: 'roguelike', source: 'summary', term: 'rogue-lite' },
    ]);
    expect(match({ keywords: [], summary: 'Cozyness is not a word.' })).toEqual([]);
  });

  it('um estilo pode casar pela palavra-chave e pelo resumo', () => {
    expect(
      match({ keywords: ['roguelike'], summary: 'A roguelike.' }).map((m) => m.source),
    ).toEqual(['keyword', 'summary']);
  });
});

describe('styleAssigner', () => {
  const assign = styleAssigner(styles);

  it('devolve os índices dos estilos do jogo, na ordem do arquivo', () => {
    expect(assign({ keywords: ['cozy', 'roguelite'], summary: '' })).toEqual([0, 1]);
    expect(assign({ keywords: ['pixel-art'], summary: 'A cosy little game.' })).toEqual([1]);
    expect(assign({ keywords: [], summary: 'Cozyness and rogue-lites.' })).toEqual([]);
  });

  it('acha o termo que é prefixo de outro e o que começa dentro de outro', () => {
    const overlapping: CuratedStyle[] = [
      { ...styles[0]!, slug: 'a', keywords: [], summaryTerms: ['survival horror'] },
      { ...styles[0]!, slug: 'b', keywords: [], summaryTerms: ['survival'] },
      { ...styles[0]!, slug: 'c', keywords: [], summaryTerms: ['horror classic'] },
      { ...styles[0]!, slug: 'd', keywords: [], summaryTerms: ['surv'] },
    ];
    const game = { keywords: [], summary: 'A Survival Horror classic.' };

    expect(styleAssigner(overlapping)(game)).toEqual([0, 1, 2]);
    expect(styleMatcher(overlapping)(game).map((m) => m.style)).toEqual(['a', 'b', 'c']);
  });

  it('dá os mesmos estilos que styleMatcher', () => {
    const match = styleMatcher(styles);
    const cases = [
      { keywords: ['roguelike'], summary: 'A COSY roguelike.' },
      { keywords: [], summary: 'Rogue-lite, cozy.' },
      { keywords: ['ROGUELITE'], summary: 'nothing here' },
      { keywords: [], summary: 'roguelikes and cozyness' },
    ];
    for (const game of cases) {
      const expected = [
        ...new Set(match(game).map((m) => styles.findIndex((s) => s.slug === m.style))),
      ];
      expect(assign(game)).toEqual(expected.sort((a, b) => a - b));
    }
  });
});
