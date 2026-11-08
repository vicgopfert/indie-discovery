import { Injectable } from '@nestjs/common';
import type { FeatureType, ListType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { gameSummarySelect } from '../catalog/catalog.repository';

// O resumo do catálogo, com o id e se o jogo continua no catálogo.
export type RecommendedGameRow = Prisma.GameGetPayload<{
  select: typeof gameSummarySelect & { id: true; inCatalog: true };
}>;

export interface StoredFeature {
  type: FeatureType;
  igdbId: number;
}

// O jogo da biblioteca que não está no índice: os atributos gravados montam o vetor.
export interface UnindexedGame {
  features: StoredFeature[];
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
  // perfil: os atributos dele vêm do banco. Notas, listas e preferências vêm numa
  // consulta só, que já é um instantâneo: a transação com três consultas custava cinco idas ao
  // banco por requisição (B-76).
  async findUserState(userId: string, isIndexed: (gameId: string) => boolean): Promise<UserState> {
    const [state] = await this.prisma.$queryRaw<Omit<UserState, 'unindexedGames'>[]>`
      SELECT
        coalesce((
          SELECT json_agg(json_build_object('gameId', "gameId", 'score', "score"))
          FROM "Rating" WHERE "userId" = ${userId}::uuid
        ), '[]') AS "ratings",
        coalesce((
          SELECT json_agg(json_build_object('gameId', "gameId", 'listType', "listType"))
          FROM "ListEntry" WHERE "userId" = ${userId}::uuid
        ), '[]') AS "listEntries",
        coalesce((
          SELECT json_agg("featureId") FROM "UserPreference" WHERE "userId" = ${userId}::uuid
        ), '[]') AS "preferenceFeatureIds"`;
    const { ratings, listEntries, preferenceFeatureIds } = state!;

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
              features: { select: { feature: { select: { type: true, igdbId: true } } } },
            },
          });
    const unindexedGames = new Map(
      games.map(({ id, features }) => [id, { features: features.map(({ feature }) => feature) }]),
    );

    return { ratings, listEntries, preferenceFeatureIds, unindexedGames };
  }

  // Os jogos mostrados com os gêneros, no formato do resumo do catálogo, numa consulta só: pelo
  // ORM eram três idas ao banco, uma para os jogos e duas para os gêneros (B-76).
  findGames(ids: string[]): Promise<RecommendedGameRow[]> {
    return this.prisma.$queryRaw<RecommendedGameRow[]>`
      SELECT g."id", g."slug", g."name", g."coverImageId", g."releaseStatus", g."firstReleaseDate",
        g."inCatalog",
        coalesce((
          SELECT json_agg(json_build_object('feature', json_build_object('slug', f."slug", 'name', f."name")))
          FROM "GameFeature" gf JOIN "Feature" f ON f."id" = gf."featureId"
          WHERE gf."gameId" = g."id" AND f."type" = 'GENRE'
        ), '[]') AS "features"
      FROM "Game" g WHERE g."id" = ANY(${ids}::uuid[])`;
  }
}
