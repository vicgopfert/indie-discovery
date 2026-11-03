import { pickInterests } from './interests';
import { buildProfile, type Interaction } from './profile';
import {
  featurePosition,
  GENERIC_LIBRARY,
  genericIndex,
  rated,
  scoringConfig,
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
      index.features,
      hiddenPositions,
      scoringConfig,
    );
    return { profile, interests, slugs: interests.map((i) => index.features[i.position]!.slug) };
  }

  // Seis jogos de RPG, Aventura, Fantasia e Ação e dois de terror sem nenhum desses atributos,
  // todos com nota 5 (w = 2).
  const library = () => TASTE_LIBRARY.map((slug) => rated(index, slug, 5));

  it('o gosto secundário vira interesse, mesmo com os quatro atributos dominantes à frente em u_k', () => {
    const { profile, slugs } = interestsOf(library());

    const byU = [...index.features.keys()]
      .filter(
        (p) => profile.vector[p]! > 0 && !hidden.has(p) && index.features[p]!.type !== 'KEYWORD',
      )
      .sort((a, b) => profile.vector[b]! - profile.vector[a]!)
      .map((p) => index.features[p]!.slug);
    expect(byU.slice(0, scoringConfig.lists.maxInterests).sort()).toEqual([...dominant].sort());

    expect(slugs).toHaveLength(2);
    expect(slugs[1]).toBe('horror');
  });

  it('só um atributo dominante entra: os outros não cobrem nenhum jogo novo', () => {
    const { profile, slugs } = interestsOf(library());

    const [first] = slugs;
    expect(dominant).toContain(first);
    for (const other of dominant.filter((slug) => slug !== first)) {
      expect(slugs).not.toContain(other);
      // No empate da cobertura (os seis jogos), entra o de maior u_k.
      expect(profile.vector[position(first!)]!).toBeGreaterThanOrEqual(
        profile.vector[position(other)]!,
      );
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

  it('só com preferências, cada uma vira interesse, com cotas iguais, na ordem da posição', () => {
    const { interests, slugs } = interestsOf([], ['sci-fi', 'puzzle', 'horror']);

    expect(slugs).toEqual(['puzzle', 'horror', 'sci-fi']);
    expect(interests.map(({ share }) => share)).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it('a preferência entra como item de peso β, que só tem o próprio atributo', () => {
    const { interests, slugs } = interestsOf([rated(index, 'fright-c', 5)], ['puzzle']);

    // fright-c (w = 2) cobre o terror, que tem u_k maior que a ficção científica do mesmo jogo;
    // a preferência (β = 1), o quebra-cabeça.
    expect(slugs).toEqual(['horror', 'puzzle']);
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

    expect(slugs).toEqual(['rpg', 'shooter', 'puzzle', 'horror']);
  });

  it('o mesmo estado dá os mesmos interesses, em qualquer ordem das interações', () => {
    const forward = interestsOf(library(), ['sci-fi']).interests;
    const backward = interestsOf(library().reverse(), ['sci-fi']).interests;

    expect(backward).toEqual(forward);
  });
});

describe('pickInterests com um atributo genérico nos dois gostos', () => {
  // Seis jogos de RPG, Fantasia e Aventura e dois de Tiro, Terror e Aventura, todos com nota 5;
  // Aventura está em todo o catálogo.
  const index = genericIndex();
  const interactions = GENERIC_LIBRARY.map((slug) => rated(index, slug, 5));
  const profile = buildProfile(interactions, [], index.features.length, scoringConfig);
  const slugsWith = (interestMaxDocumentRatio: number) =>
    pickInterests(profile, [], index.features, new Set(), {
      ...scoringConfig,
      lists: { ...scoringConfig.lists, interestMaxDocumentRatio },
    }).map(({ position }) => index.features[position]!.slug);

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
