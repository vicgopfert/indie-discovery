import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { igdbGameSchema } from './igdb-game.schema';
import { type MappedCompany, type MappedGame, mapIgdbGame } from './igdb.mapper';
import {
  type CriteriaVerdict,
  evaluateIndieCriteria,
  type IndieCriteria,
  indieCriteriaSchema,
  readIndieCriteria,
} from './indie-criteria';

const FIXTURES_DIR = join(__dirname, '../../../test/fixtures/igdb');
const NOW = new Date('2026-10-22T00:00:00Z');
const criteria = readIndieCriteria();

function fixture(file: string): MappedGame[] {
  const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, file), 'utf8')) as unknown[];
  return raw.map((game) => mapIgdbGame(igdbGameSchema.parse(game), NOW));
}

function evaluate(game: MappedGame, rules: IndieCriteria = criteria) {
  return evaluateIndieCriteria(game, rules, NOW);
}

const amnesia = fixture('games.complete.json').find((g) => g.igdbId === 111)!;

function variant(changes: Partial<MappedGame>): MappedGame {
  return { ...amnesia, ...changes };
}

function company(igdbId: number, name: string, roles: Partial<MappedCompany> = {}): MappedCompany {
  return { igdbId, name, countryCode: null, isDeveloper: true, isPublisher: false, ...roles };
}

const eroticTheme = { type: 'THEME' as const, igdbId: 42, name: 'Erotic', slug: 'erotic' };
const STUDIO = company(900001, 'Estúdio Comprado');
const OWNER_ID = 112;

function withStudio(entry: { acquiredAt: string; divestedAt?: string }): IndieCriteria {
  return {
    ...criteria,
    controlledStudios: [
      {
        igdbId: STUDIO.igdbId,
        name: STUDIO.name,
        ownerIgdbId: OWNER_ID,
        control: 'wholly_owned',
        source: 'https://example.com',
        note: 'teste',
        ...entry,
      },
    ],
  };
}

