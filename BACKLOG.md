# Backlog — Plataforma de Descoberta de Jogos Independentes

Checklist de acompanhamento. Detalhes completos de cada item (critério de conclusão, dependências, justificativa) estão na seção 13 de `docs/proposta-tecnica.md` — aqui fica só o essencial para marcar progresso e saber o que vem a seguir.

**Esforço:** P = 2–4h · M = 5–10h · G = 12–20h, já incluindo testes.
**Marcos:** M0 (semana 2) · M1 (semana 12) · M2 (semana 16) · Congelamento (semana 20) · M3 (semana 22) · Banca (semana 24).
**Organização:** por sprint, na ordem da tabela de sprints da seção 13 de `docs/proposta-tecnica.md`. A sigla depois do esforço é o épico do item.

Marque `[x]` ao concluir um item (quando o CI estiver verde, o teste da regra principal existir, o Swagger estiver atualizado se houver endpoint novo, e a mudança estiver implantada), e o épico quando todos os itens dele estiverem concluídos.

## Épicos

- [x] **E0** Ambiente e fundação
- [x] **E1** Catálogo e ingestão
- [x] **E2** Contas e autenticação
- [ ] **E3** Descoberta e interface pública
- [ ] **E4** Biblioteca do jogador
- [ ] **E5** Recomendação
- [ ] **E6** Implantação
- [ ] **E7** Documentação e acabamento
- [ ] **E8** Avaliação e defesa

## S1 — Fundação e viabilidade dos dados (semanas 1–2)

Entrega: monorrepositório rodando local com hooks; **M0**.

- [x] **B-01** (M, E0) Monorrepositório pnpm (`apps/api`, `apps/web`, `packages/contracts`) + `tsconfig.base` estrito
- [x] **B-02** (P, E0) Projetos NestJS 12 e Next.js; Swagger em `/api/docs`; rewrite `/api/*`; verificar compatibilidade CommonJS × Prisma 7
- [x] **B-03** (P, E0) ESLint, Prettier, Husky, lint-staged
- [x] **B-04** (P, E0) PostgreSQL local embutido no projeto (`pnpm db:start`), sem Docker
- [x] **B-07** (M, E1) **Spike da IGDB — marco M0:** credenciais, termos de uso, cobertura de campos (país, idioma, resumo, indicador pré-lançamento), tamanho do catálogo, fixtures reais salvas

## S2 — Implantação e CI desde o início (semanas 3–4)

Entrega: API e frontend vazios implantados, banco remoto com migrations, CI verde.

- [x] **B-05** (P, E0) CI: instalação → lint → tipos → testes → migrations (Postgres de serviço) → e2e → build
- [x] **B-08** (M, E1) Schema Prisma do catálogo + primeira migration + seed de países/idiomas
- [x] **B-38** (P, E6) Banco no Neon + `migrate deploy`
- [x] **B-39** (M, E6) Implantação da API no Render + `GET /api/health`
- [x] **B-40** (P, E6) Implantação do frontend na Vercel

## S3 — Integração com a IGDB (semanas 5–6)

Entrega: cliente e mapeador testados com fixtures; critério indie validado contra casos reais.

- [x] **B-06** (P, E0) Schema Zod das variáveis de ambiente + `.env.example`
- [x] **B-09** (M, E1) Cliente IGDB: OAuth Twitch, paginação, limite de requisições, retry
- [x] **B-10** (M, E1) Mapeador IGDB → modelo interno
- [x] **B-11** (M, E1) Critério indie configurável em JSON, com o recorte do catálogo e a exclusão do tema Erotic aprovados no M0

## S4 — Catálogo real no banco (semanas 7–8)

Entrega: ingestão completa executada em produção e registrada.

