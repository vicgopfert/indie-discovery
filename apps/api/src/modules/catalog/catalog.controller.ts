import {
  COLLECTION_PREVIEW_COVERS,
  type CollectionPageQuery,
  CollectionPageQuerySchema,
  COUNTRY_UNKNOWN,
  type FeatureQuery,
  FeatureQuerySchema,
  GAMES_FILTER_MAX_VALUES,
  GAMES_PAGE_MAX,
  GAMES_PAGE_SIZE_DEFAULT,
  GAMES_PAGE_SIZE_MAX,
  GAMES_SEARCH_MAX_LENGTH,
  GAMES_SORTS,
  type GameSearchQuery,
  GameSearchQuerySchema,
  FEATURE_TYPE_FILTERS,
  PORTUGUESE_FILTERS,
  RELEASE_STATUS_FILTERS,
} from '@indie/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

const GAME_PAGE_EXAMPLE = {
  items: [
    {
      slug: 'celeste',
      name: 'Celeste',
      coverImageId: 'co3byy',
      releaseStatus: 'RELEASED',
      firstReleaseDate: '2018-01-25',
      genres: [
        { slug: 'adventure', name: 'Aventura' },
        { slug: 'platform', name: 'Plataforma' },
      ],
    },
  ],
  page: 1,
  pageSize: 24,
  total: 1,
  totalPages: 1,
};

const GAME_DETAIL_EXAMPLE = {
  ...GAME_PAGE_EXAMPLE.items[0],
  summary: 'Ajude Madeline a sobreviver aos seus demônios interiores na montanha Celeste.',
  themes: [{ slug: 'action', name: 'Ação' }],
  tags: [
    { slug: 'precision-platformer', name: 'Plataforma de Precisão' },
    { slug: 'difficult', name: 'Difícil' },
  ],
  tagSource: 'STEAM',
  steamAppId: 504230,
  developers: ['Maddy Makes Games'],
  publishers: ['Maddy Makes Games'],
  studioCountry: { code: 'CA', name: 'Canadá', source: 'IGDB' },
  languages: [
    { locale: 'pt-BR', name: 'Português (Brasil)', interface: true, subtitles: true, audio: false },
  ],
  officialUrl: 'https://www.celestegame.com',
};

