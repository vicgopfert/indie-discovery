import {
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
  RELEASE_STATUS_FILTERS,
} from '@indie/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
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
  @ApiQuery({ name: 'status', required: false, enum: RELEASE_STATUS_FILTERS })
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
  @Get('features')
  @ApiQuery({ name: 'type', enum: FEATURE_TYPE_FILTERS })
  @ApiOkResponse({
    description: 'Opções de filtro com o nome em português e quantos jogos do catálogo as têm',
    schema: { example: [{ slug: 'puzzle', name: 'Quebra-cabeça', gameCount: 3607 }] },
  })
  @ApiBadRequestResponse({ description: 'Tipo ausente ou diferente de genre e theme' })
  listFeatures(@Query({ schema: FeatureQuerySchema }) query: FeatureQuery) {
    return this.catalog.listFeatures(query);
  }
}
