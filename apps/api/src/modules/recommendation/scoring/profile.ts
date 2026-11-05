import { FeatureType, type ListType } from '../../../generated/prisma/client';
import type { ContentIndex, ContentVector } from '../content-index';
import type { ScoringConfig } from './scoring-config';

export interface Interaction {
  gameId: string;
  score: number | null;
  lists: readonly ListType[];
  // Sem vetor, o jogo só sai dos candidatos.
  vector: ContentVector | null;
  // Índices em ContentIndex.styles.
  styles: readonly number[];
}

// O que está gravado na biblioteca do jogador. O jogo que saiu do catálogo continua nela, com os
// atributos e o resumo lidos do banco.
export interface LibraryState {
  ratings: readonly { gameId: string; score: number }[];
  listEntries: readonly { gameId: string; listType: ListType }[];
  unindexedGames: ReadonlyMap<
    string,
    { features: readonly { type: FeatureType; igdbId: number; slug: string }[]; summary: string }
  >;
}

// Nota e listas do mesmo jogo viram uma interação só. O jogo fora do índice tem o vetor e os
// estilos montados com os atributos e o resumo gravados no banco.
export function interactionsOf(
  index: Pick<ContentIndex, 'games' | 'positionByGameId' | 'vectorOf' | 'stylesOf'>,
  { ratings, listEntries, unindexedGames }: LibraryState,
): Interaction[] {
  const byGame = new Map<string, { score: number | null; lists: ListType[] }>();
  const entryOf = (gameId: string) => {
    const entry = byGame.get(gameId) ?? { score: null, lists: [] };
    byGame.set(gameId, entry);
    return entry;
  };
  for (const { gameId, score } of ratings) entryOf(gameId).score = score;
  for (const { gameId, listType } of listEntries) entryOf(gameId).lists.push(listType);

  return [...byGame].map(([gameId, { score, lists }]) => {
    const position = index.positionByGameId.get(gameId);
    if (position !== undefined) {
      const game = index.games[position]!;
      return { gameId, score, lists, vector: game, styles: game.styles };
    }
    const { features = [], summary = '' } = unindexedGames.get(gameId) ?? {};
    const keywords = features.filter(({ type }) => type === FeatureType.KEYWORD);
    return {
      gameId,
      score,
      lists,
      vector: index.vectorOf(features),
      styles: index.stylesOf({ keywords: keywords.map(({ slug }) => slug), summary }),
    };
  });
}

export interface WeightedGame {
  gameId: string;
  weight: number;
  vector: ContentVector;
  styles: readonly number[];
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
    games.push({
      gameId: interaction.gameId,
      weight,
      vector: interaction.vector,
      styles: interaction.styles,
    });
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
export function profileDot(profile: Profile, game: ContentVector): number {
  let dot = 0;
  for (let i = 0; i < game.featurePositions.length; i++) {
    dot += profile.vector[game.featurePositions[i]!]! * game.weights[i]!;
  }
  return dot;
}
