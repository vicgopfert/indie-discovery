import type { RecommendationList, RecommendationReason } from '@indie/contracts';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { type DiscoveryMode, FeatureType, type ListType } from '../../generated/prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { FeatureLabels, type LabeledFeatureType } from '../catalog/feature-labels';
import type { ContentIndex, IndexedFeature } from './content-index';
import { ContentIndexService } from './content-index.service';
import {
  type RecommendedGameRow,
  RecommendationRepository,
  type UserState,
} from './recommendation.repository';
import type { RecommendationReason as ScoredReason } from './scoring/explain';
import type { Interaction } from './scoring/profile';
import { recommend } from './scoring/recommend';
import type { ScoringConfig } from './scoring/scoring-config';

export const SCORING_CONFIG = Symbol('SCORING_CONFIG');

export const INDEX_UNAVAILABLE =
  'As recomendações ainda não estão disponíveis; tente novamente em alguns instantes.';

@Injectable()
export class GenerateRecommendationsUseCase {
  constructor(
    private readonly contentIndex: ContentIndexService,
    private readonly repository: RecommendationRepository,
    private readonly catalog: CatalogService,
    private readonly labels: FeatureLabels,
    @Inject(SCORING_CONFIG) private readonly config: ScoringConfig,
  ) {}

  // Com o índice carregando ou com falha, 503, nunca lista vazia: o jogador a leria
  // como falta de jogos para o gosto dele.
  async execute(userId: string, mode: DiscoveryMode, limit: number): Promise<RecommendationList> {
    const index = this.contentIndex.index;
    if (!index) throw new ServiceUnavailableException(INDEX_UNAVAILABLE);

    const state = await this.repository.findUserState(userId, (gameId) =>
      index.positionByGameId.has(gameId),
    );
    // Pelo que está gravado, não pelo que o índice reconhece: quem já escolheu preferências não
    // volta para a partida a frio se elas saírem do índice.
    if (
      state.ratings.length === 0 &&
      state.listEntries.length === 0 &&
      state.preferenceFeatureIds.length === 0
    ) {
      return { mode, basis: 'empty', items: [] };
    }

    const result = recommend(
      index,
      {
        userId,
        mode,
        limit,
        interactions: interactionsOf(index, state),
        preferencePositions: state.preferenceFeatureIds.flatMap((id) => {
          const position = index.positionByFeatureId.get(id);
          return position === undefined ? [] : [position];
        }),
      },
      this.config,
    );

    const gameIds = result.items.flatMap(({ game, reason }) =>
      reason?.kind === 'liked-game' ? [game.id, reason.gameId] : [game.id],
    );
    const games = new Map(
      (await this.repository.findGames([...new Set(gameIds)])).map((game) => [game.id, game]),
    );
    // Um jogo pode ter saído do catálogo depois da última carga do índice: fica de fora.
    return {
      mode,
      basis: result.basis,
      items: result.items.flatMap(({ game, reason, lowKnown }) => {
        const row = games.get(game.id);
        if (!row?.inCatalog) return [];
        return [
          { game: this.catalog.toSummary(row), reason: this.reason(reason, games), lowKnown },
        ];
      }),
    };
  }

  private reason(
    reason: ScoredReason | null,
    games: ReadonlyMap<string, RecommendedGameRow>,
  ): RecommendationReason | null {
    if (reason === null) return null;
    if (reason.kind === 'liked-game') {
      const game = games.get(reason.gameId);
      if (!game) return null;
      return {
        kind: 'liked-game',
        game: { slug: game.slug, name: game.name, inCatalog: game.inCatalog },
      };
    }
    const features = reason.features
      .filter(isLabeled)
      .flatMap(({ type, slug, name }) =>
        this.labels.isHidden(type, slug)
          ? []
          : [{ slug, name: this.labels.name(type, slug, name) }],
      );
    return features.length > 0 ? { kind: 'features', features } : null;
  }
}

// Nota e listas do mesmo jogo viram uma interação só. O jogo fora do índice tem o vetor montado
// com os atributos gravados no banco.
function interactionsOf(index: ContentIndex, state: UserState): Interaction[] {
  const byGame = new Map<string, { score: number | null; lists: ListType[] }>();
  const entryOf = (gameId: string) => {
    const entry = byGame.get(gameId) ?? { score: null, lists: [] };
    byGame.set(gameId, entry);
    return entry;
  };
  for (const { gameId, score } of state.ratings) entryOf(gameId).score = score;
  for (const { gameId, listType } of state.listEntries) entryOf(gameId).lists.push(listType);

  return [...byGame].map(([gameId, { score, lists }]) => {
    const position = index.positionByGameId.get(gameId);
    const vector =
      position === undefined
        ? index.vectorOf(state.unindexedFeatures.get(gameId) ?? [])
        : index.games[position]!;
    return { gameId, score, lists, vector };
  });
}

function isLabeled(feature: IndexedFeature): feature is IndexedFeature & {
  type: LabeledFeatureType;
} {
  return feature.type !== FeatureType.KEYWORD;
}
