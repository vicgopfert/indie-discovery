import { type UpdateMeInput, UpdateMeSchema } from '@indie/contracts';
import { Body, Controller, Patch } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../../generated/prisma/client';
import { toPublicUser } from './user.presenter';
import { UsersRepository } from './users.repository';

@ApiTags('users')
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersRepository) {}

  @Patch()
  @ApiCookieAuth()
  @ApiBody({ schema: { example: { discoveryMode: 'DISCOVERY' } } })
  @ApiOkResponse({
    description: 'Modo de descoberta trocado; devolve o usuário como GET /auth/me',
    schema: {
      example: {
        id: '2f0c…',
        email: 'jogadora@example.com',
        displayName: 'Jogadora',
        role: 'USER',
        discoveryMode: 'DISCOVERY',
        onboardingCompletedAt: '2026-11-02T12:00:00.000Z',
        createdAt: '2026-10-27T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Modo diferente de POPULAR, BALANCED ou DISCOVERY' })
  @ApiUnauthorizedResponse({ description: 'Sem sessão válida' })
  @ApiForbiddenResponse({ description: 'Origem da requisição diferente do frontend' })
  async update(@CurrentUser() user: User, @Body({ schema: UpdateMeSchema }) body: UpdateMeInput) {
    return toPublicUser(await this.users.updateDiscoveryMode(user.id, body.discoveryMode));
  }
}
