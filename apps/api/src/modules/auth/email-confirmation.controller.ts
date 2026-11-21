import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type EmailConfirmationInput, EmailConfirmationSchema } from '@indie/contracts';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { User } from '../../generated/prisma/client';
import {
  ACCOUNT_CONFIRMATION_REQUEST_LIMIT,
  ACCOUNT_THROTTLER,
  CONFIRMATION_CONFIRM_LIMIT,
  CONFIRMATION_REQUEST_LIMIT,
  IP_THROTTLER,
} from './auth-throttle';
import { EmailConfirmationService } from './email-confirmation.service';

@ApiTags('auth')
@Controller('auth/email-confirmation')
@UseGuards(ThrottlerGuard)
export class EmailConfirmationController {
  constructor(private readonly emailConfirmation: EmailConfirmationService) {}

  @Post('request')
  @Throttle({
    [IP_THROTTLER]: CONFIRMATION_REQUEST_LIMIT,
    [ACCOUNT_THROTTLER]: ACCOUNT_CONFIRMATION_REQUEST_LIMIT,
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiCookieAuth()
  @ApiAcceptedResponse({
    description:
      'Sem corpo. Envia ao e-mail da conta da sessão um link de confirmação que vale 7 dias e ' +
      'invalida o anterior; se o e-mail já estiver confirmado, não envia nada',
  })
  @ApiUnauthorizedResponse({ description: 'Sem sessão válida' })
  @ApiForbiddenResponse({ description: 'Origem da requisição diferente do frontend' })
  @ApiTooManyRequestsResponse({
    description: 'Mais de 5 pedidos por hora do mesmo IP ou 3 por hora na mesma conta',
  })
  request(@CurrentUser() user: User) {
    this.emailConfirmation.request(user);
  }

  @Public()
  @Post('confirm')
  @Throttle({ [IP_THROTTLER]: CONFIRMATION_CONFIRM_LIMIT })
  @SkipThrottle({ [ACCOUNT_THROTTLER]: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBody({ schema: { example: { token: 'o token do link, depois do #' } } })
  @ApiNoContentResponse({
    description: 'E-mail confirmado, sem exigir sessão; a data da confirmação fica na conta',
  })
  @ApiBadRequestResponse({
    description: 'Link inexistente, vencido ou já usado, todos com a mesma mensagem',
  })
  @ApiForbiddenResponse({ description: 'Origem da requisição diferente do frontend' })
  @ApiTooManyRequestsResponse({ description: 'Mais de 5 tentativas por minuto do mesmo IP' })
  confirm(@Body({ schema: EmailConfirmationSchema }) body: EmailConfirmationInput) {
    return this.emailConfirmation.confirm(body);
  }
}
