import type {
  FeatureQuery,
  GameLists,
  Library,
  LibraryGame,
  ListType,
  Preferences,
  PreferencesInput,
  Rating,
} from '@indie/contracts';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import type { LabeledFeatureType } from '../catalog/feature-labels';
import { type LibraryGameRow, LibraryRepository } from './library.repository';

// "Concluídos" e "quero jogar" se excluem; "favoritos" combina com qualquer uma.
const EXCLUSIVE_LISTS: Record<ListType, ListType[]> = {
  FAVORITE: [],
  COMPLETED: ['WANT_TO_PLAY'],
  WANT_TO_PLAY: ['COMPLETED'],
};

const PREFERENCE_TYPES = [
  { field: 'genres', filter: 'genre', type: 'GENRE' },
  { field: 'themes', filter: 'theme', type: 'THEME' },
] as const satisfies {
  field: keyof PreferencesInput;
  filter: FeatureQuery['type'];
  type: LabeledFeatureType;
}[];

const GAME_NOT_FOUND = 'Jogo não encontrado.';

@Injectable()
export class LibraryService {
  constructor(
    private readonly library: LibraryRepository,
    private readonly catalog: CatalogService,
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

  // Só valem as opções que GET /features oferece: atributo escondido ou sem jogo no catálogo não.
  async savePreferences(userId: string, input: PreferencesInput): Promise<Preferences> {
    const featureIds: string[] = [];
    const unknown: string[] = [];
    for (const { field, filter, type } of PREFERENCE_TYPES) {
      const options = new Set(
        (await this.catalog.listFeatures({ type: filter })).map(({ slug }) => slug),
      );
      const invalid = input[field].filter((slug) => !options.has(slug));
      if (invalid.length > 0) unknown.push(`${field}: Opção desconhecida: ${invalid.join(', ')}.`);
      else featureIds.push(...(await this.library.findFeatureIds(type, input[field])));
    }
    if (unknown.length > 0) throw new BadRequestException(unknown);

    await this.library.replacePreferences(userId, featureIds, new Date());
    return this.findPreferences(userId);
  }

  async findPreferences(userId: string): Promise<Preferences> {
    const preferences = await this.library.findPreferences(userId);
    const ofType = (type: LabeledFeatureType) =>
      this.catalog.labeled(
        type,
        preferences.filter((preference) => preference.type === type),
      );
    return { genres: ofType('GENRE'), themes: ofType('THEME') };
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
