import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiNoContentResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  type PasswordResetConfirmInput,
  PasswordResetConfirmSchema,
  type PasswordResetRequestInput,
  PasswordResetRequestSchema,
} from '@indie/contracts';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import {
  AUTH_SETTINGS,
  type AuthSettings,
  SESSION_COOKIE,
  sessionCookieOptions,
} from './auth-settings';
import {
  ACCOUNT_RESET_REQUEST_LIMIT,
  ACCOUNT_THROTTLER,
  IP_THROTTLER,
  RESET_CONFIRM_LIMIT,
  RESET_REQUEST_LIMIT,
} from './auth-throttle';
import { PasswordResetService } from './password-reset.service';

@ApiTags('auth')
@Controller('auth/password-reset')
@Public()
@UseGuards(ThrottlerGuard)
export class PasswordResetController {
  constructor(
    private readonly passwordReset: PasswordResetService,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  @Post('request')
  @Throttle({
    [IP_THROTTLER]: RESET_REQUEST_LIMIT,
    [ACCOUNT_THROTTLER]: ACCOUNT_RESET_REQUEST_LIMIT,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ schema: { example: { email: 'jogadora@example.com' } } })
  @ApiAcceptedResponse({
    description:
      'Sempre a mesma resposta, sem corpo, exista a conta ou não. Se existir, recebe por e-mail ' +
      'um link que vale 60 minutos; um pedido novo invalida o anterior',
  })
  @ApiBadRequestResponse({ description: 'E-mail inválido' })
  @ApiTooManyRequestsResponse({
    description: 'Mais de 5 pedidos por hora do mesmo IP ou 3 por hora para o mesmo e-mail',
  })
  request(@Body({ schema: PasswordResetRequestSchema }) { email }: PasswordResetRequestInput) {
    this.passwordReset.request(email);
  }

  @Post('confirm')
  @Throttle({ [IP_THROTTLER]: RESET_CONFIRM_LIMIT })
  @SkipThrottle({ [ACCOUNT_THROTTLER]: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({
    schema: { example: { token: 'o token do link, depois do #', password: 'senha-nova-forte' } },
  })
  @ApiNoContentResponse({
    description:
      'Senha trocada; todas as sessões da conta encerradas, sem abrir uma nova, e aviso enviado ' +
      'por e-mail',
  })
  @ApiBadRequestResponse({
    description:
      'Link inexistente, vencido ou já usado, todos com a mesma mensagem, ou senha fora de 8 a 128',
  })
  @ApiTooManyRequestsResponse({ description: 'Mais de 5 tentativas por minuto do mesmo IP' })
  async confirm(
    @Body({ schema: PasswordResetConfirmSchema }) body: PasswordResetConfirmInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.passwordReset.confirm(body);
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.settings));
  }
}
