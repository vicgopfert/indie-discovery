# Plataforma Web de Descoberta de Jogos Independentes

Plataforma web que recomenda jogos de estúdios e desenvolvedores independentes
pela afinidade entre as características de cada jogo e as preferências de cada
pessoa, mostrando o motivo de cada indicação, deixando o usuário calibrar o peso
da popularidade, incluindo jogos ainda não lançados e permitindo explorar o
catálogo por país do estúdio e por coleções culturais curadas.

Trabalho de Conclusão de Curso — Tecnologia em Análise e Desenvolvimento de
Sistemas, UERJ.
Autor: Victor Gopfert Ferreira Figueiredo.
Orientadora: Adriana Aparicio Sicsú Ayres do Nascimento.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js (App Router), Tailwind CSS |
| API | NestJS 12, monólito modular |
| Banco | PostgreSQL via Prisma 7 |
| Contratos | Zod, compartilhados entre os dois lados |
| Monorrepositório | pnpm workspaces |
| Runtime | Node.js 24 LTS (≥ 24.9) |
| Banco local | PostgreSQL 18 embutido (`embedded-postgres`), sem Docker |

## Estrutura

```
apps/api/         NestJS: API REST e aplicação de ingestão
apps/web/         Next.js: interface
packages/contracts/  schemas Zod e tipos compartilhados
docs/             proposta técnica, pesquisas de campo e diagramas
scripts/          utilitários fora do monorrepositório (spike da IGDB)
```

## Como rodar localmente

> Em construção. Completado no item B-43 do backlog.

```bash
pnpm install
cp .env.example .env          # preencher as variáveis
pnpm db:start                 # PostgreSQL local (pnpm db:stop para desligar)
pnpm --filter @indie/api exec prisma migrate dev
pnpm dev
```

### Testes e CI

```bash
pnpm test        # unitários, sem banco
pnpm db:start    # os e2e precisam do banco local
pnpm test:e2e    # sobem a API inteira e usam o banco da DATABASE_URL
```

O CI (`.github/workflows/ci.yml`) roda em todo PR para a `main`: instalação,
lint, formatação, tipos, testes unitários, migrations num PostgreSQL 18 de
serviço, testes e2e contra esse banco e build. Um PR só entra com o CI verde.

## Decisões de configuração

**Formato de módulo da API: CommonJS, com Node.js 24** (item B-02, risco R-06).

O NestJS 12 é publicado só como ESM. Uma API em CommonJS carrega esses pacotes
pelo `require(esm)` do Node, o que funciona no build e na execução desde o Node
22. O Jest, porém, só consegue fazer o mesmo a partir do **Node 24.9** e com a
flag `--experimental-vm-modules`, que o script `pnpm test` da API já passa. No
Node 22 os testes não carregam o Nest, mesmo com a flag. A alternativa (ESM com
Vitest) ficou descartada por exigir mais configuração; o Node 22 também sai de
suporte em abril de 2027, perto da banca.

O cliente do Prisma 7 é gerado em `apps/api/src/generated/prisma` com
`moduleFormat = "cjs"` (fora do Git, gerado no `pnpm install`). O Jest mapeia
os imports `./arquivo.js` do código gerado para os `.ts` correspondentes.

### Banco de dados local

O PostgreSQL 18 vem como dependência do projeto (pacote `embedded-postgres`, com
os binários oficiais): não precisa de Docker, instalador nem permissão de
administrador. `pnpm db:start` cria o cluster na primeira vez, sobe o servidor
em segundo plano e cria o banco; `pnpm db:stop` desliga; `pnpm db:status` informa
se está no ar. Porta, usuário, senha e nome do banco vêm da `DATABASE_URL` do
`.env`, e os dados ficam em `.data/postgres` (fora do Git).

Qualquer cliente PostgreSQL (pgAdmin, DBeaver, extensão do VS Code) conecta com
os dados da `DATABASE_URL`. O Prisma Studio já vem com o projeto:
`pnpm --filter @indie/api exec prisma studio`.

Se a porta 5432 estiver ocupada (outro PostgreSQL instalado, por exemplo), o
`db:start` falha e indica o log em `.data/postgres.log`; troque a porta na
`DATABASE_URL` do `.env`.

## Documentação

| Arquivo | O que é |
| --- | --- |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Convenções de desenvolvimento: stack, estrutura, padrões, SOLID e definição de pronto |
| [`BACKLOG.md`](./BACKLOG.md) | Checklist de acompanhamento dos itens e marcos |
| [`docs/proposta-tecnica.md`](./docs/proposta-tecnica.md) | Referência oficial durante a implementação: arquitetura, segurança, modelagem, diagramas, backlog detalhado, cronograma e riscos |
| [`docs/proposta-conceitual.md`](./docs/proposta-conceitual.md) | Problema, pesquisas de campo, justificativa e proposta de valor |

## Dados

O catálogo é montado por ingestão em lote a partir da API pública da
[IGDB](https://www.igdb.com/). Veja [NOTICE](./NOTICE).

## Licença

Código sob licença MIT (veja [LICENSE](./LICENSE)). A licença cobre o código
deste repositório, não os dados de terceiros descritos no NOTICE.
