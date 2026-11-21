import { Logger } from '@nestjs/common';
import type { Email, Mailer } from './mailer';

// Domínios reservados a exemplos e testes (RFC 2606 e 6761), inclusive os subdomínios. Ninguém
// recebe e-mail neles, e o envio voltaria, prejudicando a reputação do domínio de envio.
const RESERVED_DOMAIN =
  /(^|\.)(example\.com|example\.net|example\.org|example|test|invalid|localhost)$/i;

export function isReservedAddress(address: string) {
  return RESERVED_DOMAIN.test(address.slice(address.lastIndexOf('@') + 1));
}

// As contas de teste em produção usam @example.com. O log diz só que nada saiu, sem o destinatário.
export class SkipReservedDomains implements Mailer {
  private readonly logger = new Logger('Mail');

  constructor(private readonly inner: Mailer) {}

  send(email: Email) {
    if (!isReservedAddress(email.to)) return this.inner.send(email);
    this.logger.warn(`Endereço de domínio reservado a testes; "${email.subject}" não foi enviado`);
    return Promise.resolve();
  }
}
