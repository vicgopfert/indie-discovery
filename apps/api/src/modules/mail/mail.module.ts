import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../../config/env';
import { ConsoleMailer } from './console-mailer';
import { DisabledMailer } from './disabled-mailer';
import { MAILER, type Mailer } from './mailer';
import { ResendMailer } from './resend-mailer';
import { SkipReservedDomains } from './reserved-domains';

export function createMailer(env: ConfigService<ApiEnv, true>): Mailer {
  switch (env.get('MAIL_TRANSPORT', { infer: true })) {
    case 'console':
      return new ConsoleMailer();
    case 'off':
      return new DisabledMailer();
    // Só no Resend: no console, os links das contas de teste locais continuam aparecendo.
    case 'resend':
      return new SkipReservedDomains(
        new ResendMailer({
          apiKey: env.get('RESEND_API_KEY', { infer: true }),
          from: env.get('MAIL_FROM', { infer: true }),
        }),
      );
  }
}

@Module({
  providers: [{ provide: MAILER, inject: [ConfigService], useFactory: createMailer }],
  exports: [MAILER],
})
export class MailModule {}
