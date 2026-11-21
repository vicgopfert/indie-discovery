import type { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../../config/env';
import { ConsoleMailer } from './console-mailer';
import { DisabledMailer } from './disabled-mailer';
import { createMailer } from './mail.module';
import { SkipReservedDomains } from './reserved-domains';

const envWith = (values: Partial<ApiEnv>) =>
  ({ get: (name: keyof ApiEnv) => values[name] }) as ConfigService<ApiEnv, true>;

describe('createMailer', () => {
  it.each([
    ['console', ConsoleMailer],
    ['off', DisabledMailer],
    ['resend', SkipReservedDomains],
  ] as const)('MAIL_TRANSPORT=%s escolhe o envio correspondente', (transport, mailerClass) => {
    const env = envWith({
      MAIL_TRANSPORT: transport,
      RESEND_API_KEY: 're_teste',
      MAIL_FROM: 'Penumbra <nao-responda@example.com>',
    });

    expect(createMailer(env)).toBeInstanceOf(mailerClass);
  });
});
