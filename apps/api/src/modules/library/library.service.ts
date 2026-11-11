import {
  type FeatureLabel,
  type GameLists,
  type GameLibraryState,
  type Library,
  type LibraryGame,
  type ListType,
  type PreferenceOptions,
  type Preferences,
  type PreferencesInput,
  type Rating,
} from '@indie/contracts';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { FeatureType } from '../../generated/prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { type LibraryGameRow, LibraryRepository } from './library.repository';

// "Concluídos" e "quero jogar" se excluem; "favoritos" combina com qualquer uma.
const EXCLUSIVE_LISTS: Record<ListType, ListType[]> = {
  FAVORITE: [],
  COMPLETED: ['WANT_TO_PLAY'],
  WANT_TO_PLAY: ['COMPLETED'],
};

const PREFERENCE_GROUPS = [
  { field: 'genres', type: 'GENRE' },
  { field: 'themes', type: 'THEME' },
  { field: 'tags', type: 'TAG' },
] as const satisfies { field: keyof PreferencesInput; type: FeatureType }[];

export const PREFERENCE_TAGS = Symbol('PREFERENCE_TAGS');

const GAME_NOT_FOUND = 'Jogo não encontrado.';

const byName = (a: FeatureLabel, b: FeatureLabel) => a.name.localeCompare(b.name, 'pt-BR');

@Injectable()
export class LibraryService {
  constructor(
    private readonly library: LibraryRepository,
    private readonly catalog: CatalogService,
    @Inject(PREFERENCE_TAGS) private readonly preferenceTags: ReadonlyMap<string, string | null>,
  ) {}

  async rate(userId: string, slug: string, score: number): Promise<Rating> {
    const gameId = await this.catalogGameId(slug);
    const rating = await this.library.upsertRating(userId, gameId, score);
    return { score: rating.score, updatedAt: rating.updatedAt.toISOString() };
  }

  async unrate(userId: string, slug: string): Promise<void> {
    await this.library.deleteRating(userId, await this.storedGameId(slug));
  }

  async addToList(userId: string, slug: string, listType: ListType): Promise<GameLists> {
    const gameId = await this.catalogGameId(slug);
    const lists = await this.library.addToList(userId, gameId, listType, EXCLUSIVE_LISTS[listType]);
    return { lists };
  }

  async removeFromList(userId: string, slug: string, listType: ListType): Promise<void> {
    await this.library.removeFromList(userId, await this.storedGameId(slug), listType);
  }

  async findLibrary(userId: string): Promise<Library> {
    const { ratings, listEntries } = await this.library.findLibrary(userId);
    const entriesOf = (listType: ListType) =>
      listEntries
        .filter((entry) => entry.listType === listType)
        .map(({ game, createdAt }) => ({
          game: this.toGame(game),
          addedAt: createdAt.toISOString(),
        }));
    return {
      ratings: ratings.map(({ game, score, updatedAt }) => ({
        game: this.toGame(game),
        score,
        updatedAt: updatedAt.toISOString(),
      })),
      lists: {
        FAVORITE: entriesOf('FAVORITE'),
        COMPLETED: entriesOf('COMPLETED'),
        WANT_TO_PLAY: entriesOf('WANT_TO_PLAY'),
      },
    };
  }

  // Vale também para o jogo que saiu do catálogo, que continua na biblioteca.
  async findGameState(userId: string, slug: string): Promise<GameLibraryState> {
    const { rating, lists } = await this.library.findGameState(
      userId,
      await this.storedGameId(slug),
    );
    return {
      rating: rating && { score: rating.score, updatedAt: rating.updatedAt.toISOString() },
      lists,
    };
  }

  // As opções de GET /features, com as etiquetas que podem virar prateleira, menos as que repetem a
  // ideia de um gênero ou tema oferecido (fica o da IGDB): a mesma ideia não aparece em dois grupos.
  async findPreferenceOptions(): Promise<PreferenceOptions> {
    const [genres, themes, tags] = await Promise.all([
      this.catalog.listFeatures({ type: 'genre' }),
      this.catalog.listFeatures({ type: 'theme' }),
      this.catalog.listFeatures({ type: 'tag' }),
    ]);
    const offered = new Set([
      ...genres.map(({ slug }) => `genre:${slug}`),
      ...themes.map(({ slug }) => `theme:${slug}`),
    ]);
    return {
      genres,
      themes,
      tags: tags.filter(({ slug }) => {
        const sameIdea = this.preferenceTags.get(slug);
        return sameIdea === null || (sameIdea !== undefined && !offered.has(sameIdea));
      }),
    };
  }

  // Só valem as opções da partida a frio: atributo escondido ou sem jogo no catálogo não.
  async savePreferences(userId: string, input: PreferencesInput): Promise<Preferences> {
    const options = await this.findPreferenceOptions();
    const featureIds: string[] = [];
    const unknown: string[] = [];
    for (const { field, type } of PREFERENCE_GROUPS) {
      const offered = new Set(options[field].map(({ slug }) => slug));
      const invalid = input[field].filter((slug) => !offered.has(slug));
      if (invalid.length > 0) unknown.push(`${field}: Opção desconhecida: ${invalid.join(', ')}.`);
      else featureIds.push(...(await this.library.findFeatureIds(type, input[field])));
    }
    if (unknown.length > 0) throw new BadRequestException(unknown);

    await this.library.replacePreferences(userId, featureIds, new Date());
    return this.findPreferences(userId);
  }

  // A etiqueta já tem o nome em português, gravado na ingestão.
  async findPreferences(userId: string): Promise<Preferences> {
    const preferences = await this.library.findPreferences(userId);
    const ofType = (type: FeatureType) =>
      preferences.filter((preference) => preference.type === type);
    return {
      genres: this.catalog.labeled('GENRE', ofType('GENRE')),
      themes: this.catalog.labeled('THEME', ofType('THEME')),
      tags: ofType('TAG')
        .map(({ slug, name }) => ({ slug, name }))
        .sort(byName),
    };
  }

  // Avaliar ou pôr numa lista exige o jogo no catálogo: não se começa pelo que não se vê.
  private async catalogGameId(slug: string): Promise<string> {
    const game = await this.library.findGame(slug);
    if (!game?.inCatalog) throw new NotFoundException(GAME_NOT_FOUND);
    return game.id;
  }

  // Remover vale também para o jogo que saiu do catálogo, que continua na biblioteca.
  private async storedGameId(slug: string): Promise<string> {
    const game = await this.library.findGame(slug);
    if (!game) throw new NotFoundException(GAME_NOT_FOUND);
    return game.id;
  }

  private toGame(game: LibraryGameRow): LibraryGame {
    return { ...this.catalog.toSummary(game), inCatalog: game.inCatalog };
  }
}
