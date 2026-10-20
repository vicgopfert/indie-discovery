import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { seedReferenceData } from '../prisma/seed/reference-data';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Seed de países e idiomas', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('popula as tabelas e não duplica ao rodar de novo', async () => {
    const first = await seedReferenceData(prisma);
    await seedReferenceData(prisma);

    expect(await prisma.country.count()).toBe(first.countries);
    expect(await prisma.language.count()).toBe(first.languages);
  });

  it('atualiza registros existentes com os dados versionados', async () => {
    await prisma.country.update({ where: { code: 76 }, data: { namePt: 'Nome antigo' } });

    await seedReferenceData(prisma);

    const brazil = await prisma.country.findUniqueOrThrow({ where: { code: 76 } });
    expect(brazil.namePt).toBe('Brasil');
  });

  it('usa os códigos que a IGDB devolve', async () => {
    const brazil = await prisma.country.findUniqueOrThrow({ where: { code: 76 } });
    const portugueseBr = await prisma.language.findUniqueOrThrow({ where: { igdbId: 21 } });

    expect(brazil).toEqual({ code: 76, alpha2: 'BR', namePt: 'Brasil' });
    expect(portugueseBr).toMatchObject({ locale: 'pt-BR', namePt: 'Português (Brasil)' });
  });
});
