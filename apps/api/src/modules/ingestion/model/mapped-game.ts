import type { FeatureType, ReleaseStatus } from '../../../generated/prisma/client';

// O jogo como a ingestão o entende, já traduzido da IGDB: é o que critério, alertas e gravação usam.
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
