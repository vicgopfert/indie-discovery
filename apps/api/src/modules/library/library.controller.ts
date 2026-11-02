import {
  type ListType,
  ListParamSchema,
  PREFERENCES_MAX_PER_TYPE,
  PREFERENCES_MIN,
  type PreferencesInput,
  PreferencesInputSchema,
  type RatingInput,
  RatingInputSchema,
} from '@indie/contracts';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { LibraryService } from './library.service';

const LIBRARY_GAME_EXAMPLE = {
  slug: 'celeste',
  name: 'Celeste',
  coverImageId: 'co3byy',
  releaseStatus: 'RELEASED',
  firstReleaseDate: '2018-01-25',
  genres: [{ slug: 'platform', name: 'Plataforma' }],
  inCatalog: true,
};

const PREFERENCES_EXAMPLE = {
  genres: [
    { slug: 'platform', name: 'Plataforma' },
    { slug: 'puzzle', name: 'Quebra-cabeça' },
  ],
  themes: [{ slug: 'horror', name: 'Terror' }],
};

const SLUG_PARAM = { name: 'slug', description: 'Slug do jogo, o mesmo da ficha' };
const LIST_PARAM = { name: 'list', enum: ['favorite', 'completed', 'want-to-play'] };
const UNAUTHORIZED = { description: 'Sem sessão válida' };
const FORBIDDEN = { description: 'Origem da requisição diferente do frontend' };

@ApiTags('library')
@ApiCookieAuth()
@ApiUnauthorizedResponse(UNAUTHORIZED)
@Controller('me')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Put('ratings/:slug')
  @ApiParam(SLUG_PARAM)
  @ApiBody({ schema: { example: { score: 4 } } })
  @ApiOkResponse({
    description: 'Avaliação criada ou alterada; repetir o PUT não duplica',
    schema: { example: { score: 4, updatedAt: '2026-11-02T12:00:00.000Z' } },
  })
  @ApiBadRequestResponse({ description: 'Nota fora de 1 a 5 ou não inteira' })
  @ApiForbiddenResponse(FORBIDDEN)
  @ApiNotFoundResponse({ description: 'Jogo inexistente ou fora do catálogo' })
  rate(
    @CurrentUser() user: User,
    @Param('slug') slug: string,
    @Body({ schema: RatingInputSchema }) body: RatingInput,
  ) {
    return this.library.rate(user.id, slug, body.score);
  }

  @Delete('ratings/:slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam(SLUG_PARAM)
  @ApiNoContentResponse({
    description: 'Avaliação removida, ou já não havia; vale para jogo fora do catálogo',
  })
  @ApiForbiddenResponse(FORBIDDEN)
  @ApiNotFoundResponse({ description: 'Jogo inexistente' })
  async unrate(@CurrentUser() user: User, @Param('slug') slug: string) {
    await this.library.unrate(user.id, slug);
  }

  @Put('lists/:list/:slug')
  @ApiParam(LIST_PARAM)
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({
    description:
      'Jogo na lista e as listas em que ele ficou; entrar em "concluídos" tira de "quero jogar" e vice-versa',
    schema: { example: { lists: ['FAVORITE', 'COMPLETED'] } },
  })
  @ApiBadRequestResponse({ description: 'Lista diferente de favorite, completed ou want-to-play' })
  @ApiForbiddenResponse(FORBIDDEN)
  @ApiNotFoundResponse({ description: 'Jogo inexistente ou fora do catálogo' })
  addToList(
    @CurrentUser() user: User,
    @Param('list', { schema: ListParamSchema }) list: ListType,
    @Param('slug') slug: string,
  ) {
    return this.library.addToList(user.id, slug, list);
  }

  @Delete('lists/:list/:slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam(LIST_PARAM)
  @ApiParam(SLUG_PARAM)
  @ApiNoContentResponse({
    description: 'Jogo fora da lista, ou já não estava; vale para jogo fora do catálogo',
  })
  @ApiBadRequestResponse({ description: 'Lista diferente de favorite, completed ou want-to-play' })
  @ApiForbiddenResponse(FORBIDDEN)
  @ApiNotFoundResponse({ description: 'Jogo inexistente' })
  async removeFromList(
    @CurrentUser() user: User,
    @Param('list', { schema: ListParamSchema }) list: ListType,
    @Param('slug') slug: string,
  ) {
    await this.library.removeFromList(user.id, slug, list);
  }

  @Get('library')
  @ApiOkResponse({
    description:
      'Avaliações e listas do usuário, da mais recente para a mais antiga; o jogo que saiu do catálogo continua, com inCatalog false',
    schema: {
      example: {
        ratings: [{ game: LIBRARY_GAME_EXAMPLE, score: 4, updatedAt: '2026-11-02T12:00:00.000Z' }],
        lists: {
          FAVORITE: [{ game: LIBRARY_GAME_EXAMPLE, addedAt: '2026-11-02T12:00:00.000Z' }],
          COMPLETED: [],
          WANT_TO_PLAY: [],
        },
      },
    },
  })
  findLibrary(@CurrentUser() user: User) {
    return this.library.findLibrary(user.id);
  }

  @Put('preferences')
  @ApiBody({ schema: { example: { genres: ['platform', 'puzzle'], themes: ['horror'] } } })
  @ApiOkResponse({
    description:
      'Preferências da partida a frio trocadas pelo conjunto enviado; a primeira vez conclui a partida a frio (onboardingCompletedAt)',
    schema: { example: PREFERENCES_EXAMPLE },
  })
  @ApiBadRequestResponse({
    description: `Menos de ${PREFERENCES_MIN} gêneros ou temas no total, mais de ${PREFERENCES_MAX_PER_TYPE} de um tipo ou slug fora das opções de GET /features`,
  })
  @ApiForbiddenResponse(FORBIDDEN)
  savePreferences(
    @CurrentUser() user: User,
    @Body({ schema: PreferencesInputSchema }) body: PreferencesInput,
  ) {
    return this.library.savePreferences(user.id, body);
  }

  @Get('preferences')
  @ApiOkResponse({
    description: 'Gêneros e temas escolhidos na partida a frio, com o nome em português',
    schema: { example: PREFERENCES_EXAMPLE },
  })
  findPreferences(@CurrentUser() user: User) {
    return this.library.findPreferences(user.id);
  }
}
