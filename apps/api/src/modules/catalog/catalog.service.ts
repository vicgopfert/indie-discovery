import type {
  FeatureOption,
  FeatureQuery,
  GamePage,
  GameSearchQuery,
  GameSummary,
} from '@indie/contracts';
import { Injectable } from '@nestjs/common';
import { CatalogRepository, type GameSummaryRow } from './catalog.repository';
import { FeatureLabels, type LabeledFeatureType } from './feature-labels';

const FEATURE_TYPES: Record<FeatureQuery['type'], LabeledFeatureType> = {
  genre: 'GENRE',
  theme: 'THEME',
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

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
      slug: game.slug,
      name: game.name,
      coverImageId: game.coverImageId,
      releaseStatus: game.releaseStatus,
      firstReleaseDate: game.firstReleaseDate?.toISOString().slice(0, 10) ?? null,
      genres: game.features
        .map(({ feature }) => feature)
        .filter(({ slug }) => !this.labels.isHidden('GENRE', slug))
        .map(({ slug, name }) => ({ slug, name: this.labels.name('GENRE', slug, name) }))
        .sort(byName),
    };
  }
}
