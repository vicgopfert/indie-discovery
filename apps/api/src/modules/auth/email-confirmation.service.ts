import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type EmailConfirmationInput, INVALID_CONFIRMATION_LINK_MESSAGE } from '@indie/contracts';
import { BackgroundTasks } from '../../common/background-tasks';
import { AccountTokenPurpose, type User } from '../../generated/prisma/client';
import { type Email, MAILER, type Mailer } from '../mail/mailer';
import { UsersRepository } from '../users/users.repository';
import { AccountTokensRepository } from './account-tokens.repository';
import {
  EMAIL_CONFIRMATION_TTL_DAYS,
  emailConfirmationEmail,
  emailConfirmationLink,
} from './account-emails';
import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { hashSecretToken, newSecretToken } from './secret-token';

const DAY_MS = 86_400_000;

type ComposeEmail = (to: string, link: string) => Email;

@Injectable()
export class EmailConfirmationService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: AccountTokensRepository,
    private readonly tasks: BackgroundTasks,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  // Cadastro e reenvio: o envio roda depois da resposta. Conta já confirmada não recebe nada.
  request(user: User, now = new Date()) {
    if (user.emailConfirmedAt) return;
    this.tasks.run('confirmação de e-mail', () => this.sendLink(user, emailConfirmationEmail, now));
  }

  // Um link novo substitui o anterior, pela restrição única por usuário e finalidade.
  async sendLink(user: User, compose: ComposeEmail, now = new Date()) {
    const token = newSecretToken();
    await this.tokens.replace(
      user.id,
      AccountTokenPurpose.EMAIL_CONFIRMATION,
      hashSecretToken(token),
      new Date(now.getTime() + EMAIL_CONFIRMATION_TTL_DAYS * DAY_MS),
    );
    await this.mailer.send(
      compose(user.email, emailConfirmationLink(this.settings.webOrigin, token)),
    );
  }

  async confirm({ token }: EmailConfirmationInput, now = new Date()) {
    const found = await this.tokens.findValid(
      hashSecretToken(token),
      AccountTokenPurpose.EMAIL_CONFIRMATION,
      now,
    );
    const confirmed = found && (await this.users.confirmEmail(found.user.id, found.id, now));
    if (!confirmed) throw new BadRequestException(INVALID_CONFIRMATION_LINK_MESSAGE);
  }
}
