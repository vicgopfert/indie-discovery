import type {
  Recommendation,
  RecommendationFeature,
  RecommendationOverview,
  RecommendationPage,
  RecommendationReason,
  RecommendationShelf,
} from '@indie/contracts';
import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { type DiscoveryMode, FeatureType, type ListType } from '../../generated/prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { FeatureLabels } from '../catalog/feature-labels';
import { type ContentIndex, type DisplayedAttribute, isLabeledFeatureType } from './content-index';
import { ContentIndexService } from './content-index.service';
import {
  type RecommendedGameRow,
  RecommendationRepository,
  type UserState,
} from './recommendation.repository';
import type { ScoredReason } from './scoring/explain';
import { MAIN_LIST_KEY, type RankedList } from './scoring/lists';
import { listPage, overview, type ShownGame } from './scoring/overview';
import type { Interaction } from './scoring/profile';
import { recommend, type RecommendationLists } from './scoring/recommend';
import type { ScoringConfig } from './scoring/scoring-config';

export const SCORING_CONFIG = Symbol('SCORING_CONFIG');

export const INDEX_UNAVAILABLE =
  'As recomendações ainda não estão disponíveis; tente novamente em alguns instantes.';

export const LIST_NOT_FOUND = 'Lista não encontrada.';

const NO_ITEMS = { items: [], hasMore: false };

@Injectable()
export class GenerateRecommendationsUseCase {
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
    const [mainItems, ...shelfItems] = await this.present(
      result,
      [main!, ...shelves].map(({ items }) => items),
    );
    return {
      mode,
      basis: result.basis,
      main: { items: mainItems!, hasMore: main!.hasMore },
      shelves: shelves.map(({ list, hasMore }, i) => this.shelf(list, shelfItems[i]!, hasMore)),
    };
  }

  // Com a lista vazia (sem perfil), só a principal existe, e vazia. Uma chave que não está entre
  // as listas atuais responde 404: o perfil pode ter mudado entre a visão geral e o "ver mais".
  async page(
    userId: string,
    mode: DiscoveryMode,
    key: string,
    page: number,
  ): Promise<RecommendationPage> {
    const result = await this.recommend(userId, mode);
    if (result === null && key === MAIN_LIST_KEY) {
      return { mode, key, feature: null, page, ...NO_ITEMS };
    }
    const list = result?.lists.find((candidate) => candidate.key === key);
    if (!result || !list) throw new NotFoundException(LIST_NOT_FOUND);

    const { items, hasMore } = listPage(list, page, this.config.lists);
    const [presented] = await this.present(result, [items]);
    return { mode, key, feature: this.feature(list.attribute), page, items: presented!, hasMore };
  }

  // Com o índice carregando ou com falha, 503, nunca lista vazia: o jogador a leria como falta de
  // jogos para o gosto dele. Sem avaliações, listas nem preferências gravadas, null: partida a
  // frio. Pelo que está gravado, não pelo que o índice reconhece: quem já escolheu preferências
  // não volta para a partida a frio se elas saírem do índice.
  private async recommend(
    userId: string,
    mode: DiscoveryMode,
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
      },
      this.config,
    );
  }

  private hiddenPositions(index: ContentIndex): Set<number> {
    const hidden = new Set<number>();
    index.features.forEach((feature, position) => {
      if (isLabeledFeatureType(feature.type) && this.labels.isHidden(feature.type, feature.slug)) {
        hidden.add(position);
      }
    });
    return hidden;
  }

  // Uma consulta ao banco para todas as listas. Um jogo pode ter saído do catálogo depois da
  // última carga do índice: fica de fora.
  private async present(
    result: RecommendationLists,
    lists: readonly (readonly ShownGame[])[],
  ): Promise<Recommendation[][]> {
    const explained = lists.map((items) =>
      items.map(({ game, lowKnown }) => ({ game, lowKnown, reason: result.reasonOf(game) })),
    );
    const gameIds = explained
      .flat()
      .flatMap(({ game, reason }) =>
        reason?.kind === 'liked-game' ? [game.id, reason.gameId] : [game.id],
      );
    const games = new Map(
      (await this.repository.findGames([...new Set(gameIds)])).map((game) => [game.id, game]),
    );
    return explained.map((items) =>
      items.flatMap(({ game, reason, lowKnown }) => {
        const row = games.get(game.id);
        if (!row?.inCatalog) return [];
        return [
          { game: this.catalog.toSummary(row), reason: this.reason(reason, games), lowKnown },
        ];
      }),
    );
  }

  // Os interesses são só gêneros, temas e estilos (pickInterests): toda prateleira deles tem nome.
  private shelf(list: RankedList, items: Recommendation[], hasMore: boolean): RecommendationShelf {
    return list.kind === 'upcoming'
      ? { key: 'upcoming', kind: 'upcoming', feature: null, items, hasMore }
      : { key: list.key, kind: 'interest', feature: this.feature(list.attribute)!, items, hasMore };
  }

  // O nome do estilo já está em português no arquivo de estilos; palavra-chave não tem nome exibido.
  private feature(attribute: DisplayedAttribute | null): RecommendationFeature | null {
    if (attribute === null) return null;
    const { type, slug, name } = attribute;
    if (type === 'STYLE') return { type, slug, name };
    if (!isLabeledFeatureType(type)) return null;
    return { type, slug, name: this.labels.name(type, slug, name) };
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
    // O motivo não mostra os gêneros e temas escondidos dos filtros.
    const features = reason.features.flatMap((attribute) => {
      const feature = this.feature(attribute);
      if (feature === null) return [];
      if (feature.type !== 'STYLE' && this.labels.isHidden(feature.type, feature.slug)) return [];
      return [{ slug: feature.slug, name: feature.name }];
    });
    return features.length > 0 ? { kind: 'features', features } : null;
  }
}

// Nota e listas do mesmo jogo viram uma interação só. O jogo fora do índice tem o vetor e os
// estilos montados com os atributos e o resumo gravados no banco.
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
    if (position !== undefined) {
      const game = index.games[position]!;
      return { gameId, score, lists, vector: game, styles: game.styles };
    }
    const { features = [], summary = '' } = state.unindexedGames.get(gameId) ?? {};
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
