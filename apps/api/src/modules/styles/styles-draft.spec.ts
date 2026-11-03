import { readStylesDraft, styleMatcher } from './styles-draft';

describe('readStylesDraft', () => {
  it('lê e valida o rascunho versionado, com slugs únicos', () => {
    const { styles } = readStylesDraft();
    const slugs = styles.map(({ slug }) => slug);

    expect(styles.length).toBeGreaterThanOrEqual(30);
    expect(styles.length).toBeLessThanOrEqual(50);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('styleMatcher', () => {
  const match = styleMatcher([
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
      summaryTerms: ['cozy'],
    },
  ]);

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
