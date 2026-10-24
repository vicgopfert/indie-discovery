import { Client } from 'pg';
import { assertE2eDatabase, e2eDatabaseUrl } from './support/e2e-database';
import globalSetup from './support/e2e-global-setup';

jest.mock('pg', () => ({ Client: jest.fn() }));

const REMOTE = 'postgresql://user:secret@ep-exemplo.us-east-1.aws.neon.tech/neondb?sslmode=require';

describe('Banco dos testes e2e', () => {
  it('deriva o banco de teste do DATABASE_URL, mantendo os parâmetros', () => {
    const url = e2eDatabaseUrl({
      DATABASE_URL: 'postgresql://indie:indie@localhost:5432/indie?schema=public',
    });

    expect(url).toBe('postgresql://indie:indie@localhost:5432/indie_e2e?schema=public');
  });

  it('usa o E2E_DATABASE_URL quando definido', () => {
    expect(
      e2eDatabaseUrl({
        DATABASE_URL: 'postgresql://localhost/indie',
        E2E_DATABASE_URL: 'postgresql://localhost/outro_e2e',
      }),
    ).toBe('postgresql://localhost/outro_e2e');
  });

  it('recusa rodar fora de um banco de teste', () => {
    expect(() => assertE2eDatabase('postgresql://localhost/indie')).toThrow('_e2e');
    expect(() => assertE2eDatabase(undefined)).toThrow('_e2e');
    expect(() => assertE2eDatabase('postgresql://localhost/indie_e2e')).not.toThrow();
  });

  it('recusa host remoto, a menos que liberado em E2E_ALLOWED_HOST', () => {
    const remoteE2e = 'postgresql://user:secret@ep-exemplo.us-east-1.aws.neon.tech/neondb_e2e';

    expect(() => assertE2eDatabase(remoteE2e)).toThrow('E2E_ALLOWED_HOST');
    expect(() => assertE2eDatabase(remoteE2e, 'ep-exemplo.us-east-1.aws.neon.tech')).not.toThrow();
    expect(() => assertE2eDatabase('postgresql://127.0.0.1:5433/indie_e2e')).not.toThrow();
  });

  it('o setup para antes de criar qualquer banco quando o DATABASE_URL é remoto', async () => {
    const saved = { ...process.env };
    process.env.DATABASE_URL = REMOTE;
    delete process.env.E2E_DATABASE_URL;
    delete process.env.E2E_ALLOWED_HOST;
    try {
      await expect(globalSetup()).rejects.toThrow('banco local');
      expect(Client).not.toHaveBeenCalled();
    } finally {
      process.env = saved;
    }
  });

  it('está apontado para o banco de teste nesta execução', () => {
    expect(() => assertE2eDatabase(process.env.DATABASE_URL)).not.toThrow();
  });
});
