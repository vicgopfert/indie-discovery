import { type CandidateGame, suggestCandidates } from './candidate-suggestions';
import type { CuratedCollection } from './collections.config';

const brasil: CuratedCollection = {
  slug: 'brasil',
  name: 'Brasil',
  description: 'Descrição',
  scope: 'Escopo',
  published: false,
  suggest: {
    keywords: ['brazil'],
    summaryTerms: ['Brazil', 'saci'],
    wikidataPlaces: ['Q155'],
  },
  games: [{ igdbId: 1, name: 'Aprovado' }],
  rejected: [{ igdbId: 2, name: 'Recusado', reason: 'Só cita o país' }],
};

const game = (igdbId: number, overrides: Partial<CandidateGame> = {}): CandidateGame => ({
  igdbId,
  slug: `jogo-${igdbId}`,
  name: `Jogo ${igdbId}`,
  summary: '',
  popularityCount: 0,
  keywords: [],
  ...overrides,
});

const noPlaces = new Map<string, Set<string>>();

describe('sugestão de candidatos das coleções', () => {
  it('junta a evidência das três fontes, do mais popular para o menos', () => {
    const candidates = suggestCandidates(
      brasil,
      [
        game(3, { keywords: ['Brazil'], popularityCount: 2 }),
        game(4, { summary: 'A tale where the Saci haunts a farm.', popularityCount: 9 }),
        game(5, { slug: 'amazonia' }),
      ],
      new Map([['amazonia', new Set(['Q155'])]]),
    );

    expect(candidates).toEqual([
      {
        igdbId: 4,
        name: 'Jogo 4',
        popularityCount: 9,
        evidence: ['resumo (saci): A tale where the Saci haunts a farm.'],
      },
      { igdbId: 3, name: 'Jogo 3', popularityCount: 2, evidence: ['palavra-chave: Brazil'] },
      {
        igdbId: 5,
        name: 'Jogo 5',
        popularityCount: 0,
        evidence: ['Wikidata, local da narrativa: Q155'],
      },
    ]);
  });

  it('casa o termo do resumo só como palavra inteira', () => {
    const candidates = suggestCandidates(
      brasil,
      [game(3, { summary: 'A Brazilian studio made it.' }), game(4, { summary: 'Set in Brazil.' })],
      noPlaces,
    );

    expect(candidates.map((c) => c.igdbId)).toEqual([4]);
  });

  it('não sugere de novo o jogo já aprovado ou recusado', () => {
    const candidates = suggestCandidates(
      brasil,
      [game(1, { keywords: ['brazil'] }), game(2, { keywords: ['brazil'] })],
      noPlaces,
    );

    expect(candidates).toEqual([]);
  });

  it('corta o resumo longo em volta do termo', () => {
    const summary = `${'a'.repeat(100)} Brazil ${'b'.repeat(100)}`;

    const [candidate] = suggestCandidates(brasil, [game(3, { summary })], noPlaces);

    expect(candidate?.evidence[0]).toBe(
      `resumo (Brazil): …${'a'.repeat(59)} Brazil ${'b'.repeat(59)}…`,
    );
  });
});
