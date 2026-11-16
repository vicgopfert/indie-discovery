import { FeatureType } from '../generated/prisma/client';
import {
  featurePosition,
  gameId,
  taggedIndex,
} from '../modules/recommendation/scoring/scoring.fixture';
import { type EvaluationConfig, readEvaluationConfig } from './evaluation-config';
import {
  attributeProfiles,
  coherentProfiles,
  coldStartProfiles,
  onboardingGames,
  postingsOf,
  type ProfileCatalog,
} from './profiles';

const index = taggedIndex();
// Os jogos de enchimento de Aventura sem popularidade: o sorteio proporcional nunca os escolhe.
const catalog: ProfileCatalog = {
  index,
  hidden: new Set(),
  popularityCount: index.games.map(({ slug }) => (slug.startsWith('trail') ? 0 : 10)),
  names: index.games.map(({ slug }) => slug),
};
const base = readEvaluationConfig();
const config: EvaluationConfig = {
  ...base,
  attributeProfiles: {
    ...base.attributeProfiles,
    profilesPerType: 4,
    minGames: 2,
    positiveScores: [5, 4],
    negativeScores: [1],
  },
  coherentProfiles: {
    ...base.coherentProfiles,
    count: 6,
    maxDocumentRatio: 1,
    minGames: 2,
    mainScores: [5, 4],
    secondScores: [5, 4],
  },
  coldStartProfiles: {
    ...base.coldStartProfiles,
    count: 10,
    preferences: 2,
    ratedScores: [5, 4],
    aboveDocumentRatio: 0.05,
    aboveEvery: 5,
  },
};
const gameOf = (id: string) => index.games[index.positionByGameId.get(id)!]!;
const has = (id: string, position: number) => gameOf(id).featurePositions.includes(position);

describe('família A, por atributo', () => {
  const profiles = attributeProfiles(catalog, 'uniform', config);

  it('o mesmo número de perfis para gêneros, temas e etiquetas de tipo de jogo', () => {
    for (const type of [FeatureType.GENRE, FeatureType.THEME, FeatureType.TAG]) {
      expect(profiles.filter(({ stratum }) => stratum === type)).toHaveLength(4);
    }
    const tags = profiles.filter(({ stratum }) => stratum === FeatureType.TAG);
    expect(tags.every(({ attribute }) => index.features[attribute!]!.gameKind)).toBe(true);
    expect(new Set(profiles.map(({ id }) => id)).size).toBe(12);
  });

  it('bem avaliados com o atributo, mal avaliados sem ele, e os bem avaliados são escondidos', () => {
    for (const { attribute, ratings, holdouts } of profiles) {
      const positives = ratings.filter(({ score }) => score >= 4).map(({ gameId: id }) => id);
      const negatives = ratings.filter(({ score }) => score <= 2).map(({ gameId: id }) => id);
      expect(positives).toHaveLength(2);
      expect(negatives).toHaveLength(1);
      expect(positives.every((id) => has(id, attribute!))).toBe(true);
      expect(negatives.some((id) => has(id, attribute!))).toBe(false);
      expect(holdouts).toEqual(positives);
    }
  });

  it('roda os atributos de cada tipo antes de repetir um', () => {
    const tags = profiles.filter(({ stratum }) => stratum === FeatureType.TAG);
    // As duas etiquetas de tipo de jogo do fixture: duas vezes cada.
    expect(new Set(tags.map(({ attribute }) => attribute)).size).toBe(2);
  });

  it('a mesma semente dá os mesmos perfis', () => {
    expect(attributeProfiles(catalog, 'uniform', config)).toEqual(profiles);
  });

  it('o sorteio pela popularidade nunca escolhe jogo sem popularidade', () => {
    const popular = attributeProfiles(catalog, 'popularity', config);
    for (const { ratings } of popular) {
      for (const { gameId: id } of ratings) {
        expect(catalog.popularityCount[index.positionByGameId.get(id)!]).toBeGreaterThan(0);
      }
    }
    expect(popular[0]!.id).toBe('atributo-popularity-genre-0');
  });
});

describe('família B, coerentes', () => {
  const profiles = coherentProfiles(catalog, 'uniform', config);

  it('dois gostos de etiquetas diferentes, o secundário sem a etiqueta do principal', () => {
    expect(profiles).toHaveLength(6);
    for (const { tastes, ratings, holdouts } of profiles) {
      const shared = (ids: readonly string[]) =>
        [...gameOf(ids[0]!).featurePositions].filter(
          (p) => index.features[p]!.type === FeatureType.TAG && ids.every((id) => has(id, p)),
        );
      const [first] = shared(tastes!.main);
      expect(first).toBeDefined();
      expect(tastes!.second.some((id) => has(id, first!))).toBe(false);
      expect(shared(tastes!.second).length).toBeGreaterThan(0);
      expect(ratings.map(({ score }) => score)).toEqual([5, 4, 5, 4]);
      expect(holdouts).toEqual([tastes!.main[0], tastes!.second[0]]);
    }
    expect(profiles[0]!.id).toBe('coerente-0');
  });

  it('a amostragem pela popularidade tem ids próprios', () => {
    expect(coherentProfiles(catalog, 'popularity', config)[0]!.id).toBe('coerente-popularity-0');
  });

  it('com mais perfis, os primeiros continuam os mesmos (a base do C5)', () => {
    const more = coherentProfiles(catalog, 'uniform', {
      ...config,
      coherentProfiles: { ...config.coherentProfiles, count: 12 },
    });

    expect(more).toHaveLength(12);
    expect(more.slice(0, profiles.length)).toEqual(profiles);
  });
});

describe('família C, partida a frio', () => {
  const options = ['rpg', 'fantasy', 'horror', 'survival-horror', 'roguelike'].map((slug) =>
    featurePosition(index, slug),
  );
  const profiles = coldStartProfiles(catalog, options, config);

  it('preferências entre as opções, com a etiqueta acima do limite a cada aboveEvery perfis', () => {
    const above = featurePosition(index, 'survival-horror');
    profiles.forEach(({ preferencePositions }, i) => {
      expect(preferencePositions).toHaveLength(2);
      expect(preferencePositions.every((p) => options.includes(p))).toBe(true);
      if (i % 5 === 0) expect(preferencePositions).toContain(above);
    });
  });

  it('de 0 ao número de notas avaliados, em blocos, tirados da lista de jogos para avaliar', () => {
    expect(profiles.map(({ ratings }) => ratings.length)).toEqual([0, 0, 0, 0, 1, 1, 1, 2, 2, 2]);
    for (const { ratings, preferencePositions, holdouts } of profiles) {
      const expected = onboardingGames(
        catalog,
        postingsOf(index),
        preferencePositions,
        ratings.length,
      ).map((game) => index.games[game]!.id);
      expect(ratings.map(({ gameId: id }) => id)).toEqual(expected);
      expect(holdouts).toEqual(expected);
    }
  });
});

describe('jogos para avaliar', () => {
  it('o mais popular de cada preferência primeiro, em rodadas; empate pelo nome', () => {
    const games = onboardingGames(
      catalog,
      postingsOf(index),
      [featurePosition(index, 'survival-horror'), featurePosition(index, 'rpg')],
      3,
    ).map((game) => index.games[game]!.id);

    expect(games).toEqual([gameId('quest-6'), gameId('scare-a'), gameId('quest-5')]);
  });
});
