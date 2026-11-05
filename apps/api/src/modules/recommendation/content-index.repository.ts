import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ContentIndexRows } from './content-index';

// A transação da carga lê os 22 mil jogos com os resumos: cerca de 0,7 s no local, mas a carga
// inteira leva cerca de 13 s em produção, com 0,1 núcleo de CPU, e passou dos 5 s padrão do Prisma
// com a CPU limitada a 0,1 núcleo no local (B-76). 60 s dá folga de várias vezes a carga inteira de
// produção e ainda encerra uma transação presa.
export const LOAD_TRANSACTION_TIMEOUT_MS = 60_000;

@Injectable()
export class ContentIndexRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Cada jogo já vem com as posições dos seus atributos, em inteiros: devolver os vínculos como
  // pares de UUID criava cerca de 200 mil objetos e quase dobrava o RSS da API durante a carga.
  // As consultas usam a mesma ordem (tipo, igdbId), e a leitura é um só instantâneo: uma ingestão
  // gravando no meio não mistura IDF velho com vínculos novos. Para os estilos, cada jogo traz o
  // resumo e só as palavras-chave que pertencem a algum estilo, mesmo as fora do vetor, numa
  // consulta à parte: como subconsulta por jogo, ela custava 400 ms a mais na carga (B-74).
  async loadRows(styleKeywords: readonly string[]): Promise<ContentIndexRows> {
    const [features, games, styleLinks] = await this.prisma.$transaction(
      [
        this.prisma.$queryRaw<ContentIndexRows['features']>`
          SELECT "id", "type", "igdbId", "slug", "name", "idf"
          FROM "Feature" WHERE "idf" > 0
          ORDER BY "type", "igdbId"`,
        this.prisma.$queryRaw<Omit<ContentIndexRows['games'][number], 'styleKeywords'>[]>`
          WITH f AS (
            SELECT "id", (row_number() OVER (ORDER BY "type", "igdbId") - 1)::int AS "position"
            FROM "Feature" WHERE "idf" > 0
          )
          SELECT g."id", g."slug", g."releaseStatus", g."popularityNorm", g."summary",
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
        this.prisma.$queryRaw<{ gameId: string; slug: string }[]>`
          SELECT gf."gameId", f."slug"
          FROM "GameFeature" gf
          JOIN "Feature" f ON f."id" = gf."featureId"
          WHERE f."type" = 'KEYWORD' AND f."slug" = ANY(${[...styleKeywords]}::text[])`,
      ],
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: LOAD_TRANSACTION_TIMEOUT_MS,
      },
    );

    const styleKeywordsByGame = new Map<string, string[]>();
    for (const { gameId, slug } of styleLinks) {
      const slugs = styleKeywordsByGame.get(gameId) ?? [];
      slugs.push(slug);
      styleKeywordsByGame.set(gameId, slugs);
    }
    return {
      features,
      games: games.map((game) => ({
        ...game,
        styleKeywords: styleKeywordsByGame.get(game.id) ?? [],
      })),
    };
  }
}