const COLLECTION_EXAMPLE = {
  slug: 'brasil',
  name: 'Brasil',
  description: 'Folclore, história e lugares do Brasil.',
};

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get('games')
  @ApiQuery({
    name: 'q',
    required: false,
    description: `Parte do nome, sem diferenciar maiúsculas; até ${GAMES_SEARCH_MAX_LENGTH} caracteres`,
  })
  @ApiQuery({
    name: 'genre',
    required: false,
    isArray: true,
    description: `Slug do gênero; repetido, o jogo precisa ter todos (até ${GAMES_FILTER_MAX_VALUES})`,
  })
  @ApiQuery({
    name: 'theme',
    required: false,
    isArray: true,
    description: `Slug do tema; repetido, o jogo precisa ter todos (até ${GAMES_FILTER_MAX_VALUES})`,
  })
  @ApiQuery({
    name: 'tag',
    required: false,
    isArray: true,
    description: `Slug da etiqueta da comunidade Steam; repetido, o jogo precisa ter todas (até ${GAMES_FILTER_MAX_VALUES})`,
  })
  @ApiQuery({ name: 'status', required: false, enum: RELEASE_STATUS_FILTERS })
  @ApiQuery({
    name: 'portuguese',
    required: false,
    enum: PORTUGUESE_FILTERS,
    description:
      'yes: tem pt-BR ou pt-PT; no: tem idiomas informados, nenhum português; unknown: nenhum idioma informado',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    isArray: true,
    description: `Sigla do país do estúdio ou ${COUNTRY_UNKNOWN}; repetido, basta ter um (até ${GAMES_FILTER_MAX_VALUES})`,
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: GAMES_SORTS,
    description: 'popular (padrão), newest (sem data no fim) ou name',
  })
  @ApiQuery({ name: 'page', required: false, description: `De 1 a ${GAMES_PAGE_MAX}` })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: `De 1 a ${GAMES_PAGE_SIZE_MAX}; padrão ${GAMES_PAGE_SIZE_DEFAULT}`,
  })
  @ApiOkResponse({
    description:
      'Jogos do catálogo que atendem a todos os filtros, com nomes de gênero em português',
    schema: { example: GAME_PAGE_EXAMPLE },
  })
  @ApiBadRequestResponse({ description: 'Parâmetro fora dos limites ou com valor desconhecido' })
  searchGames(@Query({ schema: GameSearchQuerySchema }) query: GameSearchQuery) {
    return this.catalog.searchGames(query);
  }

  @Public()
  @Get('games/:slug')
  @ApiParam({ name: 'slug', description: 'Slug do jogo, o mesmo da IGDB' })
  @ApiOkResponse({
    description:
      'Ficha do jogo com empresas, país do estúdio e a origem desse dado, etiquetas da comunidade Steam e a origem delas, idiomas e link oficial',
    schema: { example: GAME_DETAIL_EXAMPLE },
  })
  @ApiNotFoundResponse({ description: 'Slug inexistente ou jogo fora do catálogo' })
  findGame(@Param('slug') slug: string) {
    return this.catalog.findGame(slug);
  }

  @Public()
  @Get('features')
  @ApiQuery({ name: 'type', enum: FEATURE_TYPE_FILTERS })
  @ApiOkResponse({
    description:
      'Opções de filtro (gênero, tema ou etiqueta) com o nome em português e quantos jogos do catálogo as têm',
    schema: { example: [{ slug: 'puzzle', name: 'Quebra-cabeça', gameCount: 3607 }] },
  })
  @ApiBadRequestResponse({ description: 'Tipo ausente ou diferente de genre, theme e tag' })
  listFeatures(@Query({ schema: FeatureQuerySchema }) query: FeatureQuery) {
    return this.catalog.listFeatures(query);
  }

  @Public()
  @Get('collections')
  @ApiOkResponse({
    description: `Coleções culturais curadas com jogos no catálogo, na ordem do arquivo de curadoria, com até ${COLLECTION_PREVIEW_COVERS} capas dos jogos mais populares`,
    schema: {
      example: [{ ...COLLECTION_EXAMPLE, gameCount: 12, coverImageIds: ['co3byy'] }],
    },
  })
  listCollections() {
    return this.catalog.listCollections();
  }

  @Public()
  @Get('collections/:slug')
  @ApiParam({ name: 'slug', description: 'Slug da coleção' })
  @ApiQuery({ name: 'page', required: false, description: `De 1 a ${GAMES_PAGE_MAX}` })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: `De 1 a ${GAMES_PAGE_SIZE_MAX}; padrão ${GAMES_PAGE_SIZE_DEFAULT}`,
  })
  @ApiOkResponse({
    description: 'A coleção e os jogos dela no catálogo, dos mais populares para os menos',
    schema: { example: { ...COLLECTION_EXAMPLE, games: GAME_PAGE_EXAMPLE } },
  })
  @ApiBadRequestResponse({ description: 'Página fora dos limites' })
  @ApiNotFoundResponse({ description: 'Slug inexistente ou coleção sem jogos no catálogo' })
  findCollection(
    @Param('slug') slug: string,
    @Query({ schema: CollectionPageQuerySchema }) query: CollectionPageQuery,
  ) {
    return this.catalog.findCollection(slug, query);
  }

  @Public()
  @Get('countries')
  @ApiOkResponse({
    description: 'Países do estúdio com pelo menos 20 jogos no catálogo, em ordem alfabética',
    schema: { example: [{ code: 'BR', name: 'Brasil', gameCount: 251 }] },
  })
  listCountries() {
    return this.catalog.listCountries();
  }
}
