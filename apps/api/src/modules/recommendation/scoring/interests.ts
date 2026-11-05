import { FeatureType } from '../../../generated/prisma/client';
import type { ContentIndex } from '../content-index';
import type { Profile } from './profile';
import type { ScoringConfig } from './scoring-config';

const INTEREST_TYPES: ReadonlySet<FeatureType> = new Set([FeatureType.GENRE, FeatureType.THEME]);

export type InterestAttribute =
  { kind: 'feature'; position: number } | { kind: 'style'; style: number };

export interface Interest {
  attribute: InterestAttribute;
  // O peso dos jogos da biblioteca e das preferências que o interesse cobriu ao entrar.
  coverage: number;
  // A cota dele na lista principal: coverage dividido pelo total coberto.
  share: number;
}

export type InterestCatalog = Pick<ContentIndex, 'features' | 'styles'>;

interface CoverableItem {
  weight: number;
  // Posições dos atributos do vetor e, depois delas, os estilos (features.length + estilo).
  keys: readonly number[];
}

// Escolha gulosa pela cobertura da biblioteca, não pelo maior u_k: o gosto dominante é um grupo
// de atributos que andam juntos nos mesmos jogos e, pelos maiores u_k, ocuparia todas as vagas.
// A cada passo entra o gênero, tema ou estilo que cobre mais peso ainda não coberto. O gênero ou
// tema só concorre com u_k > 0, para que notas negativas possam anular um atributo; o estilo, que
// não tem componente própria em u, com a soma positiva dos pesos dos jogos que o têm. Nenhum
// concorre acima do limite de frequência no catálogo: um atributo em quase metade dos jogos
// (Aventura, Ação) cobre a biblioteca inteira sozinho. Ele continua na pontuação e no motivo.
//
// Mais da metade das escolhas empata na cobertura (B-73). No empate, entra o de maior peso na
// biblioteca, contando os itens já cobertos: o atributo presente em mais jogos de que o jogador
// gostou. Depois, o menos frequente no catálogo, e por fim a posição, com os estilos depois dos
// gêneros e temas. O u_k ficou de fora: pela fatia de 40% do vetor, ele favorecia os gêneros.
export function pickInterests(
  profile: Profile,
  preferencePositions: readonly number[],
  { features, styles }: InterestCatalog,
  hiddenPositions: ReadonlySet<number>,
  config: ScoringConfig,
): Interest[] {
  const limit = config.lists.interestMaxDocumentRatio;
  const styleKey = (style: number) => features.length + style;
  const documentRatio = (key: number) =>
    key < features.length
      ? features[key]!.documentRatio
      : styles[key - features.length]!.documentRatio;

  const candidates = new Set<number>();
  profile.vector.forEach((value, position) => {
    const { type, documentRatio: ratio } = features[position]!;
    if (value <= 0 || !INTEREST_TYPES.has(type) || hiddenPositions.has(position)) return;
    if (ratio <= limit) candidates.add(position);
  });
  const styleWeight = new Map<number, number>();
  for (const { weight, styles: gameStyles } of profile.games) {
    for (const style of gameStyles) styleWeight.set(style, (styleWeight.get(style) ?? 0) + weight);
  }
  for (const [style, weight] of styleWeight) {
    if (weight > 0 && styles[style]!.documentRatio <= limit) candidates.add(styleKey(style));
  }

  let uncovered: CoverableItem[] = [
    ...profile.games
      .filter(({ weight }) => weight > 0)
      .map(({ weight, vector, styles: gameStyles }) => ({
        weight,
        keys: [...vector.featurePositions, ...gameStyles.map(styleKey)],
      })),
    ...[...new Set(preferencePositions)].map((position) => ({
      weight: config.preferenceWeight,
      keys: [position],
    })),
  ].filter(({ weight }) => weight > 0);

  const libraryWeight = new Map<number, number>();
  for (const { weight, keys } of uncovered) {
    for (const key of keys) libraryWeight.set(key, (libraryWeight.get(key) ?? 0) + weight);
  }

  const picked: { key: number; coverage: number }[] = [];
  while (picked.length < config.lists.maxInterests) {
    const gains = new Map<number, number>();
    for (const { weight, keys } of uncovered) {
      for (const key of keys) {
        if (candidates.has(key)) gains.set(key, (gains.get(key) ?? 0) + weight);
      }
    }

    let best: { key: number; coverage: number } | null = null;
    for (const [key, coverage] of gains) {
      if (best === null || isBetter(key, coverage, best)) best = { key, coverage };
    }
    if (best === null) break;

    const { key } = best;
    picked.push(best);
    candidates.delete(key);
    uncovered = uncovered.filter(({ keys }) => !keys.includes(key));
  }

  const total = picked.reduce((sum, { coverage }) => sum + coverage, 0);
  return picked.map(({ key, coverage }) => ({
    attribute:
      key < features.length
        ? { kind: 'feature', position: key }
        : { kind: 'style', style: key - features.length },
    coverage,
    share: coverage / total,
  }));

  function isBetter(key: number, coverage: number, best: { key: number; coverage: number }) {
    if (coverage !== best.coverage) return coverage > best.coverage;
    const weight = libraryWeight.get(key)!;
    const bestWeight = libraryWeight.get(best.key)!;
    if (weight !== bestWeight) return weight > bestWeight;
    const ratio = documentRatio(key);
    const bestRatio = documentRatio(best.key);
    if (ratio !== bestRatio) return ratio < bestRatio;
    return key < best.key;
  }
}
