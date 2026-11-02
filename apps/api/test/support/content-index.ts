import type { INestApplication } from '@nestjs/common';
import { ContentIndexService } from '../../src/modules/recommendation/content-index.service';

// A carga do índice começa no init e lê Feature, Game e GameFeature numa transação: um TRUNCATE
// dessas tabelas durante a carga trava as duas (deadlock). Quem limpa o catálogo espera antes.
export function contentIndexLoaded(app: INestApplication) {
  return app.get(ContentIndexService).settled();
}
