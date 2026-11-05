import { Injectable } from '@nestjs/common';
import type { FeatureType, ListType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { gameSummarySelect } from '../catalog/catalog.repository';

const recommendedGameSelect = {
  id: true,
  ...gameSummarySelect,
  inCatalog: true,
} satisfies Prisma.GameSelect;

export type RecommendedGameRow = Prisma.GameGetPayload<{ select: typeof recommendedGameSelect }>;

export interface StoredFeature {
  type: FeatureType;
  igdbId: number;
  slug: string;
}

// O jogo da biblioteca que não está no índice: os atributos montam o vetor, e as palavras-chave e
// o resumo, os estilos.
export interface UnindexedGame {
  features: StoredFeature[];
  summary: string;
}

export interface UserState {
  ratings: { gameId: string; score: number }[];
  listEntries: { gameId: string; listType: ListType }[];
  preferenceFeatureIds: string[];
  unindexedGames: ReadonlyMap<string, UnindexedGame>;
}

// O usuário vem sempre da sessão: toda consulta daqui é filtrada pelo userId.
@Injectable()
export class RecommendationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // O índice só tem os jogos do catálogo, mas o jogo que saiu dele continua na biblioteca e no
  // perfil: os atributos e o resumo dele vêm do banco.
  async findUserState(userId: string, isIndexed: (gameId: string) => boolean): Promise<UserState> {
    const [ratings, listEntries, preferences] = await this.prisma.$transaction([
      this.prisma.rating.findMany({ where: { userId }, select: { gameId: true, score: true } }),
      this.prisma.listEntry.findMany({
        where: { userId },
        select: { gameId: true, listType: true },
      }),
      this.prisma.userPreference.findMany({ where: { userId }, select: { featureId: true } }),
    ]);

    const unindexed = [...new Set([...ratings, ...listEntries].map(({ gameId }) => gameId))].filter(
      (gameId) => !isIndexed(gameId),
    );
    const games =
      unindexed.length === 0
        ? []
        : await this.prisma.game.findMany({
            where: { id: { in: unindexed } },
            select: {
              id: true,
              summary: true,
              features: {
                select: { feature: { select: { type: true, igdbId: true, slug: true } } },
              },
            },
          });
    const unindexedGames = new Map(
      games.map(({ id, summary, features }) => [
        id,
        { summary, features: features.map(({ feature }) => feature) },
      ]),
    );

    return {
      ratings,
      listEntries,
      preferenceFeatureIds: preferences.map(({ featureId }) => featureId),
      unindexedGames,
    };
  }

  findGames(ids: string[]): Promise<RecommendedGameRow[]> {
    return this.prisma.game.findMany({ where: { id: { in: ids } }, select: recommendedGameSelect });
  }
}