describe('evaluateIndieCriteria', () => {
  it('lê e valida o arquivo de critério versionado', () => {
    expect(criteria.majorCompanies.length).toBeGreaterThan(0);
    expect(criteria.controlledStudios.length).toBeGreaterThan(0);
    expect(criteria.excludedThemes).toEqual([{ igdbId: 42, name: 'Erotic' }]);
  });

  it('aceita as fixtures completas e por lançar do recorte do M0, menos a exceção manual', () => {
    const games = [...fixture('games.complete.json'), ...fixture('games.upcoming.json')];

    expect(games.map((g) => [g.name, evaluate(g)])).toEqual(
      games.map((g) => [
        g.name,
        g.name === 'Squadron 42'
          ? { accepted: false, reason: 'MANUALLY_EXCLUDED' }
          : { accepted: true },
      ]),
    );
  });

  it('exclui jogos com tema excluído e sem o gênero Indie', () => {
    expect(evaluate(variant({ features: [...amnesia.features, eroticTheme] }))).toEqual({
      accepted: false,
      reason: 'EXCLUDED_THEME',
    });
    expect(
      evaluate(variant({ features: amnesia.features.filter((f) => f.igdbId !== 32) })),
    ).toEqual({ accepted: false, reason: 'NOT_INDIE' });
  });

  it('exclui jogos cancelados', () => {
    expect(evaluate(variant({ isCancelled: true }))).toEqual({
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
    expect(evaluate(variant(changes))).toEqual({ accepted: false, reason: 'INCOMPLETE_ENTRY' });
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
      expect(evaluate(variant(changes)).accepted).toBe(accepted);
    });
  });

  describe('controle da desenvolvedora', () => {
    const released = (date: string, companies: MappedCompany[] = [STUDIO]) =>
      variant({ firstReleaseDate: new Date(`${date}T00:00:00Z`), companies });

    it('exclui quando a grande empresa é a própria desenvolvedora, dizendo qual', () => {
      expect(evaluate(released('2019-01-01', [company(112, 'Sega')]))).toEqual({
        accepted: false,
        reason: 'CONTROLLED_DEVELOPER',
        developer: 'Sega',
        owner: 'Sega',
        referenceDate: '2019-01-01',
        referenceDateSource: 'RELEASE',
      });
    });

    it('não exclui quando a grande empresa só publica', () => {
      const publishedBySega = [
        company(900002, 'Estúdio Independente'),
        company(112, 'Sega', { isDeveloper: false, isPublisher: true }),
      ];

      expect(evaluate(released('2019-01-01', publishedBySega))).toEqual({ accepted: true });
    });

    it('exclui o jogo lançado no dia da aquisição ou depois, e não o lançado antes', () => {
      const rules = withStudio({ acquiredAt: '2020-06-10' });

      expect(evaluate(released('2020-06-09'), rules)).toEqual({ accepted: true });
      expect(evaluate(released('2020-06-10'), rules)).toEqual({
        accepted: false,
        reason: 'CONTROLLED_DEVELOPER',
        developer: 'Estúdio Comprado',
        owner: 'Sega',
        referenceDate: '2020-06-10',
        referenceDateSource: 'RELEASE',
      });
    });

    it('volta a aceitar a partir da saída do grupo', () => {
      const rules = withStudio({ acquiredAt: '2018-01-01', divestedAt: '2024-03-28' });

      expect(evaluate(released('2024-03-27'), rules).accepted).toBe(false);
      expect(evaluate(released('2024-03-28'), rules)).toEqual({ accepted: true });
    });

    it('usa a data da avaliação para o jogo anunciado sem data, e registra isso', () => {
      const rules = withStudio({ acquiredAt: '2026-01-01' });
      const undated = variant({
        firstReleaseDate: null,
        releaseStatus: 'UPCOMING',
        hypes: 5,
        companies: [STUDIO],
      });

      expect(evaluateIndieCriteria(undated, rules, NOW)).toMatchObject({
        reason: 'CONTROLLED_DEVELOPER',
        referenceDate: '2026-10-22',
        referenceDateSource: 'EVALUATION',
      });
      expect(evaluateIndieCriteria(undated, rules, new Date('2025-06-01'))).toEqual({
        accepted: true,
      });
    });

    it('basta uma codesenvolvedora controlada para excluir', () => {
      const rules = withStudio({ acquiredAt: '2010-01-01' });
      const codeveloped = [company(900003, 'Parceiro Independente'), STUDIO];

      expect(evaluate(released('2015-01-01', codeveloped), rules)).toMatchObject({
        reason: 'CONTROLLED_DEVELOPER',
        developer: 'Estúdio Comprado',
      });
    });

    it('não exclui estúdio fora da lista, como os de participação minoritária', () => {
      expect(evaluate(released('2022-01-01', [company(42432, 'Kavalri Games')]))).toEqual({
        accepted: true,
      });
    });
  });

  describe('ajustes manuais', () => {
    function withOverrides(overrides: Partial<IndieCriteria['overrides']>): IndieCriteria {
      const entry = {
        igdbId: amnesia.igdbId,
        name: amnesia.name,
        reason: 'teste',
        source: 'https://example.com',
        decidedAt: '2026-10-22',
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
      expect(evaluate(amnesia, withOverrides({ alwaysExclude: [] }))).toEqual({
        accepted: false,
        reason: 'MANUALLY_EXCLUDED',
      });
    });

    it('sempre manter corrige o crédito de uma desenvolvedora controlada', () => {
      const game = variant({ companies: [company(112, 'Sega')] });

      expect(evaluate(game, withOverrides({ alwaysInclude: [] }))).toEqual({ accepted: true });
    });

    it('sempre manter não sobrepõe o filtro de conteúdo', () => {
      const game = variant({ features: [...amnesia.features, eroticTheme] });

      expect(evaluate(game, withOverrides({ alwaysInclude: [] }))).toEqual({
        accepted: false,
        reason: 'EXCLUDED_THEME',
      });
    });

    it('sempre manter não ignora a ficha incompleta', () => {
      expect(
        evaluate(variant({ coverImageId: null }), withOverrides({ alwaysInclude: [] })),
      ).toEqual({ accepted: false, reason: 'INCOMPLETE_ENTRY' });
    });
  });
});

