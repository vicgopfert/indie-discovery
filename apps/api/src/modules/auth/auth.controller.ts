import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type LoginInput, LoginSchema, type RegisterInput, RegisterSchema } from '@indie/contracts';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { User } from '../../generated/prisma/client';
import { toPublicUser } from '../users/user.presenter';
import { AUTH_SETTINGS, type AuthSettings, sessionCookieOptions } from './auth-settings';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './session-token';

const PUBLIC_USER_EXAMPLE = {
  id: '2f0c…',
  email: 'jogadora@example.com',
  displayName: 'Jogadora',
  role: 'USER',
  discoveryMode: 'BALANCED',
  onboardingCompletedAt: null,
  createdAt: '2026-10-27T12:00:00.000Z',
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({
    schema: {
      example: { email: 'jogadora@example.com', displayName: 'Jogadora', password: 'senha-forte' },
    },
  })
  @ApiCreatedResponse({
    description: 'Conta criada e sessão aberta (cookie sid); a senha nunca volta na resposta',
    schema: { example: PUBLIC_USER_EXAMPLE },
  })
  @ApiBadRequestResponse({ description: 'E-mail inválido, nome vazio ou senha fora de 8 a 128' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  async register(
    @Body({ schema: RegisterSchema }) body: RegisterInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, token } = await this.auth.register(body);
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions(this.settings));
    return user;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ schema: { example: { email: 'jogadora@example.com', password: 'senha-forte' } } })
  @ApiOkResponse({
    description: 'Sessão aberta (cookie sid)',
    schema: { example: PUBLIC_USER_EXAMPLE },
  })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha incorretos, sem dizer qual' })
  async login(
    @Body({ schema: LoginSchema }) body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, token } = await this.auth.login(body);
    response.cookie(SESSION_COOKIE, token, sessionCookieOptions(this.settings));
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth()
  @ApiNoContentResponse({ description: 'Sessão encerrada no servidor e cookie apagado' })
  @ApiUnauthorizedResponse({ description: 'Sem sessão válida' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(String(request.cookies[SESSION_COOKIE]));
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.settings));
  }

  @Get('me')
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Usuário da sessão', schema: { example: PUBLIC_USER_EXAMPLE } })
  @ApiUnauthorizedResponse({ description: 'Sem sessão válida' })
  me(@CurrentUser() user: User) {
    return toPublicUser(user);
  }
}
