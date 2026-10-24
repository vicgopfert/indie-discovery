// Os e2e truncam tabelas: rodam num banco próprio e local, nunca no de desenvolvimento nem num
// banco remoto (o .env pode apontar para o Neon de produção).
export const E2E_DATABASE_SUFFIX = '_e2e';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// E2E_DATABASE_URL, quando definida; senão, o DATABASE_URL com o nome do banco + "_e2e".
export function e2eDatabaseUrl(env: NodeJS.ProcessEnv) {
  if (env.E2E_DATABASE_URL) return env.E2E_DATABASE_URL;
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL não definida para os testes e2e.');
  const url = new URL(env.DATABASE_URL);
  url.pathname = `/${databaseName(env.DATABASE_URL)}${E2E_DATABASE_SUFFIX}`;
  return url.toString();
}

// Um host fora de localhost só é aceito quando liberado por E2E_ALLOWED_HOST (para a CI).
export function assertE2eDatabase(databaseUrl: string | undefined, allowedHost?: string) {
  if (!databaseUrl || !databaseName(databaseUrl).endsWith(E2E_DATABASE_SUFFIX)) {
    throw new Error(
      `Os testes e2e só rodam num banco terminado em "${E2E_DATABASE_SUFFIX}"; ` +
        `DATABASE_URL aponta para "${databaseUrl ? databaseName(databaseUrl) : 'nenhum'}".`,
    );
  }
  const { hostname } = new URL(databaseUrl);
  if (!LOCAL_HOSTS.has(hostname) && hostname !== allowedHost) {
    throw new Error(
      `Os testes e2e só rodam em banco local; o host "${hostname}" não é localhost ` +
        `nem está liberado em E2E_ALLOWED_HOST.`,
    );
  }
}

export function databaseName(databaseUrl: string) {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}
