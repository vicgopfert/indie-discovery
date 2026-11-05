import { FeatureType, ListType } from '../../../generated/prisma/client';
import { explainer, type ScoredReason } from './explain';
import { buildProfile, type Interaction } from './profile';
import {
  featurePosition,
  gameOf,
  rated,
  scoringConfig,
  scoringIndex,
  STYLED_LIBRARY,
  styledIndex,
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

  it('mostra os gêneros e temas de maior contribuição, da maior para a menor', () => {
    expect(featureSlugs(reasonFor('dead-cells', [rated(index, 'hades', 5)]))).toEqual([
      'roguelike',
      'fantasy',
    ]);
  });

  it('nunca mostra palavra-chave, mesmo quando ela é o que mais contribui', () => {
    // Celeste e Spelunky dividem Platform e a palavra-chave pixel art.
    expect(featureSlugs(reasonFor('spelunky', [rated(index, 'celeste', 5)]))).toEqual(['platform']);
  });

  it('sem gênero ou tema a favor, mostra o jogo da biblioteca que mais pesou', () => {
    // Climb-only só tem a palavra-chave rock climbing, que divide com Celeste.
    expect(reasonFor('climb-only', [rated(index, 'celeste', 5)])).toEqual({
      kind: 'liked-game',
      gameId: 'g-celeste',
    });
  });

  it('escolhe o jogo de maior w_i · cos(v_i, v_j), não o de maior nota', () => {
    // Free Solo tem nota menor, mas é favorito e mais parecido com Climb-only.
    const reason = reasonFor('climb-only', [
      rated(index, 'celeste', 5),
      rated(index, 'free-solo', 4, [ListType.FAVORITE]),
    ]);

    expect(reason).toEqual({ kind: 'liked-game', gameId: 'g-free-solo' });
  });

  it('só com preferências declaradas, mostra os gêneros e temas preferidos que o jogo tem', () => {
    // Fantasy é o único tema do jogo e pesa mais que Roguelike, que divide o bloco com Platform.
    expect(featureSlugs(reasonFor('dead-cells', [], ['roguelike', 'horror', 'fantasy']))).toEqual([
      'fantasy',
      'roguelike',
    ]);
  });

  it('nenhum motivo é palavra-chave, em nenhum candidato', () => {
    const profiles = [
      [rated(index, 'celeste', 5)],
      [rated(index, 'dead-cells', 5), rated(index, 'climb-only', 1)],
      [rated(index, 'spelunky', null, [ListType.FAVORITE])],
    ];
    for (const interactions of profiles) {
      for (const game of index.games) {
        const reason = reasonFor(game.slug, interactions);
        if (reason?.kind !== 'features') continue;
        expect(reason.features.map((f) => f.type)).not.toContain(FeatureType.KEYWORD);
        expect(reason.features.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('explain com estilos', () => {
  const index = styledIndex();
  const reasonFor = (slug: string, interactions: Interaction[]) => {
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    const reason = explainer(profile, index)(gameOf(index, slug));
    return reason?.kind === 'features' ? reason.features : reason;
  };
  const library = () => STYLED_LIBRARY.map((slug) => rated(index, slug, 5));
  const style = { type: 'STYLE', slug: 'survival-horror', name: 'Terror de sobrevivência' };

  it('o estilo entra no motivo pela contribuição das palavras-chave dele', () => {
    // scare-a tem a palavra-chave survival-horror, que scare-1, da biblioteca, também tem. Com
    // scare-1 sozinho no perfil, ela fica entre as três maiores contribuições.
    expect(reasonFor('scare-a', [rated(index, 'scare-1', 5)])).toContainEqual(style);
  });

  it('o estilo que veio só do resumo não entra no motivo: não contribuiu para a pontuação', () => {
    const reason = reasonFor('scare-b', library());

    expect(reason).not.toContainEqual(style);
    expect(reason).toEqual(expect.arrayContaining([expect.objectContaining({ slug: 'horror' })]));
  });

  it('sem gênero ou tema a favor, o estilo pode ser o único motivo', () => {
    // rogue-1 só tem a palavra-chave roguelite, que rogue-a também tem.
    expect(reasonFor('rogue-1', [rated(index, 'rogue-a', 5)])).toEqual([
      { type: 'STYLE', slug: 'roguelike', name: 'Roguelike' },
    ]);
  });

  it('a contribuição negativa das palavras-chave tira o estilo do motivo', () => {
    // A nota 1 em rogue-1 deixa a palavra-chave roguelite negativa no perfil.
    const reason = reasonFor('rogue-a', [rated(index, 'quest-1', 5), rated(index, 'rogue-1', 1)]);

    expect(reason).not.toContainEqual({ type: 'STYLE', slug: 'roguelike', name: 'Roguelike' });
  });
});
