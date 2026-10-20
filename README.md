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
docker compose up -d          # PostgreSQL local
cp .env.example .env          # preencher as variáveis
pnpm --filter @indie/api exec prisma migrate dev
pnpm dev
```

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
