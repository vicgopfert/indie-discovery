import type { GameSearchQuery } from '@indie/contracts';
import { Injectable } from '@nestjs/common';
import { FeatureType, Prisma, ReleaseStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { LabeledFeatureType } from './feature-labels';

const STATUS: Record<NonNullable<GameSearchQuery['status']>, ReleaseStatus> = {
  released: ReleaseStatus.RELEASED,
  upcoming: ReleaseStatus.UPCOMING,
};

// O desempate por nome e id deixa a ordem estável entre páginas, mesmo com popularidades iguais.
const ORDER: Record<GameSearchQuery['sort'], Prisma.GameOrderByWithRelationInput[]> = {
  popular: [{ popularityNorm: 'desc' }, { name: 'asc' }, { id: 'asc' }],
  newest: [{ firstReleaseDate: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }, { id: 'asc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
};

const gameSummarySelect = {
  slug: true,
  name: true,
  coverImageId: true,
  releaseStatus: true,
  firstReleaseDate: true,
  features: {
    where: { feature: { type: FeatureType.GENRE } },
    select: { feature: { select: { slug: true, name: true } } },
  },
} satisfies Prisma.GameSelect;

export type GameSummaryRow = Prisma.GameGetPayload<{ select: typeof gameSummarySelect }>;

// Palavras-chave e empresas com outro papel (como a do port) ficam fora da ficha.
const gameDetailSelect = {
  ...gameSummarySelect,
  summary: true,
  storeUrl: true,
  studioCountrySource: true,
  studioCountry: { select: { alpha2: true, namePt: true } },
  features: {
    where: { feature: { type: { in: [FeatureType.GENRE, FeatureType.THEME] } } },
    select: { feature: { select: { type: true, slug: true, name: true } } },
  },
  companies: {
    where: { OR: [{ isDeveloper: true }, { isPublisher: true }] },
    select: { isDeveloper: true, isPublisher: true, company: { select: { name: true } } },
  },
  languages: {
    select: {
      interface: true,
      subtitles: true,
      audio: true,
      language: { select: { locale: true, namePt: true } },
    },
  },
} satisfies Prisma.GameSelect;

export type GameDetailRow = Prisma.GameGetPayload<{ select: typeof gameDetailSelect }>;

export interface FeatureCountRow {
  slug: string;
  name: string;
  gameCount: number;
}

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchGames(query: GameSearchQuery): Promise<{ total: number; games: GameSummaryRow[] }> {
    const featureIds = await this.findFeatureIds(query);
    if (!featureIds) return { total: 0, games: [] };

    const where = searchWhere(query, featureIds);
    const [total, games] = await this.prisma.$transaction([
      this.prisma.game.count({ where }),
      this.prisma.game.findMany({
        where,
        select: gameSummarySelect,
        orderBy: ORDER[query.sort],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { total, games };
  }

  findGameBySlug(slug: string): Promise<GameDetailRow | null> {
    return this.prisma.game.findUnique({
      where: { slug, inCatalog: true },
      select: gameDetailSelect,
    });
  }

  // Conta só jogos do catálogo: um atributo que só aparece em jogos fora dele não vira opção.
  async countGamesByFeature(type: LabeledFeatureType): Promise<FeatureCountRow[]> {
    const features = await this.prisma.feature.findMany({
      where: { type, games: { some: { game: { inCatalog: true } } } },
      select: {
        slug: true,
        name: true,
        _count: { select: { games: { where: { game: { inCatalog: true } } } } },
      },
    });
    return features.map(({ slug, name, _count }) => ({ slug, name, gameCount: _count.games }));
  }

  // Filtrar pelo id usa o índice de GameFeature(featureId); pelo slug, o banco cruza a tabela
  // inteira (cerca de 30 ms contra 200 ms no catálogo de 20 mil jogos). Null se algum slug não
  // existe: como os filtros se somam, nenhum jogo atende.
  private async findFeatureIds({ genre, theme }: GameSearchQuery): Promise<string[] | null> {
    const wanted = [
      ...genre.map((slug) => ({ type: FeatureType.GENRE, slug })),
      ...theme.map((slug) => ({ type: FeatureType.THEME, slug })),
    ];
    if (wanted.length === 0) return [];

    const found = await this.prisma.feature.findMany({
      where: { OR: wanted },
      select: { id: true },
    });
    return found.length === wanted.length ? found.map(({ id }) => id) : null;
  }
}

function searchWhere({ q, status }: GameSearchQuery, featureIds: string[]): Prisma.GameWhereInput {
  return {
    inCatalog: true,
    ...(q && { name: { contains: escapeLike(q), mode: 'insensitive' } }),
    ...(status && { releaseStatus: STATUS[status] }),
    AND: featureIds.map((featureId) => ({ features: { some: { featureId } } })),
  };
}

// O Prisma repassa o texto ao ILIKE sem escapar: "%" e "_" digitados valem como caracteres.
export function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
