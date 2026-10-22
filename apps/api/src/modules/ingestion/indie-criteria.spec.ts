import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { igdbGameSchema } from './igdb-game.schema';
import { type MappedGame, mapIgdbGame } from './igdb.mapper';
import {
  type CriteriaVerdict,
  evaluateIndieCriteria,
  type IndieCriteria,
  indieCriteriaSchema,
  readIndieCriteria,
} from './indie-criteria';

const FIXTURES_DIR = join(__dirname, '../../../test/fixtures/igdb');
const NOW = new Date('2026-10-20T00:00:00Z');
const criteria = readIndieCriteria();

function fixture(file: string): MappedGame[] {
  const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as unknown[];
  return raw.map((game) => mapIgdbGame(igdbGameSchema.parse(game), NOW));
}

const amnesia = fixture('games.complete.json').find((g) => g.igdbId === 111)!;

function variant(changes: Partial<MappedGame>): MappedGame {
  return { ...amnesia, ...changes };
}

const eroticTheme = { type: 'THEME' as const, igdbId: 42, name: 'Erotic', slug: 'erotic' };

describe('evaluateIndieCriteria', () => {
  it('lê e valida o arquivo de critério versionado', () => {
    expect(criteria.excludedPublishers.length).toBeGreaterThan(0);
    expect(criteria.excludedThemes).toEqual([{ igdbId: 42, name: 'Erotic' }]);
  });

  it('aceita as fixtures completas e por lançar do recorte do M0, menos a exceção manual', () => {
    const games = [...fixture('games.complete.json'), ...fixture('games.upcoming.json')];

    expect(games.map((g) => [g.name, evaluateIndieCriteria(g, criteria)])).toEqual(
      games.map((g) => [
        g.name,
        g.name === 'Squadron 42'
          ? { accepted: false, reason: 'MANUALLY_EXCLUDED' }
          : { accepted: true },
      ]),
    );
  });

  it('exclui grandes publishers, mas não publishers dedicadas a estúdios independentes', () => {
    const verdicts = Object.fromEntries(
      fixture('games.major-publisher.json').map((g) => [
        g.name,
        evaluateIndieCriteria(g, criteria),
      ]),
    );

    expect(verdicts).toMatchObject({
      'Ninja Reflex': { accepted: false, reason: 'MAJOR_PUBLISHER' },
      Rise: { accepted: false, reason: 'MAJOR_PUBLISHER' },
      'Two Point Campus': { accepted: false, reason: 'MAJOR_PUBLISHER' },
      Dropsy: { accepted: true },
      'Weird West': { accepted: true },
      'Baby Steps': { accepted: true },
      'Act of Aggression': { accepted: true },
      Scarf: { accepted: true },
    });
  });

  it('não exclui um jogo só porque a grande empresa aparece como desenvolvedora', () => {
    const game = variant({
      companies: [
        {
          igdbId: 1,
          name: 'Electronic Arts',
          countryCode: 840,
          isDeveloper: true,
          isPublisher: false,
        },
      ],
    });

    expect(evaluateIndieCriteria(game, criteria)).toEqual({ accepted: true });
  });

  it('exclui jogos com tema excluído e sem o gênero Indie', () => {
    expect(
      evaluateIndieCriteria(variant({ features: [...amnesia.features, eroticTheme] }), criteria),
    ).toEqual({ accepted: false, reason: 'EXCLUDED_THEME' });
    expect(
      evaluateIndieCriteria(
        variant({ features: amnesia.features.filter((f) => f.igdbId !== 32) }),
        criteria,
      ),
    ).toEqual({ accepted: false, reason: 'NOT_INDIE' });
  });

  it('exclui jogos cancelados', () => {
    expect(evaluateIndieCriteria(variant({ isCancelled: true }), criteria)).toEqual({
      accepted: false,
      reason: 'CANCELLED',
    });
  });

  it.each<[string, Partial<MappedGame>]>([
    ['sem capa', { coverImageId: null }],
    ['com resumo curto', { summary: 'Curto demais.' }],
    [
      'só com o gênero Indie',
      { features: [{ type: 'GENRE', igdbId: 32, name: 'Indie', slug: 'indie' }] },
    ],
  ])('exclui a ficha incompleta: %s', (_, changes) => {
    expect(evaluateIndieCriteria(variant(changes), criteria)).toEqual({
      accepted: false,
      reason: 'INCOMPLETE_ENTRY',
    });
  });

  describe('sinal de interesse', () => {
    const before2015 = new Date('2012-05-01T00:00:00Z');
    const since2015 = new Date('2019-05-01T00:00:00Z');
    const upcoming = { releaseStatus: 'UPCOMING' as const, ratingCount: 0, hypes: 0 };

    it.each<[string, Partial<MappedGame>, boolean]>([
      [
        'lançado antes de 2015 com avaliações',
        { firstReleaseDate: before2015, ratingCount: 3, hypes: 0 },
        true,
      ],
      [
        'lançado antes de 2015 só com hypes',
        { firstReleaseDate: before2015, ratingCount: 0, hypes: 9 },
        false,
      ],
      [
        'lançado desde 2015 só com hypes',
        { firstReleaseDate: since2015, ratingCount: 0, hypes: 1 },
        true,
      ],
      [
        'lançado desde 2015 sem nenhum sinal',
        { firstReleaseDate: since2015, ratingCount: 0, hypes: 0 },
        false,
      ],
      [
        'por lançar com data marcada',
        { ...upcoming, firstReleaseDate: new Date('2027-03-01') },
        true,
      ],
      ['anunciado sem data, com hypes', { ...upcoming, firstReleaseDate: null, hypes: 2 }, true],
      ['anunciado sem data e sem hypes', { ...upcoming, firstReleaseDate: null }, false],
    ])('%s → aceito: %s', (_, changes, accepted) => {
      expect(evaluateIndieCriteria(variant(changes), criteria).accepted).toBe(accepted);
    });
  });

  describe('ajustes manuais', () => {
    function withOverrides(overrides: Partial<IndieCriteria['overrides']>): IndieCriteria {
      const entry = {
        igdbId: amnesia.igdbId,
        name: amnesia.name,
        reason: 'teste',
        source: 'https://example.com',
        decidedAt: '2026-10-21',
      };
      return {
        ...criteria,
        overrides: {
          alwaysInclude: overrides.alwaysInclude ? [entry] : [],
          alwaysExclude: overrides.alwaysExclude ? [entry] : [],
        },
      };
    }

    it('sempre excluir derruba um jogo que passaria no critério', () => {
      expect(evaluateIndieCriteria(amnesia, withOverrides({ alwaysExclude: [] }))).toEqual({
        accepted: false,
        reason: 'MANUALLY_EXCLUDED',
      });
    });

    it('sempre manter corrige a exclusão por publisher', () => {
      const game = variant({
        companies: [
          { igdbId: 112, name: 'Sega', countryCode: null, isDeveloper: false, isPublisher: true },
        ],
      });

      expect(evaluateIndieCriteria(game, withOverrides({ alwaysInclude: [] }))).toEqual({
        accepted: true,
      });
    });

    it('sempre manter não sobrepõe o filtro de conteúdo', () => {
      const game = variant({ features: [...amnesia.features, eroticTheme] });

      expect(evaluateIndieCriteria(game, withOverrides({ alwaysInclude: [] }))).toEqual({
        accepted: false,
        reason: 'EXCLUDED_THEME',
      });
    });

    it('sempre manter não ignora a ficha incompleta', () => {
      expect(
        evaluateIndieCriteria(
          variant({ coverImageId: null }),
          withOverrides({ alwaysInclude: [] }),
        ),
      ).toEqual({ accepted: false, reason: 'INCOMPLETE_ENTRY' });
    });
  });
});

