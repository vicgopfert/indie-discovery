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
  UseGuards,
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
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type LoginInput, LoginSchema, type RegisterInput, RegisterSchema } from '@indie/contracts';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { User } from '../../generated/prisma/client';
import { toPublicUser } from '../users/user.presenter';
import { AUTH_SETTINGS, type AuthSettings, sessionCookieOptions } from './auth-settings';
import {
  ACCOUNT_LOGIN_LIMIT,
  ACCOUNT_THROTTLER,
  IP_THROTTLER,
  LOGIN_LIMIT,
  REGISTER_LIMIT,
} from './auth-throttle';
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ [IP_THROTTLER]: REGISTER_LIMIT })
  @SkipThrottle({ [ACCOUNT_THROTTLER]: true })
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
  @ApiTooManyRequestsResponse({ description: 'Mais de 5 cadastros por hora vindos do mesmo IP' })
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ [IP_THROTTLER]: LOGIN_LIMIT, [ACCOUNT_THROTTLER]: ACCOUNT_LOGIN_LIMIT })
  @HttpCode(HttpStatus.OK)
  @ApiBody({ schema: { example: { email: 'jogadora@example.com', password: 'senha-forte' } } })
  @ApiOkResponse({
    description: 'Sessão aberta (cookie sid)',
    schema: { example: PUBLIC_USER_EXAMPLE },
  })
  @ApiUnauthorizedResponse({ description: 'E-mail ou senha incorretos, sem dizer qual' })
  @ApiTooManyRequestsResponse({
    description: 'Mais de 5 tentativas por minuto do mesmo IP ou 10 em 15 minutos na mesma conta',
  })
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
