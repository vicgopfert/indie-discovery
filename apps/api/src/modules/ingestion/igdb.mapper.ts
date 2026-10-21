import { FeatureType, ReleaseStatus } from '../../generated/prisma/client';
import type { IgdbGame } from './igdb-game.schema';

// Códigos conferidos na API da IGDB (game_statuses, website_types, language_support_types).
const CANCELLED_STATUS = 6;
const OFFICIAL_WEBSITE = 1;
const STORE_WEBSITES_BY_PREFERENCE = [13, 15, 16, 17]; // Steam, itch.io, Epic, GOG
const LANGUAGE_SUPPORT = { audio: 1, subtitles: 2, interface: 3 } as const;

export interface MappedCompany {
  igdbId: number;
  name: string;
  countryCode: number | null;
  isDeveloper: boolean;
  isPublisher: boolean;
}

export interface MappedFeature {
  type: FeatureType;
  igdbId: number;
  name: string;
  slug: string;
}

export interface MappedLanguageSupport {
  languageIgdbId: number;
  interface: boolean;
  subtitles: boolean;
  audio: boolean;
}

export interface MappedGame {
  igdbId: number;
  slug: string;
  name: string;
  summary: string | null;
  coverImageId: string | null;
  firstReleaseDate: Date | null;
  releaseStatus: ReleaseStatus;
  isCancelled: boolean;
  storeUrl: string | null;
  studioCountryCode: number | null;
  ratingCount: number;
  hypes: number;
  companies: MappedCompany[];
  features: MappedFeature[];
  languages: MappedLanguageSupport[];
}

export function mapIgdbGame(game: IgdbGame, now: Date): MappedGame {
  const firstReleaseDate =
    game.first_release_date === undefined ? null : new Date(game.first_release_date * 1000);
  const companies = mapCompanies(game);

  return {
    igdbId: game.id,
    slug: game.slug,
    name: game.name.trim(),
    summary: game.summary?.trim() || null,
    coverImageId: game.cover?.image_id ?? null,
    firstReleaseDate,
    releaseStatus:
      firstReleaseDate !== null && firstReleaseDate <= now
        ? ReleaseStatus.RELEASED
        : ReleaseStatus.UPCOMING,
    isCancelled: game.game_status === CANCELLED_STATUS,
    storeUrl: pickStoreUrl(game.websites),
    studioCountryCode:
      companies.find((company) => company.isDeveloper && company.countryCode !== null)
        ?.countryCode ?? null,
    ratingCount: game.total_rating_count ?? 0,
    hypes: game.hypes ?? 0,
    companies,
    features: [
      ...mapFeatures(FeatureType.GENRE, game.genres),
      ...mapFeatures(FeatureType.THEME, game.themes),
      ...mapFeatures(FeatureType.KEYWORD, game.keywords),
    ],
    languages: mapLanguages(game.language_supports),
  };
}

function mapCompanies(game: IgdbGame): MappedCompany[] {
  const byId = new Map<number, MappedCompany>();
  for (const { company, developer, publisher } of game.involved_companies) {
    const existing = byId.get(company.id);
    byId.set(company.id, {
      igdbId: company.id,
      name: company.name.trim(),
      countryCode: company.country ?? existing?.countryCode ?? null,
      isDeveloper: developer || (existing?.isDeveloper ?? false),
      isPublisher: publisher || (existing?.isPublisher ?? false),
    });
  }
  return [...byId.values()];
}

function mapFeatures(type: FeatureType, entities: { id: number; name: string }[]): MappedFeature[] {
  const unique = new Map(entities.map((entity) => [entity.id, entity]));
  return [...unique.values()].map(({ id, name }) => ({
    type,
    igdbId: id,
    name: name.trim(),
    slug: slugify(name),
  }));
}

function mapLanguages(supports: IgdbGame['language_supports']): MappedLanguageSupport[] {
  const byLanguage = new Map<number, MappedLanguageSupport>();
  for (const { language, language_support_type: type } of supports) {
    const support = byLanguage.get(language.id) ?? {
      languageIgdbId: language.id,
      interface: false,
      subtitles: false,
      audio: false,
    };
    if (type === LANGUAGE_SUPPORT.interface) support.interface = true;
    if (type === LANGUAGE_SUPPORT.subtitles) support.subtitles = true;
    if (type === LANGUAGE_SUPPORT.audio) support.audio = true;
    byLanguage.set(language.id, support);
  }
  return [...byLanguage.values()].filter((s) => s.interface || s.subtitles || s.audio);
}

function pickStoreUrl(websites: IgdbGame['websites']) {
  for (const type of [OFFICIAL_WEBSITE, ...STORE_WEBSITES_BY_PREFERENCE]) {
    const website = websites.find((site) => site.type === type);
    if (website) return website.url;
  }
  return null;
}

export function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
