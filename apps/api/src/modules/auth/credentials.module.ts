import { Module } from '@nestjs/common';
import { AccountTokensRepository } from './account-tokens.repository';
import { SessionsRepository } from './sessions.repository';

// Separado do AuthModule para a ingestão limpar sessões e tokens vencidos sem carregar rotas e guard.
@Module({
  providers: [SessionsRepository, AccountTokensRepository],
  exports: [SessionsRepository, AccountTokensRepository],
})
export class CredentialsModule {}
