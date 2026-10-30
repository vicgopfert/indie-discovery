# Backlog — Plataforma de Descoberta de Jogos Independentes

Checklist de acompanhamento. Detalhes completos de cada item (critério de conclusão, dependências, justificativa) estão na seção 13 de `docs/proposta-tecnica.md` — aqui fica só o essencial para marcar progresso e saber o que vem a seguir.

**Esforço:** P = 2–4h · M = 5–10h · G = 12–20h, já incluindo testes.
**Marcos:** M0 (semana 2) · M1 (semana 12) · M2 (semana 16) · Congelamento (semana 20) · M3 (semana 22) · Banca (semana 24).

Marque `[x]` ao concluir um item (quando o CI estiver verde, o teste da regra principal existir, o Swagger estiver atualizado se houver endpoint novo, e a mudança estiver implantada).

## E0 — Ambiente e fundação (S1–S2)

- [x] **B-01** (M) Monorrepositório pnpm (`apps/api`, `apps/web`, `packages/contracts`) + `tsconfig.base` estrito
- [x] **B-02** (P) Projetos NestJS 12 e Next.js; Swagger em `/api/docs`; rewrite `/api/*`; verificar compatibilidade CommonJS × Prisma 7
- [x] **B-03** (P) ESLint, Prettier, Husky, lint-staged
- [x] **B-04** (P) PostgreSQL local embutido no projeto (`pnpm db:start`), sem Docker
- [x] **B-05** (P) CI: instalação → lint → tipos → testes → migrations (Postgres de serviço) → e2e → build
- [x] **B-06** (P) Schema Zod das variáveis de ambiente + `.env.example`

## E1 — Catálogo e ingestão (S3–S4)

- [x] **B-07** (M) **Spike da IGDB — marco M0:** credenciais, termos de uso, cobertura de campos (país, idioma, resumo, indicador pré-lançamento), tamanho do catálogo, fixtures reais salvas
- [x] **B-08** (M) Schema Prisma do catálogo + primeira migration + seed de países/idiomas
- [x] **B-09** (M) Cliente IGDB: OAuth Twitch, paginação, limite de requisições, retry
- [x] **B-10** (M) Mapeador IGDB → modelo interno
- [x] **B-11** (M) Critério indie configurável em JSON, com o recorte do catálogo e a exclusão do tema Erotic aprovados no M0
- [x] **B-12** (M) Cálculo de IDF e vetores TF-IDF normalizados
- [x] **B-13** (G) `RunIngestionUseCase` (aplicação standalone): busca, mapeia, filtra, grava, busca a popularidade "Want to Play", calcula vetores, registra `IngestionRun`, sinaliza para verificação o jogo novo de estúdio "sem efeito atual" do critério indie, ou cuja desenvolvedora tem empresa-mãe na IGDB fora da lista de grandes, ou na lista mas fora dos estúdios controlados; reavalia o critério dos jogos já no catálogo a cada execução e sinaliza o jogo sem data que ganha data de lançamento — carga real local: 20.050 jogos em cerca de 7 min, gravação de 16 s, segunda execução sem nenhuma linha regravada (`docs/ingestao.md`)
- [x] **B-14** (P) Carga inicial do catálogo real em produção (depois do B-60) — 20.051 jogos no Neon pelo workflow manual "Ingestão", banco de 69 MB, 0 alertas; a segunda execução regravou só 3 linhas (`docs/ingestao.md`)
- [x] **B-60** (P) Medir a regra de controle do critério indie: amostras de ~10 excluídos e ~10 aceitos, classificadas à mão — 10 de 10 exclusões corretas; achados: lacuna na lista de grandes (teste de entrada escrito, 5 empresas acrescentadas, 106 avaliadas e recusadas) e aceitos sem desenvolvedora (1,54% das avaliações; 23,15% dos jogos), escalado ao M0
- [x] **B-59** (M, estimado P) Medir falsos negativos do critério indie: sortear 8 a 10 jogos excluídos pela regra e classificar à mão — taxa de 8 em 10 levou à troca da regra de publisher pela de controle do estúdio
- [x] **B-61** (P) Decidir o "Want to Play" como sinal de interesse, com a carência pós-lançamento corrigida medida lado a lado — decidido em 30/10/2026: contagem de 5 pessoas ou mais como sinal a mais (+2.582 jogos, 12,8%), carência mantida; trocar a carência foi descartado, porque o "Want to Play" mantém 0 dos 329 jogos em carência (`docs/criterio-indie-casos.md`)
- [ ] **B-69** (M) "Want to Play" com contagem de 5 pessoas ou mais como sinal de interesse na ingestão; medir entre duas ingestões quantos jogos ficaram abaixo do limite depois de estarem acima. **Precede o B-37 e as medições do B-62:** o catálogo cresce cerca de 13%, o que muda IDF, vetores, popularidade máxima e a cobertura de etiquetas do 8.9
- [x] **B-56** (P) Enriquecimento do país do estúdio pelo Wikidata na ingestão — 47,8% do catálogo com país (39,2% IGDB + 8,6% Wikidata), 250 jogos brasileiros, 48 países com 20 jogos ou mais