- [x] **B-12** (M, E1) Cálculo de IDF e vetores TF-IDF normalizados
- [x] **B-13** (G, E1) `RunIngestionUseCase` (aplicação standalone): busca, mapeia, filtra, grava, busca a popularidade "Want to Play", calcula vetores, registra `IngestionRun`, sinaliza para verificação o jogo novo de estúdio "sem efeito atual" do critério indie, ou cuja desenvolvedora tem empresa-mãe na IGDB fora da lista de grandes, ou na lista mas fora dos estúdios controlados; reavalia o critério dos jogos já no catálogo a cada execução e sinaliza o jogo sem data que ganha data de lançamento — carga real local: 20.050 jogos em cerca de 7 min, gravação de 16 s, segunda execução sem nenhuma linha regravada (`docs/ingestao.md`)
- [x] **B-14** (P, E1) Carga inicial do catálogo real em produção (depois do B-60) — 20.051 jogos no Neon pelo workflow manual "Ingestão", banco de 69 MB, 0 alertas; a segunda execução regravou só 3 linhas (`docs/ingestao.md`)
- [x] **B-56** (P, E1) Enriquecimento do país do estúdio pelo Wikidata na ingestão — 47,8% do catálogo com país (39,2% IGDB + 8,6% Wikidata), 250 jogos brasileiros, 48 países com 20 jogos ou mais
- [x] **B-59** (M, estimado P; E1) Medir falsos negativos do critério indie: sortear 8 a 10 jogos excluídos pela regra e classificar à mão — taxa de 8 em 10 levou à troca da regra de publisher pela de controle do estúdio
- [x] **B-60** (P, E1) Medir a regra de controle do critério indie: amostras de ~10 excluídos e ~10 aceitos, classificadas à mão — 10 de 10 exclusões corretas; achados: lacuna na lista de grandes (teste de entrada escrito, 5 empresas acrescentadas, 106 avaliadas e recusadas) e aceitos sem desenvolvedora (1,54% das avaliações; 23,15% dos jogos), escalado ao M0
- [x] **B-61** (P, E1) Decidir o "Want to Play" como sinal de interesse, com a carência pós-lançamento corrigida medida lado a lado — decidido em 30/10/2026: contagem de 5 pessoas ou mais como sinal a mais (+2.582 jogos, 12,8%), carência mantida; trocar a carência foi descartado, porque o "Want to Play" mantém 0 dos 329 jogos em carência (`docs/criterio-indie-casos.md`)

## S5 — Contas e segurança (semanas 9–10)

Entrega: cadastro, login e logout funcionando no ambiente implantado.

- [x] **B-15** (P, E2) Modelos `User` e `Session` + migration
- [x] **B-16** (P, E2) Cadastro com Argon2id e e-mail único
- [x] **B-17** (M, E2) Login, logout, `GET /auth/me`, `SessionAuthGuard` global, `@Public()`
- [x] **B-18** (M, E2) Proteções: throttler no login, helmet, `OriginGuard`, filtro global de exceções, request-id e logs
- [x] **B-64** (P, E2) Páginas de entrar e cadastrar e estado de sessão no cabeçalho, com foco funcional (o visual vem depois, com apoio de design gráfico)
- [x] **B-22** (P, E3) `GET /games/:slug`

## S6 — Interface pública de descoberta (semanas 11–12)

Entrega: **M1**.

- [x] **B-20** (M, E3) `GET /games` com busca, filtros (gênero, tema, situação), paginação; `GET /features`
- [x] **B-21** (P, E3) Filtros de idioma português e país do estúdio (país só lista opções com 20+ jogos)
- [x] **B-23** (M, E3) Página de catálogo com filtros na URL
- [x] **B-24** (M, E3) Página do jogo (selo "Em breve", atribuição IGDB, metadados no servidor, capa direto da CDN da IGDB sem o otimizador da Vercel)

## S7 — Biblioteca, índice de conteúdo e coleções (semanas 13–14)

Entrega: avaliações e listas pela API; índice carregado com memória medida; e2e de autenticação no CI.

- [x] **B-19** (M, E2) Suíte e2e de autenticação
- [x] **B-26** (P, E4) Modelos `Rating`, `ListEntry`, `UserPreference` + migration — concluído em 02/11/2026: nota de 1 a 5 garantida por `CHECK` no banco e pelo contrato; jogo e atributo com avaliação, lista ou preferência não podem ser apagados (`Restrict`)
- [x] **B-27** (M, E4) Endpoints `/me/*`: avaliação, listas, biblioteca, preferências, modo — concluído em 02/11/2026: jogo pelo slug na URL, "concluídos" e "quero jogar" exclusivos, jogo fora do catálogo mantido na biblioteca com `inCatalog: false`
- [x] **B-31** (M, E5) `ContentIndex`: carga dos vetores na inicialização + recarga protegida por segredo; decidir se `tfidfWeight` continua persistido ou se os pesos são reconstruídos do IDF na inicialização (medido em 25/10/2026: uma execução em outro dia regravou 135 mil das 189 mil linhas de `GameFeature`) — concluído em 02/11/2026: pesos refeitos na API e coluna removida; índice de 22.825 jogos com cerca de 19 MB de heap; recarga pelo workflow "Ingestão" (`docs/vetorizacao-tfidf.md`)
  - [x] Resolver as dependências entre pastas deixadas pela reorganização da ingestão: `recommendation/tfidf.ts` importa `MappedFeature` do mapeador da IGDB; `igdb/igdb-catalog.source.ts` importa tipos de `review-flags/`; `persistence/` importa `StoredGame` e `ReviewFlag` de `review-flags/`; `criteria/`, `review-flags/` e `persistence/` dependem de `MappedGame`, definido no mapeador da IGDB; `igdb/` importa `ingestion-config.ts` da raiz do módulo — feito no B-31: os tipos compartilhados foram para `ingestion/model/`, a fonte da IGDB declara só o filtro que usa e o TF-IDF tem o próprio tipo de atributo
