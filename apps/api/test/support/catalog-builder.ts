import { FeatureType, ReleaseStatus } from '../../src/generated/prisma/client';
import { slugify } from '../../src/modules/ingestion/igdb/igdb.mapper';
import type { PrismaService } from '../../src/prisma/prisma.service';

export interface GameSpec {
  name: string;
  genres?: string[];
  themes?: string[];
  status?: ReleaseStatus;
  popularity?: number;
  releasedOn?: string | null;
  inCatalog?: boolean;
}

// Monta um catálogo pequeno e conhecido direto no banco, sem passar pela ingestão.
export class CatalogBuilder {
  private nextIgdbId = 1;
  private readonly featureIds = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async game({
    name,
    genres = [],
    themes = [],
    status = ReleaseStatus.RELEASED,
    popularity = 0,
    releasedOn = null,
    inCatalog = true,
  }: GameSpec) {
    const featureIds = [
      ...(await Promise.all(genres.map((genre) => this.feature(FeatureType.GENRE, genre)))),
      ...(await Promise.all(themes.map((theme) => this.feature(FeatureType.THEME, theme)))),
    ];
    return this.prisma.game.create({
      data: {
        igdbId: this.nextIgdbId++,
        slug: slugify(name),
        name,
        summary: `Resumo de ${name}`,
        coverImageId: `cover-${slugify(name)}`,
        firstReleaseDate: releasedOn ? new Date(`${releasedOn}T00:00:00Z`) : null,
        releaseStatus: status,
        popularityNorm: popularity,
        inCatalog,
        criteriaVerdict: {},
        criteriaVersion: 'teste',
        syncedAt: new Date(),
        features: { create: featureIds.map((featureId) => ({ featureId })) },
      },
    });
  }

  // O nome do atributo é o da IGDB, em inglês: a tradução acontece na leitura.
  private async feature(type: FeatureType, name: string) {
    const slug = slugify(name);
    const key = `${type}:${slug}`;
    const known = this.featureIds.get(key);
    if (known) return known;
    const { id } = await this.prisma.feature.create({
      data: { type, igdbId: this.nextIgdbId++, name, slug },
    });
    this.featureIds.set(key, id);
    return id;
  }
}