describe('política das listas de exceção', () => {
  const raw = JSON.parse(readFileSync('config/indie-criteria.json', 'utf8')) as {
    overrides: { alwaysInclude: Record<string, unknown>[]; alwaysExclude: unknown[] };
    overridesPolicy: { maxEntries: number };
  };

  it('exige fonte pública e data em cada exceção', () => {
    const [journey] = raw.overrides.alwaysInclude;
    const withoutSource = { ...journey, source: undefined };

    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        overrides: { ...raw.overrides, alwaysInclude: [withoutSource] },
      }),
    ).toThrow('source');
  });

  it('recusa listas que passam do teto de entradas', () => {
    const [journey] = raw.overrides.alwaysInclude;
    const tooMany = Array.from({ length: raw.overridesPolicy.maxEntries }, (_, i) => ({
      ...journey,
      igdbId: i + 1,
    }));

    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        overrides: { ...raw.overrides, alwaysInclude: tooMany },
      }),
    ).toThrow('o problema é a regra');
  });
});

// Casos reais conferidos à mão em 21/10/2026 (docs/criterio-indie-casos.md).
describe('regressão dos casos reais conferidos à mão', () => {
  const games = fixture('criteria-cases.json');

  it.each<[string, CriteriaVerdict]>([
    ['Hotline Miami', { accepted: true }],
    ['Outer Wilds', { accepted: true }],
    ['Prison Architect', { accepted: true }],
    ['Stardew Valley', { accepted: true }],
    ['Papers, Please', { accepted: true }],
    ['Celeste', { accepted: true }],
    ['Journey', { accepted: true }],
    ['Two Point Campus', { accepted: false, reason: 'MAJOR_PUBLISHER' }],
    ['Fall Guys', { accepted: false, reason: 'MAJOR_PUBLISHER' }],
    ['HuniePop', { accepted: false, reason: 'EXCLUDED_THEME' }],
    ['Katawa Shoujo', { accepted: false, reason: 'EXCLUDED_THEME' }],
    ['Ori and the Blind Forest', { accepted: false, reason: 'NOT_INDIE' }],
    ['Unravel', { accepted: false, reason: 'NOT_INDIE' }],
    ['Squadron 42', { accepted: false, reason: 'MANUALLY_EXCLUDED' }],
    ['Feed It', { accepted: true }],
    ['Forest 3', { accepted: true }],
    ['Mushroom 11', { accepted: true }],
    ['Dark Anarchy', { accepted: true }],
    ['Metal Drift', { accepted: true }],
    ['Lunark', { accepted: true }],
    ['Resistor', { accepted: true }],
    ['Aurora: The Lost Medallion - The Cave', { accepted: true }],
  ])('%s', (name, verdict) => {
    const game = games.find((g) => g.name === name);

    expect(game && evaluateIndieCriteria(game, criteria)).toEqual(verdict);
  });

  it('cobre todos os jogos da fixture', () => {
    expect(games).toHaveLength(22);
  });
});
