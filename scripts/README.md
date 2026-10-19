# scripts

Utilitários que rodam fora do monorrepositório, sem dependências e sem build.

| Script | Item | O que faz |
| --- | --- | --- |
| `igdb-spike.mjs` | B-07 (M0) | Mede a cobertura dos campos da IGDB, estima o tamanho do catálogo e gera as fixtures usadas nos testes do B-10 |

```bash
node scripts/igdb-spike.mjs                 # amostra de 3000 jogos
node scripts/igdb-spike.mjs --max 8000      # amostra maior
```

Credenciais: crie uma aplicação em https://dev.twitch.tv/console/apps (a conta
Twitch precisa de autenticação em dois fatores ativa) e preencha
`IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` no `.env`.

A saída em `scripts/out/` é ignorada pelo Git. As fixtures aprovadas são movidas
à mão para `apps/api/test/fixtures/` quando o B-10 começar — é lá que elas
precisam estar versionadas.
