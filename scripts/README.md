# scripts

Utilitários em Node puro, sem build, que rodam fora dos pacotes do monorrepositório. O
`db.mjs` usa duas dependências de desenvolvimento da raiz (`embedded-postgres` e `pg`);
o spike da IGDB não tem dependências.

| Script | Item | O que faz |
| --- | --- | --- |
| `db.mjs` | B-04 | Sobe, desliga e informa o estado do PostgreSQL local embutido; chamado por `pnpm db:start`, `db:stop` e `db:status` |
| `igdb-spike.mjs` | B-07 (M0) | Percorre todos os jogos indie da IGDB, mede a cobertura dos campos e o tamanho de recortes candidatos e gera o relatório do M0 e as fixtures dos testes do B-10 |

```bash
node scripts/igdb-spike.mjs                      # censo completo (alguns minutos)
node scripts/igdb-spike.mjs --max 1000           # só os primeiros 1000 jogos, para testar
node scripts/igdb-spike.mjs --primitives 5000    # amostra maior para o PopScore
```

Credenciais: crie uma aplicação em https://dev.twitch.tv/console/apps (a conta
Twitch precisa de autenticação em dois fatores ativa) e preencha
`IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` no `.env`.

Saída: `docs/m0-relatorio-igdb.md` (sobrescrito a cada execução) e as fixtures
em `apps/api/test/fixtures/igdb/`, versionadas para os testes do B-10 e do B-11.
