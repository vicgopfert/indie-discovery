import { ReviewFlagKind } from '../../../generated/prisma/client';
import type { MappedCompany, MappedGame } from '../igdb/igdb.mapper';
import type { CriteriaVerdict } from '../criteria/indie-criteria';
import { readIndieCriteria } from '../criteria/indie-criteria.config';
import { readIngestionReview } from './ingestion-review.config';
import {
  ancestorsOf,
  detectReviewFlags,
  type IgdbCompanyNode,
  type ReviewFlagInput,
  type StoredGame,
} from './review-flags';

const NOW = new Date('2026-10-23T00:00:00Z');
const criteria = readIndieCriteria();
const review = readIngestionReview(criteria);
const ACCEPTED: CriteriaVerdict = { accepted: true };

// Ids reais da configuração: Behaviour (limítrofe recusada), Tencent Holdings (grande),
// Lab42 (controlado) e Housemarque (sem efeito atual, Sony desde 2021).
const BEHAVIOUR = 1260;
const TENCENT = 42;
const LAB42 = 19967;
const HOUSEMARQUE = 1006;

const developer = (igdbId: number, name = `Estúdio ${igdbId}`): MappedCompany => ({
  igdbId,
  name,
  countryCode: null,
  isDeveloper: true,
  isPublisher: false,
});

const game = (changes: Partial<MappedGame> = {}): MappedGame => ({
  igdbId: 1,
  slug: 'jogo',
  name: 'Jogo',
  summary: 'Resumo longo o bastante para a ficha completa.',
  coverImageId: 'capa',
  firstReleaseDate: new Date('2025-01-01T00:00:00Z'),
  releaseStatus: 'RELEASED',
  isCancelled: false,
  storeUrl: null,
  studioCountryCode: null,
  ratingCount: 0,
  hypes: 0,
  companies: [],
  features: [],
  languages: [],
  ...changes,
});

const stored = (changes: Partial<StoredGame> = {}): StoredGame => ({
  igdbId: 1,
  name: 'Jogo',
  inCatalog: true,
  firstReleaseDate: new Date('2025-01-01T00:00:00Z'),
  criteriaVersion: 'v1',
  evaluatedAt: new Date('2026-10-01T00:00:00Z'),
  ...changes,
});

const companies = new Map<number, IgdbCompanyNode>([
  [900001, { name: 'Estúdio sob consolidador novo', parentIgdbId: 900002 }],
  [900002, { name: 'Consolidador novo', parentIgdbId: null }],
  [900003, { name: 'Estúdio sob a Behaviour', parentIgdbId: BEHAVIOUR }],
  [BEHAVIOUR, { name: 'Behaviour Interactive', parentIgdbId: null }],
  [900004, { name: 'Estúdio da Tencent fora da lista', parentIgdbId: TENCENT }],
  [TENCENT, { name: 'Tencent Holdings', parentIgdbId: null }],
  [LAB42, { name: 'Lab42 Games', parentIgdbId: TENCENT }],
  [900005, { name: 'Sem dono', parentIgdbId: null }],
]);

function detect(changes: Partial<ReviewFlagInput>) {
  return detectReviewFlags({
    evaluated: [],
    stored: new Map(),
    companies,
    criteria,
    review,
    criteriaVersion: 'v1',
    now: NOW,
    ...changes,
  });
}

const kinds = (flags: { kind: ReviewFlagKind }[]) => flags.map((f) => f.kind);

