import { assertE2eDatabase } from './e2e-database';

// Roda antes de cada arquivo de teste: nenhum e2e chega a truncar fora do banco de teste.
assertE2eDatabase(process.env.DATABASE_URL);
