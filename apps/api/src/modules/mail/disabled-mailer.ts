import { Logger } from '@nestjs/common';
import type { Email, Mailer } from './mailer';

// Envio desligado: o log diz só que nada saiu, sem o destinatário e sem o conteúdo, que pode
// levar um link de redefinição.
export class DisabledMailer implements Mailer {
  private readonly logger = new Logger('Mail');

  send({ subject }: Email) {
    this.logger.warn(`Envio de e-mail desligado; "${subject}" não foi enviado`);
    return Promise.resolve();
  }
}
