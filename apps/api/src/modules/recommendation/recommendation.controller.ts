import {
  MODE_PARAMS,
  RECOMMENDATIONS_PAGE_MAX,
  type RecommendationPageQuery,
  RecommendationPageQuerySchema,
  type RecommendationQuery,
  RecommendationQuerySchema,
} from '@indie/contracts';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import {
  GenerateRecommendationsUseCase,
  INDEX_UNAVAILABLE,
  LIST_NOT_FOUND,
} from './generate-recommendations.use-case';

const GAME_EXAMPLE = {
  slug: 'spelunky',
  name: 'Spelunky',
  coverImageId: 'co1abc',
  releaseStatus: 'RELEASED',
  firstReleaseDate: '2013-07-03',
  genres: [{ slug: 'platform', name: 'Plataforma' }],
};

const ITEM_EXAMPLE = {
  game: GAME_EXAMPLE,
  reason: {
    kind: 'features',
    features: [
      { slug: 'platform', name: 'Plataforma' },
      { slug: 'adventure', name: 'Aventura' },
    ],
  },
  lowKnown: true,
};

const LIKED_GAME_EXAMPLE = {
  game: { ...GAME_EXAMPLE, slug: 'dead-cells', name: 'Dead Cells' },
  reason: { kind: 'liked-game', game: { slug: 'celeste', name: 'Celeste', inCatalog: true } },
  lowKnown: false,
};

const HORROR = { type: 'THEME', slug: 'horror', name: 'Terror' };

const MODE_QUERY = {
  name: 'mode',
  required: false,
  enum: Object.keys(MODE_PARAMS),
  description: 'Modo de descoberta; sem ele, vale o salvo no usuário (a consulta não o grava)',
};

const INDEX_UNAVAILABLE_RESPONSE = {
  description: `Índice de conteúdo carregando ou com falha: "${INDEX_UNAVAILABLE}"`,
};

@ApiTags('recommendations')
@ApiCookieAuth()
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendations: GenerateRecommendationsUseCase) {}

  @Get()
  @ApiQuery(MODE_QUERY)
  @ApiOkResponse({
    description:
      'Visão geral: a lista principal "Para você", que intercala os interesses do perfil na proporção da cobertura de cada um, e as prateleiras "Em breve no seu gosto" (kind upcoming) e "Porque você curte <atributo>" (kind interest; o atributo é um gênero, um tema ou um estilo curado), nessa ordem. Um jogo aparece uma vez só: cada prateleira vem sem os jogos mostrados antes, e a que fica abaixo do mínimo não vem. hasMore diz se a lista completa tem mais jogos que os mostrados. Nenhum jogo já avaliado ou em lista; cada um com o motivo: os gêneros e temas que mais contribuíram, ou o jogo da biblioteca que mais pesou. basis é profile (pelo perfil), popular (perfil sem atributo a favor: os mais populares, sem prateleiras) ou empty (sem avaliações, listas nem preferências: levar à partida a frio). lowKnown só é true no modo Descobertas',
    schema: {
      example: {
        mode: 'DISCOVERY',
        basis: 'profile',
        main: { items: [ITEM_EXAMPLE, LIKED_GAME_EXAMPLE], hasMore: true },
        shelves: [
          {
            key: 'upcoming',
            kind: 'upcoming',
            feature: null,
            items: [ITEM_EXAMPLE],
            hasMore: false,
          },
          {
            key: 'theme:horror',
            kind: 'interest',
            feature: HORROR,
            items: [ITEM_EXAMPLE],
            hasMore: true,
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Modo fora das opções' })
  @ApiUnauthorizedResponse({ description: 'Sem sessão válida' })
  @ApiServiceUnavailableResponse(INDEX_UNAVAILABLE_RESPONSE)
  overview(
    @CurrentUser() user: User,
    @Query({ schema: RecommendationQuerySchema }) query: RecommendationQuery,
  ) {
    return this.recommendations.overview(user.id, query.mode ?? user.discoveryMode);
  }

  @Get('lists/:key')
  @ApiParam({
    name: 'key',
    description: 'main, upcoming, genre:<slug>, theme:<slug> ou style:<slug>, como na visão geral',
    example: 'theme:horror',
  })
  @ApiQuery(MODE_QUERY)
  @ApiQuery({
    name: 'page',
    required: false,
    description: `Começa em 1, vai até ${RECOMMENDATIONS_PAGE_MAX}; além do teto da lista, a página vem vazia`,
  })
  @ApiOkResponse({
    description:
      'Uma página da lista completa, para o "ver mais", até o teto da configuração; a repetição com as outras listas é permitida. Os itens vêm no formato da visão geral',
    schema: {
      example: {
        mode: 'DISCOVERY',
        key: 'theme:horror',
        feature: HORROR,
        page: 1,
        items: [ITEM_EXAMPLE, LIKED_GAME_EXAMPLE],
        hasMore: true,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Modo ou página fora das opções' })
  @ApiUnauthorizedResponse({ description: 'Sem sessão válida' })
  @ApiNotFoundResponse({
    description: `Chave fora das listas atuais do perfil: "${LIST_NOT_FOUND}"`,
  })
  @ApiServiceUnavailableResponse(INDEX_UNAVAILABLE_RESPONSE)
  page(
    @CurrentUser() user: User,
    @Param('key') key: string,
    @Query({ schema: RecommendationPageQuerySchema }) query: RecommendationPageQuery,
  ) {
    return this.recommendations.page(user.id, query.mode ?? user.discoveryMode, key, query.page);
  }
}
