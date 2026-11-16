import {
  featurePosition,
  gameId,
  scoringConfig,
  taggedIndex,
} from '../modules/recommendation/scoring/scoring.fixture';
import { type CriteriaInput, evaluateCriteria } from './criteria';
import { type EvaluationConfig, readEvaluationConfig } from './evaluation-config';
import type { EvaluationProfile } from './profiles';

const index = taggedIndex();
const base = readEvaluationConfig();
// O fixture tem poucos candidatos: com o mínimo de 4 por prateleira, a principal de 5 e as
// prateleiras por jogo antes das de interesse, nenhuma de interesse sobraria na visão geral.
const scoring = {
  ...scoringConfig,
  lists: { ...scoringConfig.lists, shelfMinItems: 1, overviewMainSize: 1, likedGameShelves: 0 },
};
const evaluation: EvaluationConfig = {
  ...base,
  cases: {
    ...base.cases,
    regression: {
      primaryGenre: 'rpg',
      primaryTheme: 'fantasy',
      primaryCount: 6,
      secondary: ['scare-1', 'scare-2'],
      secondaryPattern: 'Horror',
    },
    realistic: {
      'RPG de fantasia': [
        ['quest-1', 5],
        ['quest-2', 5],
        ['rogue-1', 5],
        ['rogue-a', 4],
      ],
      'só um jogo': [['scare-1', 5]],
    },
    realisticOnlyRecord: ['só um jogo'],
  },
  criteria: { ...base.criteria, minShelves: 1 },
};
const coherent: EvaluationProfile = {
  id: 'coerente-0',
  family: 'coherent',
  sampling: 'uniform',
  stratum: null,
  ratings: [
    ...['quest-1', 'quest-2', 'quest-3', 'quest-4'].map((slug) => ({
      gameId: gameId(slug),
      score: 5,
    })),
    ...['scare-1', 'scare-2'].map((slug) => ({ gameId: gameId(slug), score: 5 })),
  ],
  preferencePositions: [],
  holdouts: [],
  tastes: {
    main: ['quest-1', 'quest-2', 'quest-3', 'quest-4'].map(gameId),
    second: ['scare-1', 'scare-2'].map(gameId),
  },
};
const input: CriteriaInput = {
  index,
  hidden: new Set(),
  scoring,
  evaluation,
  displayName: (position) => index.features[position]!.name,
  englishName: (position) =>
    index.features[position]!.slug === 'survival-horror' ? 'Survival Horror' : null,
  popularityCount: index.games.map(({ popularityNorm }) => Math.round(popularityNorm * 100)),
  seedRated: [],
  seedPreferred: [[featurePosition(index, 'rpg'), featurePosition(index, 'horror')]],
  coherent: [coherent],
};

describe('critérios C1 a C5', () => {
  const result = evaluateCriteria(input);

  it('monta o caso RPG com terror pelos mais populares do gênero e do tema', () => {
    expect(result.regression.games).toEqual([
      'quest-6',
      'quest-5',
      'quest-a',
      'quest-4',
      'quest-3',
      'quest-b',
      'scare-1',
      'scare-2',
    ]);
  });

  it('C1: a prateleira de terror sustentada pelos dois jogos de terror', () => {
    expect(result.regression.shelves.map(({ name }) => name)).toContain('Terror de Sobrevivência');
    expect(result.c1Original).toBe(true);
    expect(result.c1Revised).toBe(true);
    expect(result.c2).toBe(true);
  });

  it('C3 ignora os casos só de registro; C4 conta os perfis por preferências', () => {
    expect(result.realistic.map(({ title }) => title)).toEqual(['RPG de fantasia', 'só um jogo']);
    expect(result.c3).toBe(result.realistic[0]!.passes);
    expect(result.c4).toEqual({ passing: 1, total: 1 });
  });

  it('C5: prateleira só do gosto principal e só do secundário', () => {
    expect(result.c5).toEqual({ main: 1, second: 1, none: 0 });
    expect(result.c5Passes).toEqual({ main: true, second: true, none: true });
    expect(result.repeatedIdeas).toBe(0);
  });

  it('especificidade pelas prateleiras mostradas, sem as preferências', () => {
    expect(result.specificity.shelves).toBeGreaterThan(0);
    expect(result.specificity.median).not.toBeNull();
  });

  it('recusa caso com jogo fora do índice', () => {
    expect(() =>
      evaluateCriteria({
        ...input,
        evaluation: {
          ...evaluation,
          cases: { ...evaluation.cases, realistic: { fora: [['nao-existe', 5]] } },
        },
      }),
    ).toThrow('Jogo fora do índice: nao-existe');
  });
});
