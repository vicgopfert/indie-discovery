import { FeatureType, ListType, ReleaseStatus } from '../../../generated/prisma/client';
import type { IndexedFeature, IndexedGame } from '../content-index';
import { explainer, type ScoredReason } from './explain';
import { buildProfile, type Interaction } from './profile';
import {
  featurePosition,
  gameOf,
  rated,
  scoringConfig,
  scoringIndex,
  TAGGED_LIBRARY,
  taggedIndex,
} from './scoring.fixture';

describe('explain', () => {
  const index = scoringIndex();

  function reasonFor(slug: string, interactions: Interaction[], preferences: string[] = []) {
    const profile = buildProfile(
      interactions,
      preferences.map((p) => featurePosition(index, p)),
      index.features.length,
      scoringConfig,
    );
    return explainer(profile, index)(gameOf(index, slug));
  }
  const featureSlugs = (reason: ScoredReason | null) =>
    reason?.kind === 'features' ? reason.features.map((f) => f.slug) : reason;

  it('sem etiqueta a favor, mostra os gêneros e temas de maior contribuição, da maior para a menor', () => {
    expect(featureSlugs(reasonFor('dead-cells', [rated(index, 'hades', 5)]))).toEqual([
      'roguelike',
      'fantasy',
    ]);
  });

  it('a etiqueta que pode virar prateleira vem antes das outras etiquetas e dos gêneros', () => {
    // Free Solo divide com Celeste a etiqueta Escalada e a visual Pixel Art.
    expect(reasonFor('free-solo', [rated(index, 'celeste', 5)])).toEqual({
      kind: 'features',
      features: [{ type: FeatureType.TAG, slug: 'rock-climbing', name: 'Escalada' }],
    });
  });

  it('a etiqueta sem prateleira só entra se nenhuma das primeiras contribuir, antes dos gêneros', () => {
    // Spelunky divide com Celeste o gênero Platform e a etiqueta visual Pixel Art.
    expect(featureSlugs(reasonFor('spelunky', [rated(index, 'celeste', 5)]))).toEqual([
      'pixel-art',
    ]);
  });

  it('a etiqueta com contribuição negativa não entra, e o motivo passa ao grupo seguinte', () => {
    // A nota 1 em Climb-only, que só tem Escalada, deixa a etiqueta negativa no perfil.
    const reason = reasonFor('free-solo', [
      rated(index, 'celeste', 5),
      rated(index, 'climb-only', 1),
    ]);

    expect(featureSlugs(reason)).toEqual(['pixel-art']);
  });

  it('só com preferências declaradas, mostra os gêneros e temas preferidos que o jogo tem', () => {
    // Fantasy é o único tema do jogo e pesa mais que Roguelike, que divide o bloco com Platform.
    expect(featureSlugs(reasonFor('dead-cells', [], ['roguelike', 'horror', 'fantasy']))).toEqual([
      'fantasy',
      'roguelike',
    ]);
  });

  it('todo motivo é etiqueta, gênero ou tema, com no máximo três, em qualquer candidato', () => {
    const profiles = [
      [rated(index, 'celeste', 5)],
      [rated(index, 'dead-cells', 5), rated(index, 'climb-only', 1)],
      [rated(index, 'spelunky', null, [ListType.FAVORITE])],
    ];
    for (const interactions of profiles) {
      for (const game of index.games) {
        const reason = reasonFor(game.slug, interactions);
        if (reason?.kind !== 'features') continue;
        for (const { type } of reason.features) {
          expect([FeatureType.TAG, FeatureType.GENRE, FeatureType.THEME]).toContain(type);
        }
        expect(reason.features.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

// Com as etiquetas no vetor, todo atributo dele vira motivo. O jogo curtido só aparece com um tipo
// de atributo que não vira motivo, montado aqui à mão.
describe('explain sem atributo que vire motivo', () => {
  const keyword = (slug: string): IndexedFeature => ({
    id: slug,
    type: FeatureType.KEYWORD,
    slug,
    name: slug,
    documentRatio: 0.1,
    shelf: false,
  });
  const index = { features: [keyword('a'), keyword('b')] };
  const vector = (weights: number[]) => ({
    featurePositions: Int32Array.from(weights.keys()),
    weights: Float64Array.from(weights),
  });
  const liked = (gameId: string, score: number, weights: number[], lists: ListType[] = []) => ({
    gameId,
    score,
    lists,
    vector: vector(weights),
  });
  const candidate: IndexedGame = {
    id: 'g-candidate',
    slug: 'candidate',
    releaseStatus: ReleaseStatus.RELEASED,
    popularityNorm: 0.5,
    ...vector([1, 0]),
  };
  const reasonFor = (interactions: Interaction[]) =>
    explainer(buildProfile(interactions, [], 2, scoringConfig), index)(candidate);

  it('mostra o jogo da biblioteca que mais pesou', () => {
    expect(reasonFor([liked('g-a', 5, [0.6, 0.8])])).toEqual({
      kind: 'liked-game',
      gameId: 'g-a',
    });
  });

  it('escolhe o jogo de maior w_i · cos(v_i, v_j), não o de maior nota', () => {
    // B tem nota menor, mas é favorito (w = 3) e mais parecido com o candidato.
    const reason = reasonFor([
      liked('g-a', 5, [0.6, 0.8]),
      liked('g-b', 4, [1, 0], [ListType.FAVORITE]),
    ]);

    expect(reason).toEqual({ kind: 'liked-game', gameId: 'g-b' });
  });
});

describe('explain com etiquetas', () => {
  const index = taggedIndex();
  const reasonFor = (slug: string, interactions: Interaction[]) => {
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    const reason = explainer(profile, index)(gameOf(index, slug));
    return reason?.kind === 'features' ? reason.features : reason;
  };
  const library = () => TAGGED_LIBRARY.map((slug) => rated(index, slug, 5));
  const survivalHorror = {
    type: FeatureType.TAG,
    slug: 'survival-horror',
    name: 'Terror de Sobrevivência',
  };

  it('a etiqueta entra no motivo pela contribuição dela, sem gênero nem tema junto', () => {
    expect(reasonFor('scare-a', [rated(index, 'scare-1', 5)])).toEqual([survivalHorror]);
    expect(reasonFor('scare-b', library())).toEqual([survivalHorror]);
  });

  it('a contribuição negativa tira a etiqueta do motivo', () => {
    // A nota 1 em rogue-1, que só tem Roguelike, deixa a etiqueta negativa no perfil.
    const reason = reasonFor('rogue-a', [rated(index, 'quest-1', 5), rated(index, 'rogue-1', 1)]);

    expect(reason).toEqual([{ type: FeatureType.GENRE, slug: 'rpg', name: 'RPG' }]);
  });
});
