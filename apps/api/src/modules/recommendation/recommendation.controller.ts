import {
  MODE_PARAMS,
  RECOMMENDATIONS_LIMIT_DEFAULT,
  RECOMMENDATIONS_LIMIT_MAX,
  type RecommendationQuery,
  RecommendationQuerySchema,
} from '@indie/contracts';
import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiOkResponse,
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
} from './generate-recommendations.use-case';

const GAME_EXAMPLE = {
  slug: 'spelunky',
  name: 'Spelunky',
  coverImageId: 'co1abc',
  releaseStatus: 'RELEASED',
  firstReleaseDate: '2013-07-03',
  genres: [{ slug: 'platform', name: 'Plataforma' }],
};

@ApiTags('recommendations')
@ApiCookieAuth()
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly recommendations: GenerateRecommendationsUseCase) {}

  @Get()
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: Object.keys(MODE_PARAMS),
    description: 'Modo de descoberta; sem ele, vale o salvo no usuário (a consulta não o grava)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: `De 1 a ${RECOMMENDATIONS_LIMIT_MAX}; padrão ${RECOMMENDATIONS_LIMIT_DEFAULT}`,
  })
  @ApiOkResponse({
    description:
      'Os jogos mais bem pontuados para o perfil, sem os já avaliados ou em lista, cada um com o motivo: os gêneros e temas que mais contribuíram, ou o jogo da biblioteca que mais pesou. basis é profile (pelo perfil), popular (perfil sem atributo a favor: os mais populares) ou empty (sem avaliações, listas nem preferências: levar à partida a frio). lowKnown só é true no modo Descobertas',
    schema: {
      example: {
        mode: 'DISCOVERY',
        basis: 'profile',
        items: [
          {
            game: GAME_EXAMPLE,
            reason: {
              kind: 'features',
              features: [
                { slug: 'platform', name: 'Plataforma' },
                { slug: 'adventure', name: 'Aventura' },
              ],
            },
            lowKnown: true,
          },
          {
            game: { ...GAME_EXAMPLE, slug: 'dead-cells', name: 'Dead Cells' },
            reason: {
              kind: 'liked-game',
              game: { slug: 'celeste', name: 'Celeste', inCatalog: true },
            },
            lowKnown: false,
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Modo ou limite fora das opções' })
  @ApiUnauthorizedResponse({ description: 'Sem sessão válida' })
  @ApiServiceUnavailableResponse({
    description: `Índice de conteúdo carregando ou com falha: "${INDEX_UNAVAILABLE}"`,
  })
  list(
    @CurrentUser() user: User,
    @Query({ schema: RecommendationQuerySchema }) query: RecommendationQuery,
  ) {
    return this.recommendations.execute(user.id, query.mode ?? user.discoveryMode, query.limit);
  }
}
