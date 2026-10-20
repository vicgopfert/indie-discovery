import type { PrismaClient } from '../../src/generated/prisma/client';
import countries from './countries.json';
import languages from './languages.json';

export async function seedReferenceData(prisma: PrismaClient) {
  await prisma.$transaction([
    ...countries.map(({ code, ...data }) =>
      prisma.country.upsert({ where: { code }, create: { code, ...data }, update: data }),
    ),
    ...languages.map(({ igdbId, ...data }) =>
      prisma.language.upsert({ where: { igdbId }, create: { igdbId, ...data }, update: data }),
    ),
  ]);
  return { countries: countries.length, languages: languages.length };
}
