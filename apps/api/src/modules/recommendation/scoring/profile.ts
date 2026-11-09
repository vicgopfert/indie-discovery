import { type FeatureType, ListType } from '../../../generated/prisma/client';
import type { ContentIndex, ContentVector } from '../content-index';
import type { ScoringConfig } from './scoring-config';

export interface Interaction {
  gameId: string;
  slug: string;
  score: number | null;
  lists: readonly ListType[];
  // Sem vetor, o jogo só sai dos candidatos.
  vector: ContentVector | null;
  // A data mais recente entre a nota e a entrada em favoritos, em milissegundos; nula sem nenhuma
  // das duas.
  likedAt: number | null;
}

// O que está gravado na biblioteca do jogador. O jogo que saiu do catálogo continua nela, com os
// atributos lidos do banco.
export interface LibraryState {
  // As datas em milissegundos.
  ratings: readonly { gameId: string; score: number; ratedAt: number }[];
  listEntries: readonly { gameId: string; listType: ListType; addedAt: number }[];
  unindexedGames: ReadonlyMap<
    string,
    { slug: string; features: readonly { type: FeatureType; igdbId: number }[] }
  >;
}

// Nota e listas do mesmo jogo viram uma interação só. O jogo fora do índice tem o vetor montado com
// os atributos gravados no banco.
export function interactionsOf(
  index: Pick<ContentIndex, 'games' | 'positionByGameId' | 'vectorOf'>,
  { ratings, listEntries, unindexedGames }: LibraryState,
): Interaction[] {
  const byGame = new Map<
    string,
    { score: number | null; lists: ListType[]; likedAt: number | null }
  >();
  const entryOf = (gameId: string) => {
    const entry = byGame.get(gameId) ?? { score: null, lists: [], likedAt: null };
    byGame.set(gameId, entry);
    return entry;
  };
  const liked = (entry: { likedAt: number | null }, at: number) => {
    entry.likedAt = Math.max(entry.likedAt ?? at, at);
  };
  for (const { gameId, score, ratedAt } of ratings) {
    const entry = entryOf(gameId);
    entry.score = score;
    liked(entry, ratedAt);
  }
  for (const { gameId, listType, addedAt } of listEntries) {
    const entry = entryOf(gameId);
    entry.lists.push(listType);
    if (listType === ListType.FAVORITE) liked(entry, addedAt);
  }

  return [...byGame].map(([gameId, entry]) => {
    const position = index.positionByGameId.get(gameId);
    if (position !== undefined) {
      const game = index.games[position]!;
      return { gameId, slug: game.slug, ...entry, vector: game };
    }
    const { slug = gameId, features = [] } = unindexedGames.get(gameId) ?? {};
    return { gameId, slug, ...entry, vector: index.vectorOf(features) };
  });
}

export interface WeightedGame {
  gameId: string;
  weight: number;
  vector: ContentVector;
}

export interface Profile {
  // Denso: uma posição por atributo do índice.
  vector: Float64Array;
  norm: number;
  // Os jogos que moveram o perfil, para as prateleiras de interesse.
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

// u = Σ w_i · v_i + β · Σ e_f, com e_f o vetor unitário de cada atributo preferido. A soma
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
export function profileDot(profile: Profile, game: ContentVector): number {
  let dot = 0;
  for (let i = 0; i < game.featurePositions.length; i++) {
    dot += profile.vector[game.featurePositions[i]!]! * game.weights[i]!;
  }
  return dot;
}