describe('validação do arquivo de critério', () => {
  const raw = JSON.parse(readFileSync('config/indie-criteria.json', 'utf8')) as Record<
    string,
    unknown
  > & {
    overrides: { alwaysInclude: Record<string, unknown>[]; alwaysExclude: unknown[] };
    overridesPolicy: { maxEntries: number };
    majorCompanies: Record<string, unknown>[];
    controlledStudios: Record<string, unknown>[];
  };
  const [firstOverride] = raw.overrides.alwaysInclude;
  const [firstStudio] = raw.controlledStudios;

  it('exige fonte pública e data em cada exceção', () => {
    const withoutSource = { ...firstOverride, source: undefined };

    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        overrides: { ...raw.overrides, alwaysInclude: [withoutSource] },
      }),
    ).toThrow('source');
  });

  it('recusa listas de exceção que passam do teto de entradas', () => {
    const tooMany = Array.from({ length: raw.overridesPolicy.maxEntries + 1 }, (_, i) => ({
      ...firstOverride,
      igdbId: i + 1,
    }));

    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        overrides: { ...raw.overrides, alwaysInclude: tooMany },
      }),
    ).toThrow('o problema é a regra');
  });

  it('exige que a dona do estúdio controlado esteja na lista de grandes', () => {
    const orphan = { ...firstStudio, ownerIgdbId: 999999999 };

    expect(() => indieCriteriaSchema.parse({ ...raw, controlledStudios: [orphan] })).toThrow(
      'lista de grandes',
    );
  });

  it('exige que a saída do grupo seja posterior à aquisição', () => {
    const inverted = { ...firstStudio, acquiredAt: '2020-01-01', divestedAt: '2019-01-01' };

    expect(() => indieCriteriaSchema.parse({ ...raw, controlledStudios: [inverted] })).toThrow(
      'posterior à aquisição',
    );
  });

  it('exige o ramo do teste de entrada em cada grande empresa', () => {
    const [firstMajor] = raw.majorCompanies;
    const withoutVia = { ...firstMajor, via: undefined };

    expect(() => indieCriteriaSchema.parse({ ...raw, majorCompanies: [withoutVia] })).toThrow(
      'via',
    );
  });

  it('recusa empresa ou estúdio repetido pelo id da IGDB', () => {
    const [firstMajor] = raw.majorCompanies;

    expect(() =>
      indieCriteriaSchema.parse({ ...raw, majorCompanies: [...raw.majorCompanies, firstMajor] }),
    ).toThrow('repetida');
    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        controlledStudios: [...raw.controlledStudios, firstStudio],
      }),
    ).toThrow('repetido');
  });

  it('exige fonte pública em cada estúdio controlado', () => {
    const withoutSource = { ...firstStudio, source: 'não é url' };

    expect(() => indieCriteriaSchema.parse({ ...raw, controlledStudios: [withoutSource] })).toThrow(
      'source',
    );
  });
});

// Casos reais conferidos à mão (docs/criterio-indie-casos.md).
describe('regressão dos casos reais conferidos à mão', () => {
  function expectVerdicts(file: string, expected: [string, CriteriaVerdict][]) {
    const games = fixture(file);
    expect(games).toHaveLength(expected.length);
    for (const [name, verdict] of expected) {
      const game = games.find((g) => g.name === name);
      expect([name, game && evaluate(game)]).toEqual([name, verdict]);
    }
  }

  const controlled = (developer: string, owner: string, releasedAt: string): CriteriaVerdict => ({
    accepted: false,
    reason: 'CONTROLLED_DEVELOPER',
    developer,
    owner,
    referenceDate: releasedAt,
    referenceDateSource: 'RELEASE',
  });

  it('os 22 casos do B-11', () => {
    expectVerdicts('criteria-cases.json', [
      ['Hotline Miami', { accepted: true }],
      ['Outer Wilds', { accepted: true }],
      ['Prison Architect', { accepted: true }],
      ['Stardew Valley', { accepted: true }],
      ['Papers, Please', { accepted: true }],
      ['Celeste', { accepted: true }],
      ['Journey', { accepted: true }],
      ['Fall Guys', { accepted: true }],
      ['Two Point Campus', controlled('Two Point Studios', 'Sega', '2022-08-09')],
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
    ]);
  });

  it('a amostra de falsos negativos do B-59, agora aceita, menos Alter Ego', () => {
    expectVerdicts('criteria-false-negatives.json', [
      ['World of Goo', { accepted: true }],
      ['Skullgirls', { accepted: true }],
      ['PixelJunk: 4am', { accepted: true }],
      ['Goetia', { accepted: true }],
      ['Attractio', { accepted: true }],
      ['Wakfu', { accepted: true }],
      ['Sea of Solitude', { accepted: true }],
      ['Tales of Kenzera: Zau', { accepted: true }],
      ['Dinkum', { accepted: true }],
      ['Alter Ego', controlled('Activision', 'Activision', '1986-04-27')],
    ]);
  });

  it('os casos de data apertada, coautoria e crédito de porte', () => {
    expectVerdicts('criteria-control-cases.json', [
      ['Limbo', { accepted: true }],
      ['Braid', { accepted: true }],
      ["Garry's Mod", { accepted: true }],
      ['Chroma Squad', { accepted: true }],
      ['PowerWash Simulator', { accepted: true }],
      ["Hellblade: Senua's Sacrifice", { accepted: true }],
      ['Two Point Hospital', { accepted: true }],
      ['Aces of the Luftwaffe: Squadron', { accepted: true }],
      ['Maneater', { accepted: true }],
      ['Teardown', { accepted: true }],
      ['Road 96', controlled('DigixArt', 'Embracer Group', '2021-08-16')],
      ['We Happy Few', controlled('Compulsion Games', 'Xbox Game Studios', '2018-08-10')],
      ['Warhammer 40,000: Darktide', controlled('Fatshark', 'Tencent Holdings', '2022-11-30')],
      [
        'Hohokum',
        controlled('SCE Santa Monica Studio', 'Sony Interactive Entertainment', '2014-08-12'),
      ],
      ['Growtopia', { accepted: true }],
      ['Ilomilo', { accepted: true }],
      ['Chained Together', { accepted: true }],
    ]);
  });
});
