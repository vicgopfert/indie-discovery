import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCollectionsConfig } from './collections.config';

const game = (igdbId: number) => ({ igdbId, name: `Jogo ${igdbId}` });

const collection = (slug: string, overrides: Record<string, unknown> = {}) => ({
  slug,
  name: `Coleção ${slug}`,
  description: 'Descrição',
  scope: 'Escopo',
  published: true,
  suggest: { keywords: ['brazil'], summaryTerms: ['Brazil'], wikidataPlaces: ['Q155'] },
  games: [game(1), game(2)],
  rejected: [],
  ...overrides,
});

const config = (collections: unknown[]) => ({
  curationPolicy: 'Política',
  minGames: 2,
  minGamesRationale: 'Motivo',
  collections,
});

function fromCopy(content: unknown) {
  const file = join(mkdtempSync(join(tmpdir(), 'collections-')), 'collections.json');
  writeFileSync(file, JSON.stringify(content));
  return () => readCollectionsConfig(file);
}

describe('arquivo de coleções', () => {
  it('lê e valida o arquivo versionado', () => {
    const { minGames, collections } = readCollectionsConfig();

    expect(minGames).toBe(10);
    for (const c of collections) expect(c.games.length).toBeGreaterThanOrEqual(minGames);
  });

  it('aceita uma coleção no mínimo de jogos', () => {
    expect(fromCopy(config([collection('brasil')]))().collections).toHaveLength(1);
  });

  it('aceita rascunho abaixo do mínimo', () => {
    const draft = collection('brasil', { published: false, games: [] });

    expect(fromCopy(config([draft]))().collections).toHaveLength(1);
  });

  it.each<[string, unknown[], string]>([
    ['abaixo do mínimo', [collection('brasil', { games: [game(1)] })], 'abaixo do mínimo de 2'],
    ['com slug repetido', [collection('brasil'), collection('brasil')], 'Slug de coleção repetido'],
    ['com slug fora do padrão', [collection('Brasil Antigo')], 'Invalid string'],
    [
      'com jogo repetido',
      [collection('brasil', { games: [game(1), game(1)] })],
      'Jogo repetido na coleção',
    ],
    [
      'com jogo aprovado e recusado',
      [collection('brasil', { rejected: [{ ...game(2), reason: 'Só cita o país' }] })],
      'aprovado e recusado',
    ],
    ['com recusado sem motivo', [collection('brasil', { rejected: [game(3)] })], 'reason'],
    [
      'com lugar do Wikidata fora do formato',
      [
        collection('brasil', {
          suggest: { keywords: [], summaryTerms: [], wikidataPlaces: ['Brasil'] },
        }),
      ],
      'Invalid string',
    ],
  ])('recusa coleção %s', (_, collections, message) => {
    expect(fromCopy(config(collections))).toThrow(message);
  });
});
