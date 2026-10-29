import { FeatureType, ReleaseStatus, StudioCountrySource } from '../../src/generated/prisma/client';
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
  storeUrl?: string | null;
  studioCountry?: { alpha2: string; source: StudioCountrySource };
  developers?: string[];
  publishers?: string[];
  languages?: LanguageSpec[];
}

export interface LanguageSpec {
  locale: string;
  interface?: boolean;
  subtitles?: boolean;
  audio?: boolean;
}

// Países e idiomas vêm do seedReferenceData, que precisa rodar antes.

// Monta um catálogo pequeno e conhecido direto no banco, sem passar pela ingestão.
export class CatalogBuilder {
  private nextIgdbId = 1;
  private readonly featureIds = new Map<string, string>();
  private readonly companyIds = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async game({
    name,
    genres = [],
    themes = [],
    status = ReleaseStatus.RELEASED,
    popularity = 0,
    releasedOn = null,
    inCatalog = true,
    storeUrl = null,
    studioCountry,
    developers = [],
    publishers = [],
    languages = [],
  }: GameSpec) {
    const featureIds = [
      ...(await Promise.all(genres.map((genre) => this.feature(FeatureType.GENRE, genre)))),
      ...(await Promise.all(themes.map((theme) => this.feature(FeatureType.THEME, theme)))),
    ];
    const companies = await Promise.all(
      [...new Set([...developers, ...publishers])].map(async (company) => ({
        companyId: await this.company(company),
        isDeveloper: developers.includes(company),
        isPublisher: publishers.includes(company),
      })),
    );
    const gameLanguages = await Promise.all(
      languages.map(async ({ locale, ...support }) => ({
        languageId: (await this.prisma.language.findFirstOrThrow({ where: { locale } })).id,
        ...support,
      })),
    );
    const country =
      studioCountry &&
      (await this.prisma.country.findUniqueOrThrow({ where: { alpha2: studioCountry.alpha2 } }));
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
        storeUrl,
        studioCountryCode: country?.code ?? null,
        studioCountrySource: studioCountry?.source ?? null,
        criteriaVerdict: {},
        criteriaVersion: 'teste',
        syncedAt: new Date(),
        features: { create: featureIds.map((featureId) => ({ featureId })) },
        companies: { create: companies },
        languages: { create: gameLanguages },
      },
    });
  }

  private async company(name: string) {
    const known = this.companyIds.get(name);
    if (known) return known;
    const { id } = await this.prisma.company.create({
      data: { igdbId: this.nextIgdbId++, name },
    });
    this.companyIds.set(name, id);
    return id;
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
