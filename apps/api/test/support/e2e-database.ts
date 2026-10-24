// Os e2e truncam tabelas: rodam num banco próprio, nunca no de desenvolvimento.
export const E2E_DATABASE_SUFFIX = '_e2e';

// E2E_DATABASE_URL, quando definida; senão, o DATABASE_URL com o nome do banco + "_e2e".
export function e2eDatabaseUrl(env: NodeJS.ProcessEnv) {
  if (env.E2E_DATABASE_URL) return env.E2E_DATABASE_URL;
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL não definida para os testes e2e.');
  const url = new URL(env.DATABASE_URL);
  url.pathname = `/${databaseName(env.DATABASE_URL)}${E2E_DATABASE_SUFFIX}`;
  return url.toString();
}

export function assertE2eDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl || !databaseName(databaseUrl).endsWith(E2E_DATABASE_SUFFIX)) {
    throw new Error(
      `Os testes e2e só rodam num banco terminado em "${E2E_DATABASE_SUFFIX}"; ` +
        `DATABASE_URL aponta para "${databaseUrl ? databaseName(databaseUrl) : 'nenhum'}".`,
    );
  }
}

export function databaseName(databaseUrl: string) {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}
