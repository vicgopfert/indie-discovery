import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type IgdbGame, igdbGameSchema } from './igdb-game.schema';
import { mapIgdbGame, slugify } from './igdb.mapper';

const FIXTURES_DIR = join(__dirname, '../../../test/fixtures/igdb');
const NOW = new Date('2026-10-20T00:00:00Z');

function loadFixture(file: string): IgdbGame[] {
  const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as unknown[];
  return raw.map((game) => igdbGameSchema.parse(game));
}

const allGames = readdirSync(FIXTURES_DIR)
  .filter((file) => file.startsWith('games.'))
  .flatMap(loadFixture);

function fixtureGame(name: string) {
  const game = allGames.find((g) => g.name === name);
  if (!game) throw new Error(`Fixture sem o jogo ${name}`);
  return game;
}

describe('mapIgdbGame', () => {
  it('mapeia um jogo completo para o modelo interno', () => {
    const amnesia = mapIgdbGame(fixtureGame('Amnesia: The Dark Descent'), NOW);

    expect(amnesia).toMatchObject({
      igdbId: 111,
      slug: 'amnesia-the-dark-descent',
      name: 'Amnesia: The Dark Descent',
      coverImageId: 'co1qq5',
      firstReleaseDate: new Date('2010-09-08T00:00:00Z'),
      releaseStatus: 'RELEASED',
      isCancelled: false,
      storeUrl: 'http://www.amnesiagame.com',
      studioCountryCode: 752,
      ratingCount: 548,
      hypes: 0,
      companies: [
        {
          igdbId: 36,
          name: 'Frictional Games',
          countryCode: 752,
          isDeveloper: true,
          isPublisher: true,
        },
      ],
    });
    expect(amnesia.summary).toMatch(/^Amnesia: The Dark Descent is a survival horror/);
    expect(amnesia.features.filter((f) => f.type !== 'KEYWORD')).toEqual([
      { type: 'GENRE', igdbId: 9, name: 'Puzzle', slug: 'puzzle' },
      { type: 'GENRE', igdbId: 31, name: 'Adventure', slug: 'adventure' },
      { type: 'GENRE', igdbId: 32, name: 'Indie', slug: 'indie' },
      { type: 'THEME', igdbId: 1, name: 'Action', slug: 'action' },
      { type: 'THEME', igdbId: 19, name: 'Horror', slug: 'horror' },
      { type: 'THEME', igdbId: 21, name: 'Survival', slug: 'survival' },
    ]);
    expect(amnesia.features.filter((f) => f.type === 'KEYWORD')).toHaveLength(35);
    expect(amnesia.languages).toContainEqual({
      languageIgdbId: 7,
      interface: true,
      subtitles: true,
      audio: true,
    });
  });

  it('mapeia as 50 fixtures reais sem duplicar empresas, atributos ou idiomas', () => {
    expect(allGames).toHaveLength(50);
    for (const mapped of allGames.map((game) => mapIgdbGame(game, NOW))) {
      const companyIds = mapped.companies.map((c) => c.igdbId);
      const featureKeys = mapped.features.map((f) => `${f.type}:${f.igdbId}`);
      const languageIds = mapped.languages.map((l) => l.languageIgdbId);
      expect(new Set(companyIds).size).toBe(companyIds.length);
      expect(new Set(featureKeys).size).toBe(featureKeys.length);
      expect(new Set(languageIds).size).toBe(languageIds.length);
    }
  });

  it('marca como em breve os jogos com lançamento futuro', () => {
    for (const game of loadFixture('games.upcoming.json')) {
      expect(mapIgdbGame(game, NOW).releaseStatus).toBe('UPCOMING');
    }
  });

  it('trata o jogo sem data de lançamento como em breve, sem data', () => {
    const blindDescent = mapIgdbGame(fixtureGame('Blind Descent'), NOW);

    expect(blindDescent.firstReleaseDate).toBeNull();
    expect(blindDescent.releaseStatus).toBe('UPCOMING');
  });

  it('identifica o jogo cancelado', () => {
    expect(mapIgdbGame(fixtureGame('Siren Forest'), NOW).isCancelled).toBe(true);
  });

  it('devolve listas vazias e país não informado quando faltam empresas e idiomas', () => {
    const racer = mapIgdbGame(fixtureGame('Color Retro Racer: Miles Challenge'), NOW);
    const wik = mapIgdbGame(fixtureGame('Wik & the Fable of Souls'), NOW);

    expect(racer.companies).toEqual([]);
    expect(racer.studioCountryCode).toBeNull();
    expect(wik.languages).toEqual([]);
  });

  it('usa a loja quando não há site oficial, e nada quando não há nenhum dos dois', () => {
    expect(mapIgdbGame(fixtureGame("MopGarden's Veggie Cart"), NOW).storeUrl).toMatch(
      /store\.steampowered\.com/,
    );
    expect(mapIgdbGame(fixtureGame('Wik & the Fable of Souls'), NOW).storeUrl).toBeNull();
  });

  it('só considera o país da desenvolvedora, não o da publisher', () => {
    expect(mapIgdbGame(fixtureGame('Phantaruk'), NOW).studioCountryCode).toBeNull();
  });

  it('junta os papéis de uma empresa que aparece mais de uma vez no mesmo jogo', () => {
    const game = igdbGameSchema.parse({
      id: 1,
      name: 'Jogo',
      slug: 'jogo',
      involved_companies: [
        { developer: true, publisher: false, company: { id: 5, name: 'Estúdio', country: 76 } },
        { developer: false, publisher: true, company: { id: 5, name: 'Estúdio' } },
      ],
    });

    expect(mapIgdbGame(game, NOW).companies).toEqual([
      { igdbId: 5, name: 'Estúdio', countryCode: 76, isDeveloper: true, isPublisher: true },
    ]);
  });

  it('recusa uma resposta sem os campos obrigatórios', () => {
    expect(() => igdbGameSchema.parse({ id: 1, slug: 'sem-nome' })).toThrow();
  });
});

describe('slugify', () => {
  it.each([
    ['Role-playing (RPG)', 'role-playing-rpg'],
    ["Hack and slash/Beat 'em up", 'hack-and-slash-beat-em-up'],
    ['Folclore Brasileiro', 'folclore-brasileiro'],
    ['Ação', 'acao'],
  ])('%s → %s', (text, slug) => {
    expect(slugify(text)).toBe(slug);
  });
});
