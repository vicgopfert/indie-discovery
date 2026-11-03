import { Injectable } from '@nestjs/common';
import type { FeatureType, ListType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { gameSummarySelect } from '../catalog/catalog.repository';

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

  async findPreferences(userId: string): Promise<PreferenceRow[]> {
    const preferences = await this.prisma.userPreference.findMany({
      where: { userId },
      select: { feature: { select: { type: true, slug: true, name: true } } },
    });
    return preferences.map(({ feature }) => feature);
  }
}
