import { validateApiEnv } from './env';

const validEnv = {
  DATABASE_URL: 'postgresql://indie:indie@localhost:5432/indie?schema=public',
  WEB_ORIGIN: 'http://localhost:3000',
  INTERNAL_RELOAD_SECRET: 'a'.repeat(32),
};

describe('validateApiEnv', () => {
  it('aplica os valores padrão das variáveis opcionais', () => {
    expect(validateApiEnv(validEnv)).toEqual({
      ...validEnv,
      NODE_ENV: 'development',
      PORT: 3001,
      SESSION_TTL_DAYS: 7,
      TRUST_PROXY_HOPS: 0,
      MAIL_TRANSPORT: 'console',
    });
  });

  it('converte os números lidos como texto', () => {
    const env = validateApiEnv({
      ...validEnv,
      PORT: '8080',
      SESSION_TTL_DAYS: '14',
      TRUST_PROXY_HOPS: '4',
    });

    expect(env.PORT).toBe(8080);
    expect(env.SESSION_TTL_DAYS).toBe(14);
    expect(env.TRUST_PROXY_HOPS).toBe(4);
  });

  it.each(['DATABASE_URL', 'WEB_ORIGIN', 'INTERNAL_RELOAD_SECRET'])(
    'informa qual variável obrigatória falta: %s',
    (name) => {
      const env: Record<string, string> = { ...validEnv };
      delete env[name];

      expect(() => validateApiEnv(env)).toThrow(name);
    },
  );

  it.each([
    ['DATABASE_URL', 'mysql://localhost:3306/indie'],
    ['WEB_ORIGIN', 'localhost:3000'],
    ['INTERNAL_RELOAD_SECRET', 'curto'],
    ['PORT', 'abc'],
    ['TRUST_PROXY_HOPS', '-1'],
    ['NODE_ENV', 'staging'],
    ['MAIL_TRANSPORT', 'smtp'],
  ])('rejeita %s inválida', (name, value) => {
    expect(() => validateApiEnv({ ...validEnv, [name]: value })).toThrow(name);
  });

  describe('envio de e-mail', () => {
    it('recusa o console em produção, que levaria os links ao log', () => {
      expect(() => validateApiEnv({ ...validEnv, NODE_ENV: 'production' })).toThrow(
        'MAIL_TRANSPORT',
      );
    });

    it('aceita o envio desligado em produção', () => {
      const env = validateApiEnv({ ...validEnv, NODE_ENV: 'production', MAIL_TRANSPORT: 'off' });

      expect(env.MAIL_TRANSPORT).toBe('off');
    });

    it.each(['RESEND_API_KEY', 'MAIL_FROM'])('exige %s com o Resend', (name) => {
      const env: Record<string, string> = {
        ...validEnv,
        MAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 're_teste',
        MAIL_FROM: 'Penumbra <nao-responda@example.com>',
      };
      delete env[name];

      expect(() => validateApiEnv(env)).toThrow(name);
    });
  });

  it('ignora variáveis que a API não usa, como as da IGDB', () => {
    expect(validateApiEnv({ ...validEnv, IGDB_CLIENT_ID: '' })).not.toHaveProperty(
      'IGDB_CLIENT_ID',
    );
  });
});
