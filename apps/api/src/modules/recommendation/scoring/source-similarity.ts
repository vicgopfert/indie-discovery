import type { ContentIndex, ContentVector } from '../content-index';
import type { LikedGame } from './liked-games';

// A semelhança de um jogo de origem com os jogos do índice que têm algum atributo dele, em ordem
// de posição no índice. Os vetores têm norma 1: o produto escalar é o cosseno.
export interface SourceSimilarity {
  positions: Int32Array;
  values: Float64Array;
}

export type SimilarityOf = (liked: LikedGame) => SourceSimilarity;

// Não depende do perfil: a mesma varredura serve a qualquer usuário que tenha o jogo.
export function sourceSimilarity(
  { games, features }: Pick<ContentIndex, 'games' | 'features'>,
  vector: ContentVector,
): SourceSimilarity {
  const source = new Float64Array(features.length);
  vector.featurePositions.forEach((position, i) => {
    source[position] = vector.weights[i]!;
  });
  const positions: number[] = [];
  const values: number[] = [];
  for (let position = 0; position < games.length; position++) {
    const game = games[position]!;
    let dot = 0;
    for (let i = 0; i < game.featurePositions.length; i++) {
      dot += source[game.featurePositions[i]!]! * game.weights[i]!;
    }
    if (dot <= 0) continue;
    positions.push(position);
    values.push(dot);
  }
  return { positions: Int32Array.from(positions), values: Float64Array.from(values) };
}

// Guarda a semelhança dos jogos de origem usados mais recentemente, até o limite da configuração:
// a varredura de cerca de 23 mil jogos por prateleira pesava em toda visão geral e em todo "ver
// mais" na instância de 0,1 CPU (B-79). Vale para um índice só: a recarga cria outro.
export class SimilarityCache {
  private readonly entries = new Map<string, SourceSimilarity>();

  constructor(
    private readonly index: Pick<ContentIndex, 'games' | 'features'>,
    private readonly capacity: number,
  ) {}

  get size() {
    return this.entries.size;
  }

  of({ gameId, vector }: LikedGame): SourceSimilarity {
    let similarity = this.entries.get(gameId);
    if (similarity === undefined) {
      similarity = sourceSimilarity(this.index, vector);
    } else {
      this.entries.delete(gameId);
    }
    this.entries.set(gameId, similarity);
    if (this.entries.size > this.capacity) {
      this.entries.delete(this.entries.keys().next().value!);
    }
    return similarity;
  }
}
