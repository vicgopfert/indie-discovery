import { listAttribute } from './lists';
import { pickInterests } from './interests';
import { buildProfile, type Interaction } from './profile';
import {
  AMNESIA_LIBRARY,
  amnesiaIndex,
  featurePosition,
  GENERIC_LIBRARY,
  genericIndex,
  rated,
  scoringConfig,
  scoringIndex,
  TAGGED_LIBRARY,
  taggedIndex,
  TASTE_LIBRARY,
  tasteIndex,
} from './scoring.fixture';

describe('pickInterests', () => {
  const index = tasteIndex();
  const position = (slug: string) => featurePosition(index, slug);
  const hidden = new Set([position('indie')]);
  const dominant = ['rpg', 'adventure', 'fantasy', 'action'];

  function interestsOf(
    interactions: Interaction[],
    preferences: string[] = [],
    hiddenPositions: ReadonlySet<number> = hidden,
  ) {
    const preferencePositions = preferences.map(position);
    const profile = buildProfile(
      interactions,
      preferencePositions,
      index.features.length,
      scoringConfig,
    );
    const interests = pickInterests(
      profile,
      preferencePositions,
      index,
      hiddenPositions,
      scoringConfig,
    );
    return {
      profile,
      interests,
      slugs: interests.map((i) => listAttribute(i.position, index).slug),
    };
  }

  // Seis jogos de RPG, Aventura, Fantasia e Ação e dois de terror sem nenhum desses atributos,
  // todos com nota 5 (w = 2).
  const library = () => TASTE_LIBRARY.map((slug) => rated(index, slug, 5));

  it('o gosto secundário vira interesse, mesmo com os quatro atributos dominantes à frente em u_k', () => {
    const { profile, slugs } = interestsOf(library());

    const byU = [...index.features.keys()]
      .filter((p) => profile.vector[p]! > 0 && !hidden.has(p) && index.features[p]!.shelf)
      .sort((a, b) => profile.vector[b]! - profile.vector[a]!)
      .map((p) => index.features[p]!.slug);
    expect(byU.slice(0, scoringConfig.lists.maxInterests).sort()).toEqual([...dominant].sort());

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

  it('a cota de cada interesse é o peso que ele cobriu: 6w contra 2w', () => {
    const { interests } = interestsOf(library());

    expect(interests.map(({ coverage }) => coverage)).toEqual([12, 4]);
    expect(interests.map(({ share }) => share)).toEqual([0.75, 0.25]);
  });

  it('deixa de fora o atributo escondido dos filtros, mesmo cobrindo a biblioteca inteira', () => {
    expect(interestsOf(library()).slugs).not.toContain('indie');
    expect(interestsOf(library(), [], new Set()).slugs).toEqual(['indie']);
  });

  it('só com preferências, cada uma vira interesse, com cotas iguais, do menos frequente ao mais', () => {
    const { interests, slugs } = interestsOf([], ['horror', 'sci-fi', 'puzzle']);

    // Quebra-cabeça e ficção científica estão em 2 jogos do catálogo, e o terror em 7; no empate
    // da frequência, vale a posição.
    expect(slugs).toEqual(['puzzle', 'sci-fi', 'horror']);
    expect(interests.map(({ share }) => share)).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('a preferência entra como item de peso β, que só tem o próprio atributo', () => {
    const { interests, slugs } = interestsOf([rated(index, 'fright-c', 5)], ['puzzle']);

    // fright-c (w = 2) cobre o terror e a ficção científica; empatados, entra a ficção científica,
    // menos frequente. A preferência (β = 1) cobre o quebra-cabeça.
    expect(slugs).toEqual(['sci-fi', 'puzzle']);
    expect(interests.map(({ coverage }) => coverage)).toEqual([2, scoringConfig.preferenceWeight]);
  });

  it('a nota negativa que anula um atributo tira ele dos interesses', () => {
    // O terror de dread-1 (w = 1) é anulado por dread-2 (w = −2), que só tem terror como tema.
    const { profile, slugs } = interestsOf([
      rated(index, 'dread-1', 4),
      rated(index, 'dread-2', 1),
    ]);

    expect(profile.vector[position('horror')]!).toBeLessThan(0);
    expect(slugs).not.toContain('horror');
    expect(slugs.length).toBeGreaterThan(0);
  });

  it('para no máximo da configuração', () => {
    const { slugs } = interestsOf([], ['rpg', 'shooter', 'puzzle', 'horror', 'survival', 'sci-fi']);

    // Todas valem β: entram as quatro menos frequentes (Tiro, Quebra-cabeça e Ficção científica em
    // 2 jogos, Sobrevivência em 3); RPG (17) e Terror (7) ficam de fora.
    expect(slugs).toEqual(['shooter', 'puzzle', 'sci-fi', 'survival']);
  });

  it('o mesmo estado dá os mesmos interesses, em qualquer ordem das interações', () => {
    const forward = interestsOf(library(), ['sci-fi']).interests;
    const backward = interestsOf(library().reverse(), ['sci-fi']).interests;

    expect(backward).toEqual(forward);
  });
});

describe('pickInterests com etiquetas', () => {
  const index = taggedIndex();
  const slugsOf = (interactions: Interaction[], lists = scoringConfig.lists) => {
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    return pickInterests(profile, [], index, new Set(), { ...scoringConfig, lists }).map(
      ({ position, coverage }) => [listAttribute(position, index).slug, coverage],
    );
  };
  const library = TAGGED_LIBRARY.map((slug) => rated(index, slug, 5));

  it('a etiqueta concorre ao lado dos gêneros e temas', () => {
    // O terror de sobrevivência empata com Terror e Tiro na cobertura e no peso na biblioteca e
    // entra por ser o menos frequente.
    expect(slugsOf(library)).toEqual([
      ['fantasy', 12],
      ['survival-horror', 4],
    ]);
  });

  it('a etiqueta menos frequente vence o gênero no empate', () => {
    expect(slugsOf([rated(index, 'rogue-a', 5)])).toEqual([['roguelike', 2]]);
  });

  it('a etiqueta com u_k ≤ 0 não concorre', () => {
    // rogue-1 só tem Roguelike: a nota 1 (w = −2) anula a nota 5 de rogue-a.
    expect(slugsOf([rated(index, 'rogue-a', 5), rated(index, 'rogue-1', 1)])).toEqual([['rpg', 2]]);
  });

  it('o limite de frequência no catálogo vale para as etiquetas', () => {
    const ratio = index.features[featurePosition(index, 'survival-horror')]!.documentRatio;
    const below = { ...scoringConfig.lists, interestMaxDocumentRatio: ratio - 0.001 };

    expect(slugsOf(library, below).map(([slug]) => slug)).not.toContain('survival-horror');
  });
});

describe('pickInterests: etiqueta que não pode virar prateleira', () => {
  const index = scoringIndex();

  it('a etiqueta visual não concorre, mesmo cobrindo a biblioteca inteira', () => {
    // Pixel Art está nos dois jogos; Escalada, só em Celeste.
    const interactions = [rated(index, 'celeste', 5), rated(index, 'spelunky', 5)];
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    const slugs = pickInterests(profile, [], index, new Set(), scoringConfig).map(
      ({ position }) => listAttribute(position, index).slug,
    );

    expect(profile.vector[featurePosition(index, 'pixel-art')]!).toBeGreaterThan(0);
    expect(slugs).not.toContain('pixel-art');
  });
});

describe('pickInterests: desempate da cobertura (caso Amnesia)', () => {
  const index = amnesiaIndex();
  const slugsOf = (library: string[]) => {
    const interactions = library.map((slug) => rated(index, slug, 5));
    const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
    return pickInterests(profile, [], index, new Set(), scoringConfig).map(
      ({ position }) => listAttribute(position, index).slug,
    );
  };

  it('entre os atributos de Amnesia, entra o de maior peso na biblioteca: Terror, em três jogos', () => {
    // Pelo u_k entraria um gênero (Quebra-cabeça ou Tiro); pelo menos frequente, Furtividade,
    // que só Amnesia tem.
    expect(slugsOf(AMNESIA_LIBRARY)).toEqual(['rpg', 'horror']);
  });

  it('com o mesmo peso na biblioteca, entra o menos frequente no catálogo', () => {
    // Sem Undertale, Tiro e Terror estão em Amnesia e 7 Days to Die; Tiro está em mais jogos do
    // catálogo.
    const library = AMNESIA_LIBRARY.filter((slug) => slug !== 'undertale');
    const ratio = (slug: string) => index.features[featurePosition(index, slug)]!.documentRatio;

    expect(ratio('horror')).toBeLessThan(ratio('shooter'));
    expect(slugsOf(library)).toEqual(['rpg', 'horror']);
  });
});

describe('pickInterests com um atributo genérico nos dois gostos', () => {
  // Seis jogos de RPG, Fantasia e Aventura e dois de Tiro, Terror e Aventura, todos com nota 5;
  // Aventura está em todo o catálogo.
  const index = genericIndex();
  const interactions = GENERIC_LIBRARY.map((slug) => rated(index, slug, 5));
  const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
  const slugsWith = (interestMaxDocumentRatio: number) =>
    pickInterests(profile, [], index, new Set(), {
      ...scoringConfig,
      lists: { ...scoringConfig.lists, interestMaxDocumentRatio },
    }).map(({ position }) => listAttribute(position, index).slug);

  it('sem o limite de frequência, Aventura cobre a biblioteca inteira e vira o único interesse', () => {
    expect(slugsWith(1)).toEqual(['adventure']);
  });

  it('com o limite, o gosto secundário vira o segundo interesse', () => {
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
