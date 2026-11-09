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

const SECOND_ITEM_EXAMPLE = {
  game: { ...GAME_EXAMPLE, slug: 'dead-cells', name: 'Dead Cells' },
  reason: { kind: 'features', features: [{ slug: 'roguelike', name: 'Roguelike' }] },
  lowKnown: false,
};

const HORROR = { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' };

const CELESTE = { slug: 'celeste', name: 'Celeste', inCatalog: true };

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
      'Visão geral: a lista principal "Para você", que intercala as prateleiras de interesse na proporção do peso dos jogos de cada uma, e as prateleiras "Porque você gostou de <jogo>" (kind liked-game, até 2, de jogos com nota 4 ou mais ou em favoritos), "Porque você curte <título>" (kind interest, até 6; o atributo é uma etiqueta da comunidade Steam, um gênero ou um tema, com o título do vocabulário) e "Em breve no seu gosto" (kind upcoming), nessa ordem. Um jogo aparece uma vez só: cada prateleira vem sem os jogos mostrados antes, e a que fica abaixo do mínimo não vem. hasMore diz se a lista completa tem mais jogos que os mostrados. Nenhum jogo já avaliado ou em lista; cada um com o motivo: as etiquetas, gêneros ou temas que mais contribuíram. basis é profile (pelo perfil), popular (perfil sem atributo a favor: os mais populares, sem prateleiras) ou empty (sem avaliações, listas nem preferências: levar à partida a frio). lowKnown só é true no modo Descobertas',
    schema: {
      example: {
        mode: 'DISCOVERY',
        basis: 'profile',
        main: { items: [ITEM_EXAMPLE, SECOND_ITEM_EXAMPLE], hasMore: true },
        shelves: [
          {
            key: 'game:celeste',
            kind: 'liked-game',
            feature: null,
            game: CELESTE,
            items: [ITEM_EXAMPLE],
            hasMore: true,
          },
          {
            key: 'theme:horror',
            kind: 'interest',
            feature: HORROR,
            items: [ITEM_EXAMPLE],
            hasMore: true,
          },
          {
            key: 'upcoming',
            kind: 'upcoming',
            feature: null,
            items: [ITEM_EXAMPLE],
            hasMore: false,
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
    description:
      'main, upcoming, game:<slug>, genre:<slug>, theme:<slug> ou tag:<slug>, como na visão geral',
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
      'Uma página da lista completa, para o "ver mais", até o teto da configuração; a repetição com as outras listas é permitida. basis e os itens vêm como na visão geral; com basis popular, só a lista main existe. feature vem nas prateleiras de interesse, e game, nas prateleiras por jogo',
    schema: {
      example: {
        mode: 'DISCOVERY',
        basis: 'profile',
        key: 'theme:horror',
        feature: HORROR,
        game: null,
        page: 1,
        items: [ITEM_EXAMPLE, SECOND_ITEM_EXAMPLE],
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
