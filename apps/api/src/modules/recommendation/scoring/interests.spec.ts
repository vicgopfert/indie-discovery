import type { ContentIndex } from '../content-index';
import { pickInterests } from './interests';
import { listAttribute } from './lists';
import { buildProfile, type Interaction } from './profile';
import type { ListsConfig } from './scoring-config';
import {
  AMNESIA_LIBRARY,
  amnesiaIndex,
  featurePosition,
  GENERIC_LIBRARY,
  gameId,
  genericIndex,
  rated,
  SHELF_LIBRARY,
  scoringConfig,
  scoringIndex,
  shelfIndex,
  TAGGED_LIBRARY,
  taggedIndex,
  TASTE_LIBRARY,
  tasteIndex,
} from './scoring.fixture';

function interestsIn(
  index: ContentIndex,
  interactions: Interaction[],
  {
    preferences = [],
    hidden = new Set<number>(),
    lists = {},
  }: { preferences?: string[]; hidden?: ReadonlySet<number>; lists?: Partial<ListsConfig> } = {},
) {
  const preferencePositions = preferences.map((slug) => featurePosition(index, slug));
  const profile = buildProfile(
    interactions,
    preferencePositions,
    index.features.length,
    scoringConfig,
  );
  const interests = pickInterests(profile, preferencePositions, index, hidden, {
    ...scoringConfig,
    lists: { ...scoringConfig.lists, ...lists },
  });
  return {
    profile,
    interests,
    slugs: interests.map((i) => listAttribute(i.position, index).slug),
  };
}

describe('pickInterests: regra de duas fases', () => {
  const index = shelfIndex();
  const library = () => SHELF_LIBRARY.map((slug) => rated(index, slug, 5));
  const slugsWith = (options: Parameters<typeof interestsIn>[2] = {}) =>
    interestsIn(index, library(), options).slugs;

  it('fase 1 pelas etiquetas de tipo de jogo, o atributo largo só para os jogos sem etiqueta, e a fase 2 completa', () => {
    // Plataforma cobre três jogos e Roguelike, o que sobra (Hades). O RPG largo cobre os dois jogos
    // sem etiqueta de tipo de jogo. Impiedoso, mecânica, entra na fase 2, pelo peso dos quatro jogos.
    expect(slugsWith()).toEqual(['platformer', 'roguelike', 'rpg', 'difficult']);
  });

  it('a cota é o peso de todos os jogos que sustentam a prateleira', () => {
    const { interests } = interestsIn(index, library());

    expect(interests.map(({ coverage }) => coverage)).toEqual([6, 4, 4, 8]);
    expect(interests.map(({ share }) => share)).toEqual([6 / 22, 4 / 22, 4 / 22, 8 / 22]);
    expect(interests.map(({ supportGameIds }) => [...supportGameIds].sort())).toEqual([
      ['celeste', 'dead', 'hollow'].map(gameId),
      ['dead', 'hades'].map(gameId),
      ['tale-1', 'tale-2'].map(gameId),
      ['celeste', 'dead', 'hades', 'hollow'].map(gameId),
    ]);
  });

  it('o gosto de um jogo só não vira prateleira (caso Amnesia), nem pela etiqueta nem pelo tema', () => {
    const { interests, slugs } = interestsIn(index, library());

    expect(slugs).not.toContain('survival-horror');
    expect(slugs).not.toContain('horror');
    expect(interests.flatMap(({ supportGameIds }) => supportGameIds)).not.toContain(
      gameId('amnesia'),
    );
  });

  it('nenhuma ideia se repete: a etiqueta RPG não entra depois do gênero RPG', () => {
    // RPG pesa o mesmo que Roguelike e Metroidvania na fase 2.
    expect(slugsWith()).not.toContain('rpg-tag');
  });

  it('na fase 2, não entra a etiqueta que quase só aparece com outra prateleira no catálogo', () => {
    // Metroidvania está em 4 jogos do catálogo, todos com Plataforma (6): Jaccard de 0,67.
    expect(slugsWith()).not.toContain('metroidvania');
    expect(slugsWith({ lists: { catalogOverlapMax: 0.7 } })).toEqual([
      'platformer',
      'roguelike',
      'rpg',
      'difficult',
      'metroidvania',
    ]);
  });

  it('na fase 1, não entra a etiqueta que repete os jogos da biblioteca de outra prateleira', () => {
    // Roguelike e Plataforma dividem 1 de 4 jogos da biblioteca (Jaccard de 0,25). A fase 2 compara
    // no catálogo, e lá Roguelike entra.
    expect(slugsWith({ lists: { libraryOverlapMax: 0.2 } })).toEqual([
      'platformer',
      'rpg',
      'difficult',
      'roguelike',
    ]);
  });

  it('as etiquetas acima do limite de frequência no catálogo não concorrem', () => {
    const slugs = slugsWith({ lists: { specificMaxDocumentRatio: 0.06 } });

    expect(slugs).not.toContain('platformer');
    expect(slugs).not.toContain('difficult');
    expect(slugs.slice(0, 2)).toEqual(['roguelike', 'metroidvania']);
  });

  it('para no máximo da configuração', () => {
    expect(slugsWith({ lists: { maxInterests: 2 } })).toEqual(['platformer', 'roguelike']);
  });

  it('as preferências entram entre as fases, isentas do suporte, sem repetir uma ideia', () => {
    // Terror só está em Amnesia, mas vale como preferência; o gênero Platform é a ideia da
    // etiqueta Plataforma, que já entrou.
    const { interests, slugs } = interestsIn(index, library(), {
      preferences: ['platform', 'horror'],
    });

    expect(slugs).toEqual(['platformer', 'roguelike', 'rpg', 'horror', 'difficult']);
    expect(interests[3]!.coverage).toBe(2);
  });

  it('a preferência sem nenhum jogo da biblioteca vale β na cota', () => {
    const { interests } = interestsIn(index, [], { preferences: ['horror'] });

    expect(interests).toEqual([
      {
        position: featurePosition(index, 'horror'),
        coverage: scoringConfig.preferenceWeight,
        share: 1,
        supportGameIds: [],
      },
    ]);
  });

  it('a nota negativa que anula um atributo tira ele das prateleiras', () => {
    const { profile, slugs } = interestsIn(index, [
      ...library(),
      rated(index, 'hard-a', 1),
      rated(index, 'hard-b', 1),
    ]);

    expect(profile.vector[featurePosition(index, 'difficult')]!).toBeLessThan(0);
    expect(slugs).toEqual(['platformer', 'roguelike', 'rpg']);
  });

  it('o mesmo estado dá as mesmas prateleiras, em qualquer ordem das interações e preferências', () => {
    const forward = interestsIn(index, library(), { preferences: ['horror', 'fantasy'] });
    const backward = interestsIn(index, library().reverse(), {
      preferences: ['fantasy', 'horror'],
    });

    expect(backward.interests).toEqual(forward.interests);
  });
});

