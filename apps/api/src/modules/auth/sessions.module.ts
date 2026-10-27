import { Module } from '@nestjs/common';
import { SessionsRepository } from './sessions.repository';

// Separado do AuthModule para a ingestão limpar as sessões expiradas sem carregar rotas e guard.
@Module({
  providers: [SessionsRepository],
  exports: [SessionsRepository],
})
export class SessionsModule {}
