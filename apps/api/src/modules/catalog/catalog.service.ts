import type {
  CollectionDetail,
  CollectionPageQuery,
  CollectionSummary,
  CountryOption,
  FeatureLabel,
  FeatureOption,
  FeatureQuery,
  GameDetail,
  GamePage,
  GameSearchQuery,
  GameSummary,
} from '@indie/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CatalogRepository,
  type FilterFeatureType,
  type GameDetailRow,
  type GameSummaryRow,
} from './catalog.repository';
import { FeatureLabels, type LabeledFeatureType } from './feature-labels';

const FEATURE_TYPES: Record<FeatureQuery['type'], FilterFeatureType> = {
  genre: 'GENRE',
  theme: 'THEME',
  tag: 'TAG',
};

// Mínimo de jogos para um país virar opção de filtro (F-06); injetado para o e2e testar o limite.
export const COUNTRY_OPTION_MIN_GAMES = Symbol('COUNTRY_OPTION_MIN_GAMES');

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR');

const sortedNames = (names: string[]) => names.sort((a, b) => a.localeCompare(b, 'pt-BR'));

@Injectable()
export class CatalogService {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly labels: FeatureLabels,
    @Inject(COUNTRY_OPTION_MIN_GAMES) private readonly countryOptionMinGames: number,
  ) {}

  async searchGames(query: GameSearchQuery): Promise<GamePage> {
    return this.toPage(await this.catalog.searchGames(query), query);
  }

  async findGame(slug: string): Promise<GameDetail> {
    const game = await this.catalog.findGameBySlug(slug);
    if (!game) throw new NotFoundException('Jogo não encontrado.');

    const features = game.features.map(({ feature }) => feature);
    const ofType = (type: LabeledFeatureType) =>
      features.filter((feature) => feature.type === type);
    const tags = game.features
      .filter(({ feature }) => feature.type === 'TAG')
      .sort(
        (a, b) =>
          (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
          a.feature.name.localeCompare(b.feature.name, 'pt-BR'),
      )
      .map(({ feature: { slug, name } }) => ({ slug, name }));
    const companies = (role: 'isDeveloper' | 'isPublisher') =>
      sortedNames(game.companies.filter((link) => link[role]).map(({ company }) => company.name));

    return {
      ...summaryFields(game),
      genres: this.labeled('GENRE', ofType('GENRE')),
      summary: game.summary,
      themes: this.labeled('THEME', ofType('THEME')),
      tags,
      tagSource: game.tagSource,
      steamAppId: game.steamAppId,
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

  // A etiqueta já vem em português, gravada do vocabulário.
  async listFeatures({ type }: FeatureQuery): Promise<FeatureOption[]> {
    const featureType = FEATURE_TYPES[type];
    const features = await this.catalog.countGamesByFeature(featureType);
    if (featureType === 'TAG') return features.sort(byName);
    return features
      .filter(({ slug }) => !this.labels.isHidden(featureType, slug))
      .map((feature) => ({
        ...feature,
        name: this.labels.name(featureType, feature.slug, feature.name),
      }))
      .sort(byName);
  }

  async listCountries(): Promise<CountryOption[]> {
    const countries = await this.catalog.countGamesByCountry();
    return countries
      .filter(({ gameCount }) => gameCount >= this.countryOptionMinGames)
      .map(({ alpha2, namePt, gameCount }) => ({ code: alpha2, name: namePt, gameCount }))
      .sort(byName);
  }

  async listCollections(): Promise<CollectionSummary[]> {
    const collections = await this.catalog.listCollections();
    return collections.map(({ slug, name, description, _count, games }) => ({
      slug,
      name,
      description,
      gameCount: _count.games,
      coverImageIds: games.map(({ game }) => game.coverImageId),
    }));
  }

  // A coleção sem jogo no catálogo responde como inexistente, porque a lista também a esconde.
  async findCollection(slug: string, query: CollectionPageQuery): Promise<CollectionDetail> {
    const found = await this.catalog.findCollectionGames(slug, query);
    if (!found || found.total === 0) throw new NotFoundException('Coleção não encontrada.');
    return { ...found.collection, games: this.toPage(found, query) };
  }

  private toPage(
    { total, games }: { total: number; games: GameSummaryRow[] },
    { page, pageSize }: { page: number; pageSize: number },
  ): GamePage {
    return {
      items: games.map((game) => this.toSummary(game)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  toSummary(game: GameSummaryRow): GameSummary {
    return {
      ...summaryFields(game),
      genres: this.labeled(
        'GENRE',
        game.features.map(({ feature }) => feature),
      ),
    };
  }

  labeled(type: LabeledFeatureType, features: FeatureLabel[]): FeatureLabel[] {
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
