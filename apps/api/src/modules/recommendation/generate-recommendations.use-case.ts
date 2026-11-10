import type {
  Recommendation,
  RecommendationFeature,
  RecommendationLikedGame,
  RecommendationOverview,
  RecommendationPage,
  RecommendationReason,
  RecommendationShelf,
} from '@indie/contracts';
import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { type DiscoveryMode, FeatureType } from '../../generated/prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { FeatureLabels } from '../catalog/feature-labels';
import { type ContentIndex, isLabeledFeatureType } from './content-index';
import { ContentIndexService } from './content-index.service';
import { type RecommendedGameRow, RecommendationRepository } from './recommendation.repository';
import type { ScoredReason } from './scoring/explain';
import { MAIN_LIST_KEY, type RankedList, type ShelfAttribute } from './scoring/lists';
import { listPage, overview, type ShownGame } from './scoring/overview';
import { interactionsOf } from './scoring/profile';
import { recommend, type RecommendationLists } from './scoring/recommend';
import type { ScoringConfig } from './scoring/scoring-config';
import { SimilarityCache } from './scoring/source-similarity';

export const SCORING_CONFIG = Symbol('SCORING_CONFIG');

export const INDEX_UNAVAILABLE =
  'As recomendações ainda não estão disponíveis; tente novamente em alguns instantes.';

export const LIST_NOT_FOUND = 'Lista não encontrada.';

const NO_ITEMS = { items: [], hasMore: false };

@Injectable()
export class GenerateRecommendationsUseCase {
  private readonly hiddenByIndex = new WeakMap<ContentIndex, ReadonlySet<number>>();
  private readonly similarityByIndex = new WeakMap<ContentIndex, SimilarityCache>();

  constructor(
    private readonly contentIndex: ContentIndexService,
    private readonly repository: RecommendationRepository,
    private readonly catalog: CatalogService,
    private readonly labels: FeatureLabels,
    @Inject(SCORING_CONFIG) private readonly config: ScoringConfig,
  ) {}

  async overview(userId: string, mode: DiscoveryMode): Promise<RecommendationOverview> {
    const result = await this.recommend(userId, mode);
    if (result === null) return { mode, basis: 'empty', main: NO_ITEMS, shelves: [] };

    const [main, ...shelves] = overview(result.lists, this.config.lists);
    const {
      items: [mainItems, ...shelfItems],
      games,
    } = await this.present(result, [main!, ...shelves]);
    return {
      mode,
      basis: result.basis,
      main: { items: mainItems!, hasMore: main!.hasMore },
      shelves: shelves.flatMap(({ list, hasMore }, i) =>
        this.shelf(list, shelfItems[i]!, hasMore, games),
      ),
    };
  }

  // Com a lista vazia (sem perfil), só a principal existe, e vazia. Uma chave que não está entre
  // as listas atuais responde 404: o perfil pode ter mudado entre a visão geral e o "ver mais".
  // Só a lista pedida é montada (B-79).
  async page(
    userId: string,
    mode: DiscoveryMode,
    key: string,
    page: number,
  ): Promise<RecommendationPage> {
    const result = await this.recommend(userId, mode, key);
    if (result === null && key === MAIN_LIST_KEY) {
      return { mode, basis: 'empty', key, feature: null, game: null, page, ...NO_ITEMS };
    }
    const list = result?.lists.find((candidate) => candidate.key === key);
    if (!result || !list) throw new NotFoundException(LIST_NOT_FOUND);

    const { items, hasMore } = listPage(list, page, this.config.lists);
    const {
      items: [presented],
      games,
    } = await this.present(result, [{ list, items }]);
    return {
      mode,
      basis: result.basis,
      key,
      feature: this.feature(list.attribute),
      game: this.likedGame(list, games),
      page,
      items: presented!,
      hasMore,
    };
  }

  // Com o índice carregando ou com falha, 503, nunca lista vazia: o jogador a leria como falta de
  // jogos para o gosto dele. Sem avaliações, listas nem preferências gravadas, null: partida a
  // frio. Pelo que está gravado, não pelo que o índice reconhece: quem já escolheu preferências
  // não volta para a partida a frio se elas saírem do índice.
  private async recommend(
    userId: string,
    mode: DiscoveryMode,
    only?: string,
  ): Promise<RecommendationLists | null> {
    const index = this.contentIndex.index;
    if (!index) throw new ServiceUnavailableException(INDEX_UNAVAILABLE);

    const state = await this.repository.findUserState(userId, (gameId) =>
      index.positionByGameId.has(gameId),
    );
    if (
      state.ratings.length === 0 &&
      state.listEntries.length === 0 &&
      state.preferenceFeatureIds.length === 0
    ) {
      return null;
    }

    return recommend(
      index,
      {
        userId,
        mode,
        interactions: interactionsOf(index, state),
        preferencePositions: state.preferenceFeatureIds.flatMap((id) => {
          const position = index.positionByFeatureId.get(id);
          return position === undefined ? [] : [position];
        }),
        hiddenPositions: this.hiddenPositions(index),
        similarityOf: (liked) => this.similarityCache(index).of(liked),
        ...(only !== undefined && { only }),
      },
      this.config,
    );
  }

