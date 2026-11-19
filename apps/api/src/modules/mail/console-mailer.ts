import { Logger } from '@nestjs/common';
import type { Email, Mailer } from './mailer';

// Desenvolvimento: o e-mail inteiro, com o link, aparece no terminal da API.
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger('Mail');

  send({ to, subject, text }: Email) {
    this.logger.log(`Para: ${to}\nAssunto: ${subject}\n\n${text}`);
    return Promise.resolve();
  }
}
