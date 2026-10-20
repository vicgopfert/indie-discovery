import { apiEnvSchema } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedReferenceData } from './seed/reference-data';

async function main() {
  const { DATABASE_URL } = apiEnvSchema.pick({ DATABASE_URL: true }).parse(process.env);
  const prisma = new PrismaService(DATABASE_URL);
  try {
    const seeded = await seedReferenceData(prisma);
    console.log(`Seed concluído: ${seeded.countries} países e ${seeded.languages} idiomas.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
