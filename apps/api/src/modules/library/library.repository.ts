import { Injectable } from '@nestjs/common';
import type { FeatureType, ListType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type GameSummaryRow, gameSummarySelect } from '../catalog/catalog.repository';

const libraryGameSelect = { ...gameSummarySelect, inCatalog: true } satisfies Prisma.GameSelect;

export type LibraryGameRow = Prisma.GameGetPayload<{ select: typeof libraryGameSelect }>;

export interface LibraryRow {
  ratings: { score: number; updatedAt: Date; game: LibraryGameRow }[];
  listEntries: { listType: ListType; createdAt: Date; game: LibraryGameRow }[];
}

export interface PreferenceRow {
  type: FeatureType;
  slug: string;
  name: string;
}

// O usuário vem sempre da sessão: toda consulta e gravação daqui é filtrada pelo userId.
@Injectable()
export class LibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findGame(slug: string): Promise<{ id: string; inCatalog: boolean } | null> {
    return this.prisma.game.findUnique({ where: { slug }, select: { id: true, inCatalog: true } });
  }

  upsertRating(
    userId: string,
    gameId: string,
    score: number,
  ): Promise<{ score: number; updatedAt: Date }> {
    return this.prisma.rating.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId, score },
      update: { score },
      select: { score: true, updatedAt: true },
    });
  }

  async deleteRating(userId: string, gameId: string): Promise<void> {
    await this.prisma.rating.deleteMany({ where: { userId, gameId } });
  }

  // Entrar numa lista tira o jogo das listas exclusivas com ela na mesma transação.
  async addToList(
    userId: string,
    gameId: string,
    listType: ListType,
    exclusive: ListType[],
  ): Promise<ListType[]> {
    await this.prisma.$transaction([
      this.prisma.listEntry.deleteMany({ where: { userId, gameId, listType: { in: exclusive } } }),
      this.prisma.listEntry.createMany({
        data: { userId, gameId, listType },
        skipDuplicates: true,
      }),
    ]);
    return this.listsOf(userId, gameId);
  }

  async removeFromList(userId: string, gameId: string, listType: ListType): Promise<void> {
    await this.prisma.listEntry.deleteMany({ where: { userId, gameId, listType } });
  }

  async listsOf(userId: string, gameId: string): Promise<ListType[]> {
    const entries = await this.prisma.listEntry.findMany({
      where: { userId, gameId },
      select: { listType: true },
      orderBy: { listType: 'asc' },
    });
    return entries.map(({ listType }) => listType);
  }

  async findLibrary(userId: string): Promise<LibraryRow> {
    const [ratings, listEntries] = await this.prisma.$transaction([
      this.prisma.rating.findMany({
        where: { userId },
        select: { score: true, updatedAt: true, game: { select: libraryGameSelect } },
        orderBy: [{ updatedAt: 'desc' }, { game: { name: 'asc' } }],
      }),
      this.prisma.listEntry.findMany({
        where: { userId },
        select: { listType: true, createdAt: true, game: { select: libraryGameSelect } },
        orderBy: [{ createdAt: 'desc' }, { game: { name: 'asc' } }],
      }),
    ]);
    return { ratings, listEntries };
  }

  async findGameState(
    userId: string,
    gameId: string,
  ): Promise<{ rating: { score: number; updatedAt: Date } | null; lists: ListType[] }> {
    const [rating, lists] = await Promise.all([
      this.prisma.rating.findUnique({
        where: { userId_gameId: { userId, gameId } },
        select: { score: true, updatedAt: true },
      }),
      this.listsOf(userId, gameId),
    ]);
    return { rating, lists };
  }

  async findFeatureIds(type: FeatureType, slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const features = await this.prisma.feature.findMany({
      where: { type, slug: { in: slugs } },
      select: { id: true },
    });
    return features.map(({ id }) => id);
  }

  // Trocar as preferências conclui a partida a frio, porque a etapa de avaliação é opcional.
  async replacePreferences(userId: string, featureIds: string[], now: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userPreference.deleteMany({ where: { userId } }),
      this.prisma.userPreference.createMany({
        data: featureIds.map((featureId) => ({ userId, featureId })),
      }),
      this.prisma.user.updateMany({
        where: { id: userId, onboardingCompletedAt: null },
        data: { onboardingCompletedAt: now },
      }),
    ]);
  }

  async hasPreferences(userId: string): Promise<boolean> {
    return (await this.prisma.userPreference.count({ where: { userId } })) > 0;
  }

  // Rodadas: o mais popular de cada preferência, depois o segundo de cada uma, e assim por diante;
  // o jogo de duas preferências fica na primeira rodada em que aparece. Só os lançados, que o
  // jogador pode ter jogado, e fora da biblioteca dele.
  async findOnboardingGames(userId: string, limit: number): Promise<GameSummaryRow[]> {
    const ranked = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH ranked AS (
        SELECT g."id", g."popularityNorm", g."name",
          row_number() OVER (
            PARTITION BY p."featureId" ORDER BY g."popularityNorm" DESC, g."name", g."id"
          ) AS "round"
        FROM "UserPreference" p
        JOIN "GameFeature" gf ON gf."featureId" = p."featureId"
        JOIN "Game" g ON g."id" = gf."gameId"
        WHERE p."userId" = ${userId}::uuid
          AND g."inCatalog" AND g."releaseStatus" = 'RELEASED'
          AND NOT EXISTS (
            SELECT 1 FROM "Rating" r WHERE r."userId" = p."userId" AND r."gameId" = g."id"
          )
          AND NOT EXISTS (
            SELECT 1 FROM "ListEntry" l WHERE l."userId" = p."userId" AND l."gameId" = g."id"
          )
      )
      SELECT "id" FROM ranked
      GROUP BY "id", "popularityNorm", "name"
      ORDER BY min("round"), "popularityNorm" DESC, "name", "id"
      LIMIT ${limit}`;
    const ids = ranked.map(({ id }) => id);
    const games = await this.prisma.game.findMany({
      where: { id: { in: ids } },
      select: { ...gameSummarySelect, id: true },
    });
    const byId = new Map(games.map((game) => [game.id, game]));
    return ids.map((id) => byId.get(id)!);
  }

  async findPreferences(userId: string): Promise<PreferenceRow[]> {
    const preferences = await this.prisma.userPreference.findMany({
      where: { userId },
      select: { feature: { select: { type: true, slug: true, name: true } } },
    });
    return preferences.map(({ feature }) => feature);
  }
}
