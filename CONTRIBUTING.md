# Convenções de desenvolvimento

Resumo das decisões que valem para todo o desenvolvimento deste projeto. Os
detalhes completos — arquitetura, segurança, modelagem, diagramas, backlog e
cronograma — estão em [`docs/proposta-tecnica.md`](./docs/proposta-tecnica.md),
que é a referência oficial durante a implementação. O progresso item a item fica
em [`BACKLOG.md`](./BACKLOG.md).

Projeto de um único desenvolvedor, com prazo definido pelo calendário do TCC.
As restrições abaixo existem para evitar decisões refeitas e estrutura além do
necessário.

## O que é o sistema

Recomenda jogos independentes a jogadores por afinidade de conteúdo (TF-IDF +
similaridade do cosseno), com três modos de popularidade (Populares /
Equilibrado / Descobertas), motivo visível em cada recomendação, e catálogo que
inclui jogos ainda não lançados. Sem IA generativa no MVP. A lógica completa de
pontuação está na seção 12 do documento técnico.

## Stack obrigatória

- **Backend:** NestJS 12, TypeScript estrito, formato CommonJS, Node.js 24 (decidido no B-02; Jest roda com `--experimental-vm-modules` — ver README)
- **ORM:** Prisma 7 + `@prisma/adapter-pg`, gerador `prisma-client`, URL do banco em `prisma.config.ts`, seed explícito via `prisma db seed`
- **Banco:** PostgreSQL (mesma versão principal local e no Neon)
- **Frontend:** Next.js (App Router) — Server Components para páginas públicas, Client Components para interações, `rewrites` de `/api/*` para a API (cookie same-origin)
- **Contratos:** Zod em `packages/contracts`, usados nos dois lados; validação via opção `schema` dos decorators do Nest
- **Qualidade:** ESLint, Prettier, Husky + lint-staged, Jest + Supertest, GitHub Actions (CI com PostgreSQL de serviço), Docker Compose local
- **Auth:** sessão opaca no banco + cookie HttpOnly/Secure/SameSite=Lax (não JWT); senha em Argon2id
- **Hospedagem gratuita:** Vercel (frontend), Render (API — hiberna após 15 min sem tráfego), Neon (banco — não expira, mas suspende após 5 min ocioso). O Postgres gratuito do Render **não é usado**, porque expira em 30 dias.

## Estrutura do monorrepositório (pnpm workspaces)

```
apps/api/             NestJS: API REST e aplicação de ingestão (standalone)
apps/web/             Next.js
packages/contracts/   schemas Zod e tipos compartilhados
docker-compose.yml
```

Dentro de `apps/api/src`: `common/` (filters, guards, decorators, middleware),
`prisma/`, `modules/{auth,users,catalog,library,recommendation,ingestion,health}`.
A árvore completa está na seção 7 do documento técnico.

## Padrões a seguir, e o que não fazer

- Controller → Service → Repository em cada módulo. Caso de uso dedicado **só** em `GenerateRecommendationsUseCase` e `RunIngestionUseCase`.
- Regras críticas (pontuação, TF-IDF, critério indie, mapeamento IGDB) como **funções puras**, testáveis sem banco.
- Um repository por agregado, sem classe genérica base nem interface duplicada.
- **Não** usar Clean Architecture completa, CQRS, filas, Redis, microsserviços ou GraphQL — decisão tomada e justificada na seção 7.
- `SessionAuthGuard` global, rotas abertas só com `@Public()` (fechado por padrão).
- `userId` de qualquer rota `/me/*` vem **sempre** da sessão, nunca de parâmetro ou corpo.

## Princípios de código

Todo código novo ou alterado segue os princípios **SOLID**:

- **S — Responsabilidade única:** cada classe ou função tem um motivo só para mudar. Controller não tem regra de negócio; service não monta query Prisma complexa que devia estar no repository.
- **O — Aberto/fechado:** extensível sem alterar o que já funciona e está testado. O critério indie e os pesos da recomendação ficam em configuração, e ajustar um valor não exige editar a função.
- **L — Substituição de Liskov:** uma implementação alternativa, como um repository fake nos testes, deve substituir a real sem quebrar o contrato esperado por quem a usa.
- **I — Segregação de interfaces:** interfaces e tipos pequenos e específicos para quem os consome, em vez de uma interface única genérica usada por tudo.
- **D — Inversão de dependência:** módulos de alto nível (services, casos de uso) dependem de abstrações injetadas pelo Nest, nunca instanciam Prisma ou clientes externos diretamente.

Isso não é licença para adicionar camadas ou abstrações novas: os princípios se
aplicam **dentro** da estrutura já definida na seção 7 (controller → service →
repository, funções puras, casos de uso só nos dois pontos decididos). Se seguir
SOLID à risca puxar para mais uma camada do que o documento prevê, a decisão é
registrada no documento antes de ser implementada.

## Convenções

- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- **Branches:** uma por item do backlog, nomeada com o ID (`B-17-login`); PR só entra com CI verde. A `main` fica sempre implantável.
- **Migrations:** `prisma migrate dev` só local; `prisma migrate deploy` no CI e em produção. Migration já aplicada nunca é editada.
- **Nomes:** código e banco em inglês; textos da interface em português.

## Definição de pronto de um item do backlog

Um item só é concluído quando o critério de conclusão dele (ver `BACKLOG.md`)
foi atingido, há teste automatizado para a regra principal (quando houver
regra), o CI está verde, o endpoint novo — se houver — está documentado no
Swagger, e a mudança está implantada no ambiente de demonstração.

Não há meta de cobertura de testes nem de desempenho: o critério é cobrir o que
pode quebrar a demonstração ou a tese central do trabalho.

## Ritmo de trabalho

- Um item do backlog por vez, ou um grupo pequeno de itens relacionados.
- Itens de esforço **G** (grande) começam por um plano escrito, antes de qualquer edição.
- Ao concluir um item, marcar em `BACKLOG.md` e verificar o que falta para o próximo marco.
- Dúvida de arquitetura, segurança, modelagem ou da lógica de recomendação: consultar a seção correspondente de `docs/proposta-tecnica.md` em vez de abrir uma abordagem nova. Qualquer desvio das decisões documentadas lá é registrado explicitamente.
- Ideia de funcionalidade fora do backlog P0/P1 vai para a seção 15 do documento (pós-defesa), não para o código agora.
