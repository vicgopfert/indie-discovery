import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ContentIndexRows } from './content-index';

@Injectable()
export class ContentIndexRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Cada jogo já vem com as posições dos seus atributos, em inteiros: devolver os vínculos como
  // pares de UUID criava cerca de 200 mil objetos e quase dobrava o RSS da API durante a carga.
  // As duas consultas usam a mesma ordem (tipo, igdbId), e a leitura é um só instantâneo: uma
  // ingestão gravando no meio não mistura IDF velho com vínculos novos.
  async loadRows(): Promise<ContentIndexRows> {
    const [features, games] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<ContentIndexRows['features']>`
          SELECT "type", "igdbId", "slug", "name", "idf"
          FROM "Feature" WHERE "idf" > 0
          ORDER BY "type", "igdbId"`,
        this.prisma.$queryRaw<ContentIndexRows['games']>`
          WITH f AS (
            SELECT "id", (row_number() OVER (ORDER BY "type", "igdbId") - 1)::int AS "position"
            FROM "Feature" WHERE "idf" > 0
          )
          SELECT g."id", g."slug", g."releaseStatus", g."popularityNorm",
            coalesce(
              array_agg(f."position" ORDER BY f."position") FILTER (WHERE f."position" IS NOT NULL),
              '{}'
            ) AS "featurePositions"
          FROM "Game" g
          LEFT JOIN "GameFeature" gf ON gf."gameId" = g."id"
          LEFT JOIN f ON f."id" = gf."featureId"
          WHERE g."inCatalog"
          GROUP BY g."id"
          ORDER BY g."id"`,
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { features, games };
  }
}