describe('detectReviewFlags', () => {
  describe('alertas de empresa', () => {
    it('não alerta empresa já revisada, estúdio controlado nem desenvolvedora sem dona', () => {
      const flags = detect({
        evaluated: [
          {
            game: game({ companies: [developer(900003), developer(LAB42), developer(900005)] }),
            verdict: ACCEPTED,
          },
        ],
      });

      expect(flags).toEqual([]);
    });

    it('alerta a empresa-mãe fora da lista de grandes que ninguém revisou', () => {
      const [flag, ...rest] = detect({
        evaluated: [{ game: game({ companies: [developer(900001)] }), verdict: ACCEPTED }],
      });

      expect(rest).toEqual([]);
      expect(flag).toMatchObject({
        kind: ReviewFlagKind.PARENT_OUTSIDE_MAJORS,
        detail: { developerIgdbId: 900001, parentChain: ['Consolidador novo'] },
      });
    });

    it('alerta o estúdio sob uma grande que não está entre os controlados', () => {
      const flags = detect({
        evaluated: [{ game: game({ companies: [developer(900004)] }), verdict: ACCEPTED }],
      });

      expect(kinds(flags)).toEqual([ReviewFlagKind.PARENT_MAJOR_NOT_CONTROLLED]);
    });

    it('só olha os jogos que vão para o catálogo', () => {
      const flags = detect({
        evaluated: [
          {
            game: game({ companies: [developer(900001)] }),
            verdict: { accepted: false, reason: 'INCOMPLETE_ENTRY' },
          },
        ],
      });

      expect(flags).toEqual([]);
    });

    it.each<[string, Date | null, boolean, string]>([
      ['lançado antes da compra', new Date('2020-06-01T00:00:00Z'), false, ''],
      ['lançado no ano da compra', new Date('2021-03-01T00:00:00Z'), true, 'RELEASE'],
      ['sem data, pelo ano da execução', null, true, 'EVALUATION'],
    ])('estúdio sem efeito atual, %s → alerta: %s', (_, date, raised, source) => {
      const flags = detect({
        evaluated: [
          {
            game: game({ firstReleaseDate: date, companies: [developer(HOUSEMARQUE)] }),
            verdict: ACCEPTED,
          },
        ],
      });

      expect(flags).toMatchObject(
        raised
          ? [
              {
                kind: ReviewFlagKind.NO_EFFECT_STUDIO,
                detail: { group: 'Sony', referenceDateSource: source },
              },
            ]
          : [],
      );
    });
  });

  describe('jogo sem desenvolvedora visível', () => {
    const publisher = (igdbId: number, name: string): MappedCompany => ({
      igdbId,
      name,
      countryCode: null,
      isDeveloper: false,
      isPublisher: true,
    });
    const BATTLE_FOR_WESNOTH = 2365;
    const noDeveloper = (changes: Partial<MappedGame>) =>
      detect({ evaluated: [{ game: game({ companies: [], ...changes }), verdict: ACCEPTED }] });

    it('alerta o jogo sem desenvolvedora com 20 ou mais avaliações', () => {
      expect(noDeveloper({ ratingCount: 20 })).toMatchObject([
        {
          kind: ReviewFlagKind.NO_DEVELOPER_VISIBLE,
          detail: { ratingCount: 20, majorPublishers: [] },
        },
      ]);
    });

    it('alerta o jogo sem desenvolvedora publicado por uma grande, mesmo sem avaliações', () => {
      expect(
        noDeveloper({ ratingCount: 0, companies: [publisher(TENCENT, 'Tencent Holdings')] }),
      ).toMatchObject([{ detail: { majorPublishers: ['Tencent Holdings'] } }]);
    });

    it('não alerta o jogo pouco visível, o já revisado nem o que tem desenvolvedora', () => {
      expect(
        noDeveloper({ ratingCount: 19, companies: [publisher(999001, 'Publisher pequena')] }),
      ).toEqual([]);
      expect(noDeveloper({ igdbId: BATTLE_FOR_WESNOTH, ratingCount: 40 })).toEqual([]);
      expect(noDeveloper({ ratingCount: 100, companies: [developer(900005)] })).toEqual([]);
    });
  });

  describe('alertas de transição', () => {
    it('não compara nada na primeira avaliação do jogo', () => {
      expect(detect({ evaluated: [{ game: game(), verdict: ACCEPTED }] })).toEqual([]);
    });

    it('alerta o jogo sem data que ganhou data de lançamento', () => {
      const flags = detect({
        evaluated: [{ game: game(), verdict: ACCEPTED }],
        stored: new Map([[1, stored({ firstReleaseDate: null })]]),
      });

      expect(flags).toEqual([
        expect.objectContaining({
          kind: ReviewFlagKind.RELEASE_DATE_ASSIGNED,
          detail: { releaseDate: '2025-01-01', inCatalog: true },
        }),
      ]);
    });

    it('separa a mudança de lado causada pela regra da causada pelo jogo', () => {
      const flags = detect({
        evaluated: [{ game: game(), verdict: { accepted: false, reason: 'INCOMPLETE_ENTRY' } }],
        stored: new Map([[1, stored({ criteriaVersion: 'v0' })]]),
      });

      expect(flags).toMatchObject([
        {
          kind: ReviewFlagKind.VERDICT_CHANGED,
          detail: { inCatalog: false, criteriaChanged: true, postLaunchGraceEnded: false },
        },
      ]);
    });

    it('diz quando a saída foi pelo fim da carência pós-lançamento', () => {
      const releasedAt = new Date('2026-04-01T00:00:00Z');
      const flags = detect({
        evaluated: [
          {
            game: game({ firstReleaseDate: releasedAt }),
            verdict: { accepted: false, reason: 'NO_INTEREST_SIGNAL' },
          },
        ],
        stored: new Map([
          [
            1,
            stored({ firstReleaseDate: releasedAt, evaluatedAt: new Date('2026-09-20T00:00:00Z') }),
          ],
        ]),
      });

      expect(flags[0]?.detail).toMatchObject({
        postLaunchGraceEnded: true,
        criteriaChanged: false,
      });
    });
  });
});

describe('ancestorsOf', () => {
  it('sobe a cadeia e para na empresa que aponta para si mesma', () => {
    const graph = new Map<number, IgdbCompanyNode>([
      [1, { name: 'Estúdio', parentIgdbId: 2 }],
      [2, { name: 'Grupo', parentIgdbId: 2 }],
    ]);

    expect(ancestorsOf(1, graph)).toEqual([2]);
    expect(ancestorsOf(2, graph)).toEqual([]);
  });
});