  // Um cache para cada índice carregado: a recarga cria outro, e o anterior sai com o índice.
  private similarityCache(index: ContentIndex): SimilarityCache {
    let cache = this.similarityByIndex.get(index);
    if (cache === undefined) {
      cache = new SimilarityCache(index, this.config.lists.likedGameCacheSize);
      this.similarityByIndex.set(index, cache);
    }
    return cache;
  }

  // Só depende do índice: calculado uma vez para cada índice carregado.
  private hiddenPositions(index: ContentIndex): ReadonlySet<number> {
    let hidden = this.hiddenByIndex.get(index);
    if (hidden === undefined) {
      const positions = new Set<number>();
      index.features.forEach((feature, position) => {
        if (
          isLabeledFeatureType(feature.type) &&
          this.labels.isHidden(feature.type, feature.slug)
        ) {
          positions.add(position);
        }
      });
      hidden = positions;
      this.hiddenByIndex.set(index, hidden);
    }
    return hidden;
  }

  // Uma consulta ao banco para todas as listas, com os jogos de origem das prateleiras por jogo.
  // Um jogo pode ter saído do catálogo depois da última carga do índice: fica de fora.
  private async present(
    result: RecommendationLists,
    lists: readonly { list: RankedList; items: readonly ShownGame[] }[],
  ): Promise<{ items: Recommendation[][]; games: ReadonlyMap<string, RecommendedGameRow> }> {
    const explained = lists.map(({ items }) =>
      items.map(({ game, lowKnown }) => ({ game, lowKnown, reason: result.reasonOf(game) })),
    );
    const gameIds = [
      ...lists.flatMap(({ list }) => (list.likedGameId === null ? [] : [list.likedGameId])),
      ...explained.flat().map(({ game }) => game.id),
    ];
    const games = new Map(
      (await this.repository.findGames([...new Set(gameIds)])).map((game) => [game.id, game]),
    );
    const items = explained.map((list) =>
      list.flatMap(({ game, reason, lowKnown }) => {
        const row = games.get(game.id);
        if (!row?.inCatalog) return [];
        return [{ game: this.catalog.toSummary(row), reason: this.reason(reason), lowKnown }];
      }),
    );
    return { items, games };
  }

  // Os interesses são só gêneros, temas e etiquetas (pickInterests): toda prateleira deles tem nome.
  private shelf(
    list: RankedList,
    items: Recommendation[],
    hasMore: boolean,
    games: ReadonlyMap<string, RecommendedGameRow>,
  ): RecommendationShelf[] {
    if (list.kind === 'upcoming') {
      return [{ key: 'upcoming', kind: 'upcoming', feature: null, items, hasMore }];
    }
    if (list.kind === 'liked-game') {
      const game = this.likedGame(list, games);
      return game
        ? [{ key: list.key, kind: 'liked-game', feature: null, game, items, hasMore }]
        : [];
    }
    const feature = this.feature(list.attribute)!;
    return [{ key: list.key, kind: 'interest', feature, items, hasMore }];
  }

  private likedGame(
    { likedGameId }: RankedList,
    games: ReadonlyMap<string, RecommendedGameRow>,
  ): RecommendationLikedGame | null {
    const row = likedGameId === null ? undefined : games.get(likedGameId);
    return row ? { slug: row.slug, name: row.name, inCatalog: row.inCatalog } : null;
  }

  // O nome da etiqueta já está em português, gravado do vocabulário; palavra-chave não tem nome
  // exibido. O título da prateleira é o do vocabulário ou, sem ele, o nome.
  private feature(attribute: ShelfAttribute | null): RecommendationFeature | null {
    if (attribute === null) return null;
    const { type, slug, title } = attribute;
    if (type !== FeatureType.TAG && !isLabeledFeatureType(type)) return null;
    const name =
      type === FeatureType.TAG ? attribute.name : this.labels.name(type, slug, attribute.name);
    return { type, slug, name, title: title ?? name };
  }

  // O motivo não mostra os gêneros e temas escondidos dos filtros.
  private reason(reason: ScoredReason | null): RecommendationReason | null {
    if (reason === null) return null;
    const features = reason.features.flatMap((attribute) => {
      const feature = this.feature({ ...attribute, title: null });
      if (feature === null) return [];
      if (feature.type !== FeatureType.TAG && this.labels.isHidden(feature.type, feature.slug)) {
        return [];
      }
      return [{ slug: feature.slug, name: feature.name }];
    });
    return features.length > 0 ? { kind: 'features', features } : null;
  }
}