## E2 — Contas e autenticação (S5)

- [x] **B-15** (P) Modelos `User` e `Session` + migration
- [x] **B-16** (P) Cadastro com Argon2id e e-mail único
- [x] **B-17** (M) Login, logout, `GET /auth/me`, `SessionAuthGuard` global, `@Public()`
- [x] **B-18** (M) Proteções: throttler no login, helmet, `OriginGuard`, filtro global de exceções, request-id e logs
- [x] **B-19** (M) Suíte e2e de autenticação
- [x] **B-64** (P) Páginas de entrar e cadastrar e estado de sessão no cabeçalho, com foco funcional (o visual vem depois, com apoio de design gráfico)

## E3 — Descoberta e interface pública (S6)

- [x] **B-20** (M) `GET /games` com busca, filtros (gênero, tema, situação), paginação; `GET /features`
- [x] **B-21** (P) Filtros de idioma português e país do estúdio (país só lista opções com 20+ jogos)
- [x] **B-22** (P) `GET /games/:slug`
- [x] **B-23** (M) Página de catálogo com filtros na URL
- [x] **B-24** (M) Página do jogo (selo "Em breve", atribuição IGDB, metadados no servidor, capa direto da CDN da IGDB sem o otimizador da Vercel)
- [ ] **B-25** (P) Página "Como funciona" (lista grandes empresas, estúdios controlados e exceções manuais com motivo e fonte)
- [ ] **B-57** (M) Coleções culturais curadas: modelo, arquivo de curadoria, sugestão de candidatos, endpoints
- [ ] **B-58** (M) Interface das coleções: vitrine "Explore por cultura", página da coleção, indicação na ficha

## E4 — Biblioteca do jogador (S7)

- [ ] **B-26** (P) Modelos `Rating`, `ListEntry`, `UserPreference` + migration
- [ ] **B-27** (M) Endpoints `/me/*`: avaliação, listas, biblioteca, preferências, modo
- [ ] **B-28** (M) Componentes de avaliação e listas na ficha do jogo
- [ ] **B-29** (P) Página de perfil (avaliações e listas) e avatar com as iniciais do nome no perfil e no cabeçalho
- [ ] **B-30** (P) E2e de biblioteca e posse dos dados (um usuário não altera dados de outro)

## E5 — Recomendação (S7–S10)

- [ ] **B-31** (M) `ContentIndex`: carga dos vetores na inicialização + recarga protegida por segredo; decidir se `tfidfWeight` continua persistido ou se os pesos são reconstruídos do IDF na inicialização (medido em 25/10/2026: uma execução em outro dia regravou 135 mil das 189 mil linhas de `GameFeature`)
  - Resolver as dependências entre pastas deixadas pela reorganização da ingestão: `recommendation/tfidf.ts` importa `MappedFeature` do mapeador da IGDB; `igdb/igdb-catalog.source.ts` importa tipos de `review-flags/`; `persistence/` importa `StoredGame` e `ReviewFlag` de `review-flags/`; `criteria/`, `review-flags/` e `persistence/` dependem de `MappedGame`, definido no mapeador da IGDB; `igdb/` importa `ingestion-config.ts` da raiz do módulo
