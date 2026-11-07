import {
  FeatureType,
  ReleaseStatus,
  StudioCountrySource,
  TagSource,
} from '../../src/generated/prisma/client';
import { slugify } from '../../src/modules/ingestion/igdb/igdb.mapper';
import { readTagVocabulary, tagSlug } from '../../src/modules/tags/tags';
import type { PrismaService } from '../../src/prisma/prisma.service';

export interface GameSpec {
  name: string;
  genres?: string[];
  themes?: string[];
  keywords?: string[];
  // Pelo nome em inglês do vocabulário, da mais votada para a menos.
  tags?: string[];
  tagSource?: TagSource;
  steamAppId?: number | null;
  summary?: string;
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

const vocabulary = readTagVocabulary();

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
    keywords = [],
    tags = [],
    tagSource = tags.length > 0 ? TagSource.STEAM : undefined,
    steamAppId = null,
    summary,
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
      ...(await Promise.all(keywords.map((keyword) => this.feature(FeatureType.KEYWORD, keyword)))),
    ].map((featureId) => ({ featureId }));
    const tagLinks = await Promise.all(
      tags.map(async (tag, i) => ({
        featureId: await this.tag(tag),
        rank: tagSource === TagSource.STEAM ? i + 1 : null,
      })),
    );
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
        summary: summary ?? `Resumo de ${name}`,
        coverImageId: `cover-${slugify(name)}`,
        firstReleaseDate: releasedOn ? new Date(`${releasedOn}T00:00:00Z`) : null,
        releaseStatus: status,
        popularityNorm: popularity,
        inCatalog,
        storeUrl,
        studioCountryCode: country?.code ?? null,
        studioCountrySource: studioCountry?.source ?? null,
        steamAppId,
        tagSource: tagSource ?? null,
        criteriaVerdict: {},
        criteriaVersion: 'teste',
        syncedAt: new Date(),
        features: { create: [...featureIds, ...tagLinks] },
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

  // A etiqueta como a ingestão grava: o id da Steam e o nome em português do vocabulário.
  private async tag(englishName: string) {
    const tag = vocabulary.tags.find((t) => t.englishName === englishName && t.accepted);
    if (!tag) throw new Error(`Etiqueta fora do vocabulário aceito: ${englishName}`);
    const key = `${FeatureType.TAG}:${tag.id}`;
    const known = this.featureIds.get(key);
    if (known) return known;
    const { id } = await this.prisma.feature.create({
      data: { type: FeatureType.TAG, igdbId: tag.id, name: tag.name, slug: tagSlug(tag) },
    });
    this.featureIds.set(key, id);
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
