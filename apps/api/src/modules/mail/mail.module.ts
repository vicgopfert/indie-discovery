import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ApiEnv } from '../../config/env';
import { ConsoleMailer } from './console-mailer';
import { DisabledMailer } from './disabled-mailer';
import { MAILER, type Mailer } from './mailer';
import { ResendMailer } from './resend-mailer';

export function createMailer(env: ConfigService<ApiEnv, true>): Mailer {
  switch (env.get('MAIL_TRANSPORT', { infer: true })) {
    case 'console':
      return new ConsoleMailer();
    case 'off':
      return new DisabledMailer();
    case 'resend':
      return new ResendMailer({
        apiKey: env.get('RESEND_API_KEY', { infer: true }),
        from: env.get('MAIL_FROM', { infer: true }),
      });
  }
}

@Module({
  providers: [{ provide: MAILER, inject: [ConfigService], useFactory: createMailer }],
  exports: [MAILER],
})
export class MailModule {}
