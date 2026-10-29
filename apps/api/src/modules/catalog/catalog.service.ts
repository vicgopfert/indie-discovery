import type {
  FeatureLabel,
  FeatureOption,
  FeatureQuery,
  GameDetail,
  GamePage,
  GameSearchQuery,
  GameSummary,
} from '@indie/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogRepository, type GameDetailRow, type GameSummaryRow } from './catalog.repository';
import { FeatureLabels, type LabeledFeatureType } from './feature-labels';

const FEATURE_TYPES: Record<FeatureQuery['type'], LabeledFeatureType> = {
  genre: 'GENRE',
  theme: 'THEME',
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

const sortedNames = (names: string[]) => names.sort((a, b) => a.localeCompare(b, 'pt-BR'));

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly labels: FeatureLabels,
  ) {}

  async searchGames(query: GameSearchQuery): Promise<GamePage> {
    const { total, games } = await this.catalog.searchGames(query);
    return {
      items: games.map((game) => this.toSummary(game)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findGame(slug: string): Promise<GameDetail> {
    const game = await this.catalog.findGameBySlug(slug);
    if (!game) throw new NotFoundException('Jogo não encontrado.');

    const features = game.features.map(({ feature }) => feature);
    const ofType = (type: LabeledFeatureType) =>
      features.filter((feature) => feature.type === type);
    const companies = (role: 'isDeveloper' | 'isPublisher') =>
      sortedNames(game.companies.filter((link) => link[role]).map(({ company }) => company.name));

    return {
      ...summaryFields(game),
      genres: this.labeled('GENRE', ofType('GENRE')),
      summary: game.summary,
      themes: this.labeled('THEME', ofType('THEME')),
      developers: companies('isDeveloper'),
      publishers: companies('isPublisher'),
      studioCountry: toStudioCountry(game),
      languages: game.languages
        .map(({ language, ...support }) => ({
          locale: language.locale,
          name: language.namePt,
          ...support,
        }))
        .sort(byName),
      officialUrl: webUrl(game.storeUrl),
    };
  }

  async listFeatures({ type }: FeatureQuery): Promise<FeatureOption[]> {
    const featureType = FEATURE_TYPES[type];
    const features = await this.catalog.countGamesByFeature(featureType);
    return features
      .filter(({ slug }) => !this.labels.isHidden(featureType, slug))
      .map((feature) => ({
        ...feature,
        name: this.labels.name(featureType, feature.slug, feature.name),
      }))
      .sort(byName);
  }

  private toSummary(game: GameSummaryRow): GameSummary {
    return {
      ...summaryFields(game),
      genres: this.labeled(
        'GENRE',
        game.features.map(({ feature }) => feature),
      ),
    };
  }

  private labeled(type: LabeledFeatureType, features: FeatureLabel[]): FeatureLabel[] {
    return features
      .filter(({ slug }) => !this.labels.isHidden(type, slug))
      .map(({ slug, name }) => ({ slug, name: this.labels.name(type, slug, name) }))
      .sort(byName);
  }
}

function summaryFields(game: GameSummaryRow | GameDetailRow): Omit<GameSummary, 'genres'> {
  return {
    slug: game.slug,
    name: game.name,
    coverImageId: game.coverImageId,
    releaseStatus: game.releaseStatus,
    firstReleaseDate: game.firstReleaseDate?.toISOString().slice(0, 10) ?? null,
  };
}

function toStudioCountry({
  studioCountry,
  studioCountrySource,
}: GameDetailRow): GameDetail['studioCountry'] {
  if (!studioCountry || !studioCountrySource) return null;
  return { code: studioCountry.alpha2, name: studioCountry.namePt, source: studioCountrySource };
}

// O link vem da IGDB e vira href na ficha: só passa endereço web.
function webUrl(url: string | null) {
  if (!url || !URL.canParse(url)) return null;
  return ['http:', 'https:'].includes(new URL(url).protocol) ? url : null;
}