- [ ] **B-62** (M) Modo de jogo e perspectiva como quarto bloco do vetor (fatia em config, fora da explicação ao jogador); a fatia só fica acima de zero se melhorar o acerto@10 no B-37; medir depois do B-69
- [ ] **B-63** (M) Palavras do resumo como bloco do vetor, em TF-IDF com pesos em memória na API (fora da explicação por enquanto); a fatia só fica acima de zero se melhorar o acerto@10 no B-37; primeiro corte depois dos P1
- [ ] **B-32** (G) Núcleo de pontuação em funções puras (perfil ponderado, cosseno, popularidade, seleção, desempate, explicação)
- [ ] **B-33** (M) `GenerateRecommendationsUseCase` + `GET /recommendations` — **marco M2**
- [ ] **B-34** (M) Partida a frio (gêneros/temas + avaliação opcional de até 4 jogos)
- [ ] **B-35** (M) Página de recomendações com motivo e seletor de modo
- [ ] **B-36** (P) E2e de recomendação + teste de determinismo
- [ ] **B-37** (M) Script de avaliação offline + calibração dos pesos (depois do B-69)

## E6 — Implantação (S2, contínuo)

- [x] **B-38** (P) Banco no Neon + `migrate deploy`
- [x] **B-39** (M) Implantação da API no Render + `GET /api/health`
- [x] **B-40** (P) Implantação do frontend na Vercel
- [ ] **B-41** (P) Contingência local: dump do banco + restauração no PostgreSQL embutido

## E7 — Documentação e acabamento (S11)

- [ ] **B-42** (P) Revisão final do Swagger (exemplos e erros em todos os endpoints P0)
- [ ] **B-43** (P) README (arquitetura, como rodar local, variáveis, ingestão, testes, implantação, contingência)
- [ ] **B-45** (M) Correções priorizadas a partir do teste de usabilidade

## E8 — Avaliação e defesa (horas acadêmicas, contínuo)

- [ ] **B-44** (G) Teste de usabilidade com 8–12 jogadores
- [ ] **B-46** (M) Roteiro de demonstração + dois ensaios (um com contingência local)
- [ ] **B-47** (—) Escrita do TCC (contínua, ~3h/semana)
- [ ] **B-48** (M) Slides da defesa

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

## P2 — pós-defesa

Ver seção 15 de `docs/proposta-tecnica.md` para a ordem e as condições de entrada de cada item (F-22, F-23, F-25 a F-29 e F-33: sugestão de jogo, área do estúdio, recursos de comunidade, recuperação de senha, recomendação híbrida com embeddings, filtragem colaborativa, avisos de lançamento, foto de perfil enviada pelo usuário).

---

## Marcos — checklist rápido

- [x] **M0** (semana 2): relatório da IGDB concluído, termos confirmados, portão do B-21 decidido
  - [x] Reaberto no B-12: decidir a cobertura de etiquetas para a recomendação (relatório do M0, seção 8.9) — modo de jogo e perspectiva (B-62) e palavras do resumo (B-63) aprovados, os dois condicionados ao acerto@10 no B-37
  - [x] Reaberto no B-60: confirmar a falta de desenvolvedora creditada como limitação, sem regra de reserva (relatório do M0, seção 8.10) — aceita, sem regra de reserva; defesa pelo alerta `NO_DEVELOPER_VISIBLE` da ingestão
- [x] **M1** (semana 12): catálogo real navegável + contas implantadas — atingido em 30/10/2026, na semana 2; tag `v0.1-M1`
- [ ] **M2** (semana 16): recomendação ponta a ponta pela API, testada e implantada
- [ ] **Congelamento** (semana 20): todos os P0 implementados, nenhuma funcionalidade nova depois disso
- [ ] **M3** (semana 22): critérios de prontidão da seção 16 atendidos, teste de usabilidade feito
- [ ] **Banca** (semana 24)

## Se o atraso passar de uma sprint

Aplicar o plano de corte da seção 16 do documento, nesta ordem: 1) cortar todo P1 e testes opcionais de frontend; 2) Swagger sem exemplos; 3) B-21 vira P1; 4) partida a frio sem a etapa de avaliação; 5) perfil só leitura; 6) reduzir catálogo por data de lançamento. **Nunca cortar:** contas/sessão, ingestão com critério indie e vetores, catálogo e ficha, avaliações, partida a frio mínima, recomendações com motivo e modos, avaliação offline, testes críticos, implantação e contingência local.
