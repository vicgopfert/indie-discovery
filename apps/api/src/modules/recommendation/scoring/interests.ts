import type { ContentIndex } from '../content-index';
import type { Profile } from './profile';
import type { ScoringConfig } from './scoring-config';

export interface Interest {
  // A posição do atributo no índice.
  position: number;
  // O peso dos jogos da biblioteca e das preferências que o interesse cobriu ao entrar.
  coverage: number;
  // A cota dele na lista principal: coverage dividido pelo total coberto.
  share: number;
}

interface CoverableItem {
  weight: number;
  positions: readonly number[];
}

// Escolha gulosa pela cobertura da biblioteca, não pelo maior u_k: o gosto dominante é um grupo
// de atributos que andam juntos nos mesmos jogos e, pelos maiores u_k, ocuparia todas as vagas.
// A cada passo entra o atributo que cobre mais peso ainda não coberto. Concorrem os gêneros, os
// temas e as etiquetas que podem virar prateleira (B-78), só com u_k > 0, para que notas negativas
// possam anular um atributo. Nenhum concorre acima do limite de frequência no catálogo: um atributo
// em quase metade dos jogos (Aventura, Ação) cobre a biblioteca inteira sozinho. Ele continua na
// pontuação e no motivo.
//
// Mais da metade das escolhas empata na cobertura (B-73). No empate, entra o de maior peso na
// biblioteca, contando os itens já cobertos: o atributo presente em mais jogos de que o jogador
// gostou. Depois, o menos frequente no catálogo, e por fim a posição. O u_k ficou de fora: pela
// fatia de 40% do vetor, ele favorecia os gêneros.
export function pickInterests(
  profile: Profile,
  preferencePositions: readonly number[],
  { features }: Pick<ContentIndex, 'features'>,
  hiddenPositions: ReadonlySet<number>,
  config: ScoringConfig,
): Interest[] {
  const limit = config.lists.interestMaxDocumentRatio;
  const candidates = new Set<number>();
  profile.vector.forEach((value, position) => {
    const { shelf, documentRatio } = features[position]!;
    if (value <= 0 || !shelf || hiddenPositions.has(position)) return;
    if (documentRatio <= limit) candidates.add(position);
  });

  let uncovered: CoverableItem[] = [
    ...profile.games
      .filter(({ weight }) => weight > 0)
      .map(({ weight, vector }) => ({ weight, positions: [...vector.featurePositions] })),
    ...[...new Set(preferencePositions)].map((position) => ({
      weight: config.preferenceWeight,
      positions: [position],
    })),
  ].filter(({ weight }) => weight > 0);

  const libraryWeight = new Map<number, number>();
  for (const { weight, positions } of uncovered) {
    for (const position of positions) {
      libraryWeight.set(position, (libraryWeight.get(position) ?? 0) + weight);
    }
  }

  const picked: { position: number; coverage: number }[] = [];
  while (picked.length < config.lists.maxInterests) {
    const gains = new Map<number, number>();
    for (const { weight, positions } of uncovered) {
      for (const position of positions) {
        if (candidates.has(position)) gains.set(position, (gains.get(position) ?? 0) + weight);
      }
    }

    let best: { position: number; coverage: number } | null = null;
    for (const [position, coverage] of gains) {
      if (best === null || isBetter(position, coverage, best)) best = { position, coverage };
    }
    if (best === null) break;

    const { position } = best;
    picked.push(best);
    candidates.delete(position);
    uncovered = uncovered.filter(({ positions }) => !positions.includes(position));
  }

  const total = picked.reduce((sum, { coverage }) => sum + coverage, 0);
  return picked.map(({ position, coverage }) => ({ position, coverage, share: coverage / total }));

  function isBetter(
    position: number,
    coverage: number,
    best: { position: number; coverage: number },
  ) {
    if (coverage !== best.coverage) return coverage > best.coverage;
    const weight = libraryWeight.get(position)!;
    const bestWeight = libraryWeight.get(best.position)!;
    if (weight !== bestWeight) return weight > bestWeight;
    const ratio = features[position]!.documentRatio;
    const bestRatio = features[best.position]!.documentRatio;
    if (ratio !== bestRatio) return ratio < bestRatio;
    return position < best.position;
  }
}