- [x] **B-57** (M, E3) Coleções culturais curadas: modelo, arquivo de curadoria, sugestão de candidatos, endpoints — concluído em 01/11/2026: 10 coleções publicadas (Brasil com 29 jogos, de 22 a 131 nas outras) e Povos indígenas em rascunho (`docs/colecoes.md`)
- [x] **B-69** (M, E1) "Want to Play" com contagem de 5 pessoas ou mais como sinal de interesse na ingestão; medir entre duas ingestões quantos jogos ficaram abaixo do limite depois de estarem acima. **Precede o B-37 e as medições do B-62:** o catálogo cresce cerca de 13%, o que muda IDF, vetores, popularidade máxima e a cobertura de etiquetas do 8.9 — concluído em 01/11/2026: 22.805 jogos em produção; nenhum saiu por cair abaixo do mínimo entre as cargas locais de 30/10 e 01/11 (`docs/ingestao.md`)
- [ ] **B-63** (M, E5) Palavras do resumo como bloco do vetor, em TF-IDF com pesos em memória na API (fora da explicação por enquanto); a fatia só fica acima de zero se melhorar o acerto@10 no B-37; primeiro corte depois dos P1

## S8 — Núcleo da recomendação (semanas 15–16)

Entrega: **M2**.

- [x] **B-32** (G, E5) Núcleo de pontuação em funções puras (perfil ponderado, cosseno, popularidade, seleção, desempate, explicação) — concluído em 02/11/2026: bônus de listas somados; motivos só por gênero e tema, com a reserva "Porque você gostou de"; desempate por sorteio fixo por usuário; "pouco conhecido" pelo contrafactual sem popularidade; de 4 a 15 ms por recomendação no catálogo local (`docs/recomendacao.md`)
- [x] **B-33** (M, E5) `GenerateRecommendationsUseCase` + `GET /recommendations` — **marco M2** — concluído em 03/11/2026: modo opcional na consulta, com o salvo como padrão; motivo com os nomes em português; `basis` `empty` pelo estado gravado; 15 ms de mediana no servidor, no catálogo local, e 60 ms em produção, com cerca de 200 ms fim a fim (`docs/recomendacao.md`)
  - [x] Com o índice de conteúdo indisponível (`loading` ou `failed`), `GET /recommendations` responde 503 com mensagem clara, nunca lista vazia (decidido no B-31: a API sobe mesmo sem o índice); o filtro de erros passou a manter a mensagem de um 5xx lançado de propósito
  - [x] Jogo da biblioteca fora do catálogo: o vetor é montado com os atributos do banco e o IDF do índice, e ele continua no perfil (levantado no B-32)
  - [x] Preferências gravadas pelo id do atributo: o índice guarda o id e a posição de cada atributo (levantado no B-32)

## S9 — Recomendação e coleções na interface (semanas 17–18)

Entrega: jogador avalia na ficha e vê a lista mudar; e2e de recomendação e de posse no CI.

- [ ] **B-28** (M, E4) Componentes de avaliação e listas na ficha do jogo
- [ ] **B-35** (M, E5) Página de recomendações com motivo e seletor de modo
- [ ] **B-36** (P, E5) E2e de recomendação + teste de determinismo
- [ ] **B-30** (P, E4) E2e de biblioteca e posse dos dados (um usuário não altera dados de outro)
- [ ] **B-58** (M, E3) Interface das coleções: vitrine "Explore por cultura", página da coleção, indicação na ficha

## S10 — Partida a frio, perfil e avaliação offline (semanas 19–20)

Entrega: todos os P0 prontos; pesos calibrados; **congelamento**.

- [ ] **B-34** (M, E5) Partida a frio (gêneros/temas + avaliação opcional de até 4 jogos)
- [ ] **B-29** (P, E4) Página de perfil (avaliações e listas) e avatar com as iniciais do nome no perfil e no cabeçalho
- [ ] **B-37** (M, E5) Script de avaliação offline + calibração dos pesos (depois do B-69)
- [ ] **B-62** (M, E5) Modo de jogo e perspectiva como quarto bloco do vetor (fatia em config, fora da explicação ao jogador); a fatia só fica acima de zero se melhorar o acerto@10 no B-37; medir depois do B-69 — movido da S7 para a S10 no B-32, para ficar ao lado do B-37 que decide a fatia
- [ ] **B-25** (P, E3) Página "Como funciona" (lista grandes empresas, estúdios controlados e exceções manuais com motivo e fonte)

## S11 — Avaliação com usuários e acabamento (semanas 21–22)