describe('pickInterests: gêneros e temas largos', () => {
  const index = tasteIndex();
  const position = (slug: string) => featurePosition(index, slug);
  const hidden = new Set([position('indie')]);
  const dominant = ['rpg', 'adventure', 'fantasy', 'action'];
  const interestsOf = (interactions: Interaction[], preferences: string[] = []) =>
    interestsIn(index, interactions, { preferences, hidden });

  // Seis jogos de RPG, Aventura, Fantasia e Ação e dois de terror sem nenhum desses atributos,
  // todos com nota 5 (w = 2).
  const library = () => TASTE_LIBRARY.map((slug) => rated(index, slug, 5));

  it('o gosto secundário vira prateleira, mesmo com os quatro atributos dominantes à frente em u_k', () => {
    const { profile, slugs } = interestsOf(library());

    const byU = [...index.features.keys()]
      .filter((p) => profile.vector[p]! > 0 && !hidden.has(p))
      .sort((a, b) => profile.vector[b]! - profile.vector[a]!)
      .map((p) => index.features[p]!.slug);
    expect(byU.slice(0, dominant.length).sort()).toEqual([...dominant].sort());

    expect(slugs).toHaveLength(2);
    expect(slugs[1]).toBe('horror');
  });

  it('só um atributo dominante entra: os outros não cobrem nenhum jogo novo', () => {
    const { slugs } = interestsOf(library());
    const ratio = (slug: string) => index.features[position(slug)]!.documentRatio;

    const [first] = slugs;
    expect(dominant).toContain(first);
    for (const other of dominant.filter((slug) => slug !== first)) {
      expect(slugs).not.toContain(other);
      // Os quatro empatam na cobertura e no peso na biblioteca (os seis jogos): entra o menos
      // frequente no catálogo.
      expect(ratio(first!)).toBeLessThan(ratio(other));
    }
  });

  it('a cota de cada prateleira é o peso dos jogos dela: 6w contra 2w', () => {
    const { interests } = interestsOf(library());

    expect(interests.map(({ coverage }) => coverage)).toEqual([12, 4]);
    expect(interests.map(({ share }) => share)).toEqual([0.75, 0.25]);
  });

  it('deixa de fora o atributo escondido dos filtros, mesmo cobrindo a biblioteca inteira', () => {
    expect(interestsOf(library()).slugs).not.toContain('indie');
    expect(interestsIn(index, library()).slugs).toEqual(['indie']);
  });

  it('só com preferências, cada uma vira prateleira, com cotas iguais, da menos frequente à mais', () => {
    const { interests, slugs } = interestsOf([], ['horror', 'sci-fi', 'puzzle']);

    // Quebra-cabeça e ficção científica estão em 2 jogos do catálogo, e o terror em 7; no empate
    // da frequência, vale a posição.
    expect(slugs).toEqual(['puzzle', 'sci-fi', 'horror']);
    expect(interests.map(({ share }) => share)).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('só com preferências, para no máximo da configuração', () => {
    const { slugs } = interestsOf(
      [],
      ['rpg', 'shooter', 'puzzle', 'horror', 'survival', 'sci-fi', 'fantasy'],
    );

    // Entram as seis menos frequentes; RPG, em 17 jogos, fica de fora.
    expect(slugs).toEqual(['shooter', 'puzzle', 'sci-fi', 'survival', 'horror', 'fantasy']);
  });
});

describe('pickInterests com etiquetas', () => {
  const index = taggedIndex();
  const library = TAGGED_LIBRARY.map((slug) => rated(index, slug, 5));

  it('a etiqueta de subgênero entra na fase 1, e o atributo largo cobre o resto', () => {
    const { interests, slugs } = interestsIn(index, library);

    expect(slugs).toEqual(['survival-horror', 'fantasy']);
    expect(interests.map(({ coverage }) => coverage)).toEqual([4, 12]);
  });

  it('o limite de frequência no catálogo vale para as etiquetas', () => {
    const ratio = index.features[featurePosition(index, 'survival-horror')]!.documentRatio;

    expect(
      interestsIn(index, library, { lists: { specificMaxDocumentRatio: ratio - 0.001 } }).slugs,
    ).not.toContain('survival-horror');
  });
});

describe('pickInterests: etiqueta que não pode virar prateleira', () => {
  const index = scoringIndex();

  it('a etiqueta visual não concorre, mesmo nos dois jogos', () => {
    // Pixel Art está nos dois jogos; Escalada, só em Celeste.
    const { profile, slugs } = interestsIn(index, [
      rated(index, 'celeste', 5),
      rated(index, 'spelunky', 5),
    ]);

    expect(profile.vector[featurePosition(index, 'pixel-art')]!).toBeGreaterThan(0);
    expect(slugs).not.toContain('pixel-art');
  });
});

describe('pickInterests: caso Amnesia sem etiquetas', () => {
  const index = amnesiaIndex();

  it('o RPG cobre sete jogos, e o terror, que só sobra em Amnesia, não vira prateleira', () => {
    // O suporte do atributo largo conta só os jogos que ainda não têm prateleira.
    const { slugs } = interestsIn(
      index,
      AMNESIA_LIBRARY.map((slug) => rated(index, slug, 5)),
    );

    expect(slugs).toEqual(['rpg']);
  });
});

describe('pickInterests com um atributo genérico nos dois gostos', () => {
  // Seis jogos de RPG, Fantasia e Aventura e dois de Tiro, Terror e Aventura, todos com nota 5;
  // Aventura está em todo o catálogo.
  const index = genericIndex();
  const interactions = GENERIC_LIBRARY.map((slug) => rated(index, slug, 5));
  const slugsWith = (interestMaxDocumentRatio: number) =>
    interestsIn(index, interactions, { lists: { interestMaxDocumentRatio } }).slugs;

  it('sem o limite de frequência, Aventura cobre a biblioteca inteira e vira a única prateleira', () => {
    expect(slugsWith(1)).toEqual(['adventure']);
  });

  it('com o limite, o gosto secundário vira a segunda prateleira', () => {
    const slugs = slugsWith(scoringConfig.lists.interestMaxDocumentRatio);

    expect(slugs).toHaveLength(2);
    expect(['rpg', 'fantasy']).toContain(slugs[0]);
    expect(['shooter', 'horror']).toContain(slugs[1]);
  });

  it('o limite usa a fração do catálogo de cada atributo, guardada no índice', () => {
    const ratio = (slug: string) => index.features[featurePosition(index, slug)]!.documentRatio;

    expect(ratio('adventure')).toBe(1);
    expect(ratio('rpg')).toBeCloseTo(10 / 30, 12);
    expect(ratio('horror')).toBeCloseTo(5 / 30, 12);
  });
});
