import { validateIngestionEnv } from './ingestion-env';

const validEnv = {
  DATABASE_URL: 'postgresql://indie:indie@localhost:5432/indie?schema=public',
  IGDB_CLIENT_ID: 'client-id',
  IGDB_CLIENT_SECRET: 'client-secret',
};

describe('validateIngestionEnv', () => {
  it('aceita as credenciais da IGDB e a URL do banco', () => {
    expect(validateIngestionEnv(validEnv)).toEqual({ ...validEnv, NODE_ENV: 'development' });
  });

  it.each(['DATABASE_URL', 'IGDB_CLIENT_ID', 'IGDB_CLIENT_SECRET'])(
    'informa qual variável obrigatória falta: %s',
    (name) => {
      const env: Record<string, string> = { ...validEnv };
      delete env[name];

      expect(() => validateIngestionEnv(env)).toThrow(name);
    },
  );

  it('rejeita credenciais vazias, como as do .env.example', () => {
    expect(() => validateIngestionEnv({ ...validEnv, IGDB_CLIENT_ID: '' })).toThrow(
      'IGDB_CLIENT_ID',
    );
  });

  it('não exige as variáveis que só a API usa', () => {
    expect(validateIngestionEnv(validEnv)).not.toHaveProperty('WEB_ORIGIN');
  });
});
