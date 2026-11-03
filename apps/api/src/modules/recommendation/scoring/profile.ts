import type { ListType } from '../../../generated/prisma/client';
import type { IndexedGame } from '../content-index';
import type { ScoringConfig } from './scoring-config';

export type SparseVector = Pick<IndexedGame, 'featurePositions' | 'weights'>;

export interface Interaction {
  gameId: string;
  score: number | null;
  lists: readonly ListType[];
  // Sem vetor, o jogo só sai dos candidatos.
  vector: SparseVector | null;
}

export interface WeightedGame {
  gameId: string;
  weight: number;
  vector: SparseVector;
}

export interface Profile {
  // Denso: uma posição por atributo do índice.
  vector: Float64Array;
  norm: number;
  // Os jogos que moveram o perfil, para o motivo "Porque você gostou de".
  games: readonly WeightedGame[];
}

// w = (nota − 3) + bônus das listas, somados quando o jogo está em duas.
export function interactionWeight(
  { score, lists }: Pick<Interaction, 'score' | 'lists'>,
  config: ScoringConfig,
): number {
  const bonus = lists.reduce((sum, list) => sum + config.listBonus[list], 0);
  return (score === null ? 0 : score - 3) + bonus;
}

// u = Σ w_i · v_i + β · Σ e_f, com e_f o vetor unitário de cada gênero ou tema preferido. A soma
// em ponto flutuante depende da ordem, e o banco não garante uma: soma na ordem do id do jogo.
export function buildProfile(
  interactions: readonly Interaction[],
  preferencePositions: readonly number[],
  featureCount: number,
  config: ScoringConfig,
): Profile {
  const vector = new Float64Array(featureCount);
  const games: WeightedGame[] = [];
  const byGameId = [...interactions].sort((a, b) =>
    a.gameId < b.gameId ? -1 : a.gameId > b.gameId ? 1 : 0,
  );
  for (const interaction of byGameId) {
    const weight = interactionWeight(interaction, config);
    if (weight === 0 || interaction.vector === null) continue;
    const { featurePositions, weights } = interaction.vector;
    for (let i = 0; i < featurePositions.length; i++) {
      vector[featurePositions[i]!]! += weight * weights[i]!;
    }
    games.push({ gameId: interaction.gameId, weight, vector: interaction.vector });
  }
  for (const position of new Set(preferencePositions)) {
    vector[position]! += config.preferenceWeight;
  }

  let sum = 0;
  for (const value of vector) sum += value * value;
  return { vector, norm: Math.sqrt(sum), games };
}

// Sem nenhuma componente positiva, nenhum candidato tem cosseno acima de zero.
export function hasPositiveComponent(profile: Profile): boolean {
  return profile.vector.some((value) => value > 0);
}

// Os vetores dos jogos têm norma 1 e só pesos positivos.
export function profileDot(profile: Profile, game: SparseVector): number {
  let dot = 0;
  for (let i = 0; i < game.featurePositions.length; i++) {
    dot += profile.vector[game.featurePositions[i]!]! * game.weights[i]!;
  }
  return dot;
}
