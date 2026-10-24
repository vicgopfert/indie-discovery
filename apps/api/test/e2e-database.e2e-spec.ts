import { assertE2eDatabase, e2eDatabaseUrl } from './support/e2e-database';

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

  it('está apontado para o banco de teste nesta execução', () => {
    expect(() => assertE2eDatabase(process.env.DATABASE_URL)).not.toThrow();
  });
});