Entrega: **M3**: critérios de prontidão atendidos.

- [ ] **B-44** (G, E8) Teste de usabilidade com 8–12 jogadores
- [ ] **B-45** (M, E7) Correções priorizadas a partir do teste de usabilidade
- [ ] **B-41** (P, E6) Contingência local: dump do banco + restauração no PostgreSQL embutido
- [ ] **B-42** (P, E7) Revisão final do Swagger (exemplos e erros em todos os endpoints P0)
- [ ] **B-43** (P, E7) README (arquitetura, como rodar local, variáveis, ingestão, testes, implantação, contingência)

## Margem — Preparação da banca e absorção de atrasos (semanas 23–24)

Entrega: dois ensaios realizados, texto entregue, slides revisados.

- [ ] **B-46** (M, E8) Roteiro de demonstração + dois ensaios (um com contingência local)
- [ ] **B-48** (M, E8) Slides da defesa

## Contínuo

- [ ] **B-47** (—, E8) Escrita do TCC (contínua, ~3h/semana)

## Perguntas em aberto

- [ ] A ficha de um jogo fora do catálogo deveria abrir para quem já o tem na biblioteca? Decidir no B-28 ou no B-29, com a interface pronta (levantada no B-27)
- [ ] Estar na biblioteca de algum usuário da plataforma deveria contar como sinal de interesse no critério indie? (levantada no B-27)

---

## P1 — depois do M2, se houver capacidade (não bloqueia a defesa)

- [ ] **B-49** (P) Registro de cliques de saída
- [ ] **B-50** (P) Jogos parecidos na ficha
- [ ] **B-51** (P) Sitemap e robots
- [ ] **B-52** (P) Exclusão da própria conta
- [ ] **B-53** (M) Edição de nome e troca de senha
- [ ] **B-54** (P) Ingestão agendada (GitHub Actions)
- [ ] **B-55** (M) E2e no navegador (Playwright) do roteiro de demonstração
- [ ] **B-65** (P) ID dos jogos na Steam gravado pela ingestão
- [ ] **B-66** (M) Vínculo da conta Steam à conta do usuário, com o avatar público da Steam no lugar das iniciais
- [ ] **B-67** (M) Importação da wishlist da Steam para a lista "quero jogar", com resumo de importados e aviso de wishlist privada
- [ ] **B-68** (M) Login com Google, com a foto da conta Google como avatar
- [ ] **B-70** (P) `popularityNorm` calculado na carga do índice, e não gravado pela ingestão (decidido no B-33)

## P2 — pós-defesa

Ver seção 15 de `docs/proposta-tecnica.md` para a ordem e as condições de entrada de cada item (F-22, F-23, F-25 a F-29 e F-33: sugestão de jogo, área do estúdio, recursos de comunidade, recuperação de senha, recomendação híbrida com embeddings, filtragem colaborativa, avisos de lançamento, foto de perfil enviada pelo usuário).

---

## Marcos — checklist rápido

- [x] **M0** (semana 2): relatório da IGDB concluído, termos confirmados, portão do B-21 decidido
  - [x] Reaberto no B-12: decidir a cobertura de etiquetas para a recomendação (relatório do M0, seção 8.9) — modo de jogo e perspectiva (B-62) e palavras do resumo (B-63) aprovados, os dois condicionados ao acerto@10 no B-37
  - [x] Reaberto no B-60: confirmar a falta de desenvolvedora creditada como limitação, sem regra de reserva (relatório do M0, seção 8.10) — aceita, sem regra de reserva; defesa pelo alerta `NO_DEVELOPER_VISIBLE` da ingestão
- [x] **M1** (semana 12): catálogo real navegável + contas implantadas — atingido em 30/10/2026, na semana 2; tag `v0.1-M1`
- [x] **M2** (semana 16): recomendação ponta a ponta pela API, testada e implantada — atingido em 03/11/2026, na semana 3; tag `v0.2-M2`
- [ ] **Congelamento** (semana 20): todos os P0 implementados, nenhuma funcionalidade nova depois disso
- [ ] **M3** (semana 22): critérios de prontidão da seção 16 atendidos, teste de usabilidade feito
- [ ] **Banca** (semana 24)

## Se o atraso passar de uma sprint

Aplicar o plano de corte da seção 16 do documento, nesta ordem: 1) cortar todo P1 e testes opcionais de frontend; 2) Swagger sem exemplos; 3) B-21 vira P1; 4) partida a frio sem a etapa de avaliação; 5) perfil só leitura; 6) reduzir catálogo por data de lançamento. **Nunca cortar:** contas/sessão, ingestão com critério indie e vetores, catálogo e ficha, avaliações, partida a frio mínima, recomendações com motivo e modos, avaliação offline, testes críticos, implantação e contingência local.
