import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { INVALID_RESET_LINK_MESSAGE, type PasswordResetConfirmInput } from '@indie/contracts';
import { BackgroundTasks } from '../../common/background-tasks';
import { AccountTokenPurpose } from '../../generated/prisma/client';
import { MAILER, type Mailer } from '../mail/mailer';
import { UsersRepository } from '../users/users.repository';
import { AccountTokensRepository } from './account-tokens.repository';
import {
  confirmBeforeResetEmail,
  PASSWORD_RESET_TTL_MINUTES,
  passwordResetEmail,
  passwordResetLink,
} from './account-emails';
import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { EmailConfirmationService } from './email-confirmation.service';
import { PasswordChanger } from './password-changer';
import { hashSecretToken, newSecretToken } from './secret-token';

const MINUTE_MS = 60_000;

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly users: UsersRepository,
    private readonly tokens: AccountTokensRepository,
    private readonly passwordChanger: PasswordChanger,
    private readonly emailConfirmation: EmailConfirmationService,
    private readonly tasks: BackgroundTasks,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  // A busca da conta e o envio ficam para depois da resposta: o tempo de resposta é o mesmo
  // exista a conta ou não.
  request(email: string, now = new Date()) {
    this.tasks.run('pedido de redefinição de senha', () => this.sendResetLink(email, now));
  }

  async confirm({ token, password }: PasswordResetConfirmInput, now = new Date()) {
    const found = await this.tokens.findValid(
      hashSecretToken(token),
      AccountTokenPurpose.PASSWORD_RESET,
      now,
    );
    const changed =
      found && (await this.passwordChanger.change(found.user, password, found.id, now));
    if (!changed) throw new BadRequestException(INVALID_RESET_LINK_MESSAGE);
  }

  private async sendResetLink(email: string, now: Date) {
    const user = await this.users.findByEmail(email);
    if (!user) return;
    if (!user.emailConfirmedAt) {
      await this.emailConfirmation.sendLink(user, confirmBeforeResetEmail, now);
      return;
    }
    const token = newSecretToken();
    await this.tokens.replace(
      user.id,
      AccountTokenPurpose.PASSWORD_RESET,
      hashSecretToken(token),
      new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * MINUTE_MS),
    );
    await this.mailer.send(
      passwordResetEmail(user.email, passwordResetLink(this.settings.webOrigin, token)),
    );
  }
}
