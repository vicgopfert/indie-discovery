import type { PrismaClient } from '../../src/generated/prisma/client';
import countries from './countries.json';
import languages from './languages.json';

// Um comando por tabela: upserts linha a linha estouram o tempo da transação no banco remoto.
export async function seedReferenceData(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO "Country" ("code", "alpha2", "namePt")
      SELECT * FROM unnest(
        ${countries.map((c) => c.code)}::int[],
        ${countries.map((c) => c.alpha2)}::text[],
        ${countries.map((c) => c.namePt)}::text[]
      )
      ON CONFLICT ("code") DO UPDATE
      SET "alpha2" = EXCLUDED."alpha2", "namePt" = EXCLUDED."namePt"`,
    prisma.$executeRaw`
      INSERT INTO "Language" ("id", "igdbId", "locale", "namePt")
      SELECT gen_random_uuid(), * FROM unnest(
        ${languages.map((l) => l.igdbId)}::int[],
        ${languages.map((l) => l.locale)}::text[],
        ${languages.map((l) => l.namePt)}::text[]
      )
      ON CONFLICT ("igdbId") DO UPDATE
      SET "locale" = EXCLUDED."locale", "namePt" = EXCLUDED."namePt"`,
  ]);
  return { countries: countries.length, languages: languages.length };
}
