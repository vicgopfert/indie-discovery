import { FeatureType } from '../../../generated/prisma/client';
import type { IndexedFeature } from '../content-index';
import type { Profile } from './profile';
import type { ScoringConfig } from './scoring-config';

const INTEREST_TYPES: ReadonlySet<FeatureType> = new Set([FeatureType.GENRE, FeatureType.THEME]);

export interface Interest {
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
// A cada passo entra o gênero ou tema que cobre mais peso ainda não coberto; no empate, o de
// maior u_k e depois o de menor posição. Só concorre quem tem u_k > 0, para que notas negativas
// possam anular um atributo, e quem não passa do limite de frequência no catálogo: um atributo
// em quase metade dos jogos (Aventura, Ação) cobre a biblioteca inteira sozinho. Ele continua na
// pontuação e no motivo.
export function pickInterests(
  profile: Profile,
  preferencePositions: readonly number[],
  features: readonly IndexedFeature[],
  hiddenPositions: ReadonlySet<number>,
  config: ScoringConfig,
): Interest[] {
  const u = profile.vector;
  const candidates = new Set<number>();
  u.forEach((value, position) => {
    const { type, documentRatio } = features[position]!;
    if (value <= 0 || !INTEREST_TYPES.has(type) || hiddenPositions.has(position)) return;
    if (documentRatio <= config.lists.interestMaxDocumentRatio) candidates.add(position);
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

  const picked: Omit<Interest, 'share'>[] = [];
  while (picked.length < config.lists.maxInterests) {
    const gains = new Map<number, number>();
    for (const { weight, positions } of uncovered) {
      for (const position of positions) {
        if (candidates.has(position)) gains.set(position, (gains.get(position) ?? 0) + weight);
      }
    }

    let best: Omit<Interest, 'share'> | null = null;
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
  return picked.map((interest) => ({ ...interest, share: interest.coverage / total }));

  function isBetter(position: number, coverage: number, best: Omit<Interest, 'share'>) {
    if (coverage !== best.coverage) return coverage > best.coverage;
    if (u[position] !== u[best.position]) return u[position]! > u[best.position]!;
    return position < best.position;
  }
}
