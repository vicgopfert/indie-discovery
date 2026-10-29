import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from '../ingestion/igdb/igdb.mapper';
import { FeatureLabels, featureLabelsConfigSchema } from './feature-labels';

const FIXTURES_DIR = join(__dirname, '../../../test/fixtures/igdb');

type FixtureGame = { genres?: { name: string }[]; themes?: { name: string }[] };

function fixtureSlugs(field: 'genres' | 'themes') {
  const games = readdirSync(FIXTURES_DIR)
    .filter((file) => file.startsWith('games.'))
    .flatMap((file) => JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as FixtureGame[]);
  return new Set(games.flatMap((game) => (game[field] ?? []).map(({ name }) => slugify(name))));
}

const config = (overrides: Partial<Record<'GENRE' | 'THEME', Record<string, string>>> = {}) =>
  featureLabelsConfigSchema.parse({
    labelsRationale: 'motivo',
    labels: { GENRE: { puzzle: 'Quebra-cabeça' }, THEME: {}, ...overrides },
    hiddenFromFilters: { GENRE: ['indie'], THEME: [] },
    hiddenRationale: 'motivo',
  });

describe('FeatureLabels', () => {
  const labels = FeatureLabels.fromFile();

  it('o arquivo versionado traduz todos os gêneros e temas das fixtures da IGDB', () => {
    const missing = [
      ...[...fixtureSlugs('genres')].filter((slug) => labels.name('GENRE', slug, '') === ''),
      ...[...fixtureSlugs('themes')].filter((slug) => labels.name('THEME', slug, '') === ''),
    ];

    expect(missing).toEqual([]);
  });

  it('traduz pelo slug', () => {
    expect(labels.name('GENRE', 'role-playing-rpg', 'Role-playing (RPG)')).toBe('RPG');
    expect(labels.name('THEME', 'horror', 'Horror')).toBe('Terror');
  });

  it('slug sem tradução usa o nome da IGDB', () => {
    expect(new FeatureLabels(config()).name('GENRE', 'novo-genero', 'New Genre')).toBe('New Genre');
  });

  it('esconde o gênero Indie dos filtros', () => {
    expect(labels.isHidden('GENRE', 'indie')).toBe(true);
    expect(labels.isHidden('GENRE', 'puzzle')).toBe(false);
  });

  it('recusa tradução vazia', () => {
    expect(() => config({ GENRE: { puzzle: '  ' } })).toThrow();
  });
});
