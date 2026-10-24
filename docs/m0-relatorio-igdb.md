# Relatório do marco M0 — viabilidade dos dados da IGDB

Gerado em 2026-10-20 pelo script `scripts/igdb-spike.mjs` (item B-07). As seções 1
a 7 são refeitas a cada execução; a seção 8 (análise e decisões) é escrita à mão
e o script a preserva.

Base: **censo de 130.030 jogos** principais com o gênero Indie
(`game_type = 0 & version_parent = null & genres = (32)`), percorridos por paginação ordenada por id.

## 1. Tamanho do catálogo

| Medida | Jogos |
| --- | --- |
| Jogos principais na IGDB | 313.077 |
| Com o gênero Indie | 130.030 |
| Indie com lançamento futuro | 3.106 |
| Indie sem data de lançamento | 24.694 |
| Removidos pelo critério de publisher provisório | 339 |

### Recortes medidos (R4 é o recorte aprovado no M0)

| Recorte | Critério | Jogos | Lançamento futuro |
| --- | --- | --- | --- |
| R0 | Todos os indie, sem publisher grande | 129.691 | 3.103 |
| R1 | R0 com capa, resumo e ao menos um gênero ou tema além de Indie | 114.215 | 2.994 |
| R2 | R1 com algum sinal de interesse: avaliações, hypes ou lançamento futuro | 19.971 | 2.994 |
| R3 | R2 sem cancelados, lançado desde 2015 ou com lançamento futuro | 15.338 | 2.994 |
| R4 | R1 sem cancelados e sem o tema Erotic; lançado antes de 2015 com avaliações, lançado desde 2015 com avaliações ou hypes, com lançamento futuro, ou anunciado sem data com hypes | 19.579 | 2.973 |

## 2. Cobertura dos campos por recorte

| Campo | R0 (129.691) | R1 (114.215) | R2 (19.971) | R3 (15.338) | R4 (19.579) |
| --- | --- | --- | --- | --- | --- |
| Resumo (≥ 40 caracteres) | 96.6% | 100.0% | 100.0% | 100.0% | 100.0% |
| Capa | 97.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| Gênero além de Indie | 82.5% | 88.9% | 95.3% | 95.2% | 95.3% |
| Pelo menos um tema | 66.0% | 71.7% | 83.4% | 83.0% | 83.1% |
| Pelo menos uma palavra-chave | 44.6% | 47.2% | 70.4% | 70.3% | 70.2% |
| Data de lançamento | 81.0% | 81.5% | 85.5% | 100.0% | 85.6% |
| Desenvolvedora identificada | 43.8% | 46.3% | 76.5% | 76.7% | 76.6% |
| País da desenvolvedora | 15.8% | 17.0% | 38.6% | 38.2% | 38.9% |
| Idiomas suportados | 90.3% | 92.2% | 95.3% | 96.8% | 95.5% |
| Suporte a português | 19.8% | 21.0% | 34.9% | 38.5% | 35.3% |
| Site oficial (website tipo 1) | 42.4% | 44.6% | 69.7% | 69.6% | 69.9% |
| Link de loja (Steam, itch.io, Epic, GOG) | 93.7% | 94.8% | 96.3% | 97.7% | 96.5% |
| Site oficial ou loja | 97.4% | 98.1% | 98.9% | 99.2% | 99.0% |
| Avaliações (total_rating_count > 0) | 7.3% | 8.1% | 46.6% | 49.7% | 46.7% |
| Interesse pré-lançamento (hypes > 0) | 8.4% | 9.3% | 53.4% | 49.8% | 53.3% |

## 3. Portão do F-06 (filtros de país e idioma)

Regra: abaixo de 50% de cobertura no catálogo final, o filtro sai do P0 e vira P1 (B-21).

| Recorte | País do estúdio | Idioma |
| --- | --- | --- |
| R0 | 15.8% — reprovado (vira P1) | 90.3% — aprovado (segue P0) |
| R1 | 17.0% — reprovado (vira P1) | 92.2% — aprovado (segue P0) |
| R2 | 38.6% — reprovado (vira P1) | 95.3% — aprovado (segue P0) |
| R3 | 38.2% — reprovado (vira P1) | 96.8% — aprovado (segue P0) |
| R4 | 38.9% — reprovado (vira P1) | 95.5% — aprovado (segue P0) |

## 4. Atributos de conteúdo (dimensiona o B-12 e o B-31)

| Recorte | Atributos distintos | Média por jogo | Memória estimada do índice |
| --- | --- | --- | --- |
| R0 | 5.211 | 4.4 | ~33.5 MB |
| R1 | 5.107 | 4.8 | ~30.1 MB |
| R2 | 4.079 | 8.3 | ~6.3 MB |
| R3 | 3.630 | 7.7 | ~4.7 MB |
| R4 | 4.059 | 8.3 | ~6.2 MB |

A estimativa é só ordem de grandeza (vetor esparso de gêneros, temas e
palavras-chave antes do descarte por limites do TF-IDF); a medição real é do B-31.

## 5. Países de desenvolvedora mais frequentes (R4)

Códigos ISO 3166-1 numéricos, como a IGDB devolve.

| Código | Jogos |
| --- | --- |
| 840 | 1.526 |
| 826 | 705 |
| 124 | 532 |
| 276 | 464 |
| 250 | 371 |
| 616 | 347 |
| 392 | 345 |
| 724 | 305 |
| 752 | 291 |
| 36 | 209 |

## 6. Indicadores de popularidade (p_j da seção 12)

Campos do próprio jogo, no recorte R4: avaliações em
46.7%, `hypes` em
53.3%. Entre os jogos de R4 com
lançamento futuro, `hypes` cobre
26.9%.

### Primitivos do PopScore (`popularity_primitives`)

Amostra de 5.973 jogos de R4 (3.000 lançados e
2.973 com lançamento futuro). Cobertura = jogos da amostra com
pelo menos um valor daquele tipo.

| Tipo | Nome | Fonte | Lançados | Futuros |
| --- | --- | --- | --- | --- |
| 1 | Visits | 121 | 70.8% | 64.6% |
| 2 | Want to Play | 121 | 90.8% | 42.8% |
| 4 | Played | 121 | 67.3% | 0.3% |
| 8 | Total Reviews | 1 | 61.5% | 0.0% |
| 7 | Negative Reviews | 1 | 61.5% | 0.0% |
| 5 | 24hr Peak Players | 1 | 61.5% | 0.0% |
| 6 | Postitive Reviews | 1 | 61.5% | 0.0% |
| 10 | Most Wishlisted Upcoming | 1 | 7.4% | 28.0% |
| 34 | 24hr Hours Watched | 14 | 24.2% | 10.7% |
| 3 | Playing | 121 | 30.2% | 0.0% |
| 9 | Global Top Sellers | 1 | 15.3% | 0.0% |

## 7. Publishers que o critério provisório remove

| Publisher | Jogos indie removidos |
| --- | --- |
| devolver digital | 124 |
| annapurna interactive | 40 |
| focus entertainment | 27 |
| thq nordic | 18 |
| electronic arts | 12 |
| paradox interactive | 12 |
| deep silver | 12 |
| sony computer entertainment | 11 |
| square enix | 11 |
| ubisoft entertainment | 11 |
| koch media | 11 |
| microsoft game studios | 9 |
| konami | 8 |
| sega | 7 |
| bandai namco entertainment | 7 |
| sony interactive entertainment | 6 |
| krafton | 6 |
| take-two interactive | 3 |
| activision | 3 |
| capcom | 3 |
| 2k games | 2 |
| xbox game studios | 1 |
| bandai namco games | 1 |
| epic games | 1 |

## 8. Análise e decisões

Escrita em 19/10/2026 a partir do censo acima e de consultas pontuais à API.
As decisões das seções 8.2, 8.4 e 8.8 foram aprovadas pelo autor em 19/10/2026 e
já estão refletidas na proposta técnica e no backlog.

### 8.1 Termos de uso (PR-04) — confirmada

Fonte: documentação oficial (https://api-docs.igdb.com, seções "Getting Started",
"Rate Limits" e FAQ), consultada em 19/10/2026.

- "The IGDB.com API is free for non-commercial usage under the terms of the
  Twitch Developer Service Agreement." O FAQ acrescenta que a API é gratuita
  também para projetos comerciais, mediante parceria.
- Armazenar os dados localmente é permitido e preferido: "Yes. In fact, we prefer
  if you store and serve the data to your end users." Isso sustenta a ingestão em
  lote e a independência da IGDB em tempo de requisição (RNF-02).
- Atribuição: exigida explicitamente na parceria comercial ("visible to your users
  and located in a static location"). Para uso não comercial vale o Twitch
  Developer Services Agreement; a atribuição visível já prevista (RNF-06, F-07)
  atende aos dois casos.
- Limites: 4 requisições por segundo e até 8 requisições abertas ao mesmo tempo;
  acima disso, resposta 429. O cliente do B-09 deve respeitar os dois.
- Campos descontinuados encontrados no spike: `category` → `game_type`,
  `status` → `game_status`, `websites.category` → `websites.type`; `follows`
  não é mais devolvido. O mapeador do B-10 já deve nascer com os campos novos.

### 8.2 Tamanho do catálogo e recorte (PR-06) — decidido: R4

A IGDB tem **130 mil jogos indie**, não "alguns milhares": a premissa PR-06 foi
revisada. 86% deles não têm nenhuma avaliação nem `hypes` (R1 → R2), o que
indica cadastros de baixa qualidade ou sem público.

**Recorte aprovado: R4, com 19.579 jogos.** Entra o jogo que tem capa, resumo e
gênero ou tema; não foi cancelado; não tem o tema Erotic; e cumpre uma destas
condições:

- lançado antes de 2015 e com avaliações — mantém clássicos como *Limbo*,
  *Terraria*, *Journey*, *Braid* e *Shovel Knight*, que o jogador procura na
  partida a frio;
- lançado desde 2015 e com avaliações ou `hypes`;
- com lançamento futuro e data marcada (**2.973 jogos**);
- anunciado sem data, mas com `hypes` (cerca de 2,9 mil jogos "por lançar").

Uma primeira versão da recomendação cortava todos os lançados antes de 2015 e
perdia 1.762 jogos com avaliações; foi corrigida antes da aprovação.

Cabe nos limites: índice estimado em ~6,2 MB (contra 512 MB da API no Render) e
um banco na casa de dezenas de MB (contra 1 GB do Neon). As medições reais são
do B-14 e do B-31. O recorte vai para o arquivo de critério versionado (B-11),
não para o código.

### 8.3 Portão do F-06 — idioma aprovado; país revisto na seção 8.8

- **Idioma: 95,5% no R4 → aprovado, segue P0.** Suporte a português aparece em
  35,3% dos jogos; os demais aparecem como "não informado" ou sem português.
- **País do estúdio: 38,9% no R4 só com a IGDB → reprovado pela regra original.**
  A regra mandaria o filtro para P1, mas o autor considerou o país um diferencial
  da plataforma; a solução adotada (Wikidata e nova regra de portão) está na
  seção 8.8.

### 8.4 Popularidade `p_j` (seção 12) — decidido: PopScore "Want to Play"

| Indicador, no R4 | Lançados | Com lançamento futuro |
| --- | --- | --- |
| `total_rating_count` (proposta original) | presente em 46,7% do catálogo, praticamente só em lançados | ~0% |
| `hypes` (proposta original para não lançados) | — | 26,9% |
| **PopScore "Want to Play"** (`popularity_type` 2) | **90,8%** | **42,8%** |
| PopScore "Visits" (`popularity_type` 1) | 70,8% | 64,6% |

**Decisão: `p_j` passa a ser o número de pessoas que marcaram o jogo como "quero
jogar" na IGDB**, para todos os jogos, com zero quando não houver valor. É um
único indicador, na mesma escala para lançados e não lançados, e faz os modos
Populares e Descobertas tratarem lançamentos aguardados como conhecidos.

- Custo: a ingestão (B-13) consulta também `popularity_primitives` (cerca de 200
  requisições extras para ~20 mil jogos).
- **Verificado no B-13 (23/10/2026): o valor é uma fração, não uma contagem.** Os
  16.730 valores do catálogo aceito são todos múltiplos inteiros de 1/881.744 (a
  fração de uma pessoa), e o `calculated_at` de todos é o dia da consulta: a IGDB
  recalcula diariamente. Em contagem reconstruída, a mediana é 5 pessoas, o p90 é 42,
  o p99 é 160 e o máximo do catálogo aceito é 763 (o da IGDB inteira é 1.708); 3.553
  jogos têm exatamente 1, e 3.284 aceitos não têm valor. A normalização passou a usar a
  contagem (proposta técnica, seção 12): com a fração bruta, ela ficaria linear.
- Limitações para o TCC: reflete o público da IGDB, não vendas; só é atualizado
  quando o catálogo é reimportado.

### 8.5 Critério indie (B-11) — insumos

- A lista provisória remove só 339 jogos: o critério de publisher quase não muda
  o tamanho do catálogo; ele importa pela credibilidade da curadoria.
- **Devolver Digital (124) e Annapurna Interactive (40) respondem por 48% das
  remoções.** São publishers dedicadas a jogos independentes, e excluí-las
  contraria a decisão herdada de que o critério "não exclui um jogo só por ele ter
  publisher". Recomenda-se tirá-las da lista no B-11, e reavaliar Paradox
  Interactive, Focus Entertainment e THQ Nordic, que também publicam indies.
- **Tema Erotic (id 42):** cerca de 300 jogos entre os que têm sinal de interesse.
  Excluído por configuração no recorte aprovado, por se tratar de demonstração
  pública e de banca.
- A marcação de gênero Indie da IGDB é ruidosa: entre os jogos futuros aparece
  *Squadron 42*, de orçamento alto. Isso reforça a importância do B-11.
- Pendente: conferir manualmente 20 jogos do recorte contra o critério e registrar
  acertos e erros (critério de conclusão do B-11).
- **Decidido no B-11 (21/10/2026):** Devolver Digital, Annapurna Interactive,
  Paradox Interactive, Focus Entertainment e THQ Nordic (e, por coerência, Deep
  Silver e Koch Media) saem da lista; ela passa a conter só donas de plataforma e
  grandes conglomerados AAA. Erotic continua excluído pelo tema, e erros de
  classificação são corrigidos por listas de exceção com fonte pública. Os 22 casos
  conferidos estão em `docs/criterio-indie-casos.md`.
- **Revisto no B-59 (22/10/2026):** a medição dos falsos negativos mostrou que a
  regra de publisher excluía, por engano, 8 de 10 jogos de uma amostra (entre os 94
  excluídos só por ela estavam *Limbo*, *Braid* e *Chroma Squad*). A regra passou a
  excluir pelo **controle do estúdio na data de lançamento**, com 56 estúdios
  verificados em fonte pública; publicar um jogo não exclui mais.
- **Medido no B-60 (23/10/2026):** as amostras da regra de controle deram 10 exclusões
  corretas em 10, e 6 aceitos corretos em 10, com os outros 4 sem desenvolvedora
  creditada. A lista de grandes passou a sair de um teste de entrada escrito (controle de
  um canal pelo qual jogos chegam ao jogador, ou de estúdio com orçamento AAA
  documentado), aplicado
  às 134 empresas no topo das cadeias de empresa-mãe; entraram Netflix, Kadokawa, Meta,
  NCSOFT e Amazon, e 106 foram avaliadas e recusadas. A falta de desenvolvedora
  creditada foi escalada (seção 8.10).

### 8.6 Qualidade dos dados para a recomendação (B-12) e a ficha (F-07)

- Atributos de conteúdo no R4: 95,3% têm gênero além de Indie, 83,1% têm tema e
  70,2% têm palavra-chave; média de 8,3 atributos por jogo e 4.059 distintos.
  Suficiente para o TF-IDF; jogos sem palavra-chave dependem só de gênero e tema.
- Link para a página oficial (F-07): 99,0% têm site oficial ou loja (Steam,
  itch.io, Epic ou GOG). A ficha pode usar o site oficial e, na falta dele, a loja.
- Desenvolvedora identificada em 76,6%: a ficha precisa tratar "não informado".
- Data de lançamento em 85,6%: os demais são anunciados sem data e aparecem como
  "Em breve" sem data.

### 8.7 Resumo das decisões do M0

| Ponto | Situação |
| --- | --- |
| Termos de uso (PR-04) | Confirmados |
| Campos descontinuados | Identificados; substitutos definidos |
| Recorte e tamanho do catálogo (PR-06) | Decidido: R4, 19.579 jogos |
| Portão do F-06 | Idioma P0; país P0 com Wikidata e nova regra (8.8) |
| Cultura retratada | Coleções culturais curadas no P0 (8.8) |
| `p_j` | Decidido: PopScore "Want to Play" |
| Lista de publishers e tema Erotic | Insumos para o B-11 |
| Fixtures reais | Salvas em `apps/api/test/fixtures/igdb/`, tiradas do R4 |

### 8.8 País e cultura como diferenciais — decidido

O autor considerou que país do estúdio e cultura retratada são o que diferencia
a plataforma de um recomendador genérico, e pediu alternativas antes de aceitar a
saída do filtro de país. Medições feitas em 19/10/2026 sobre o recorte aprovado:

| Fonte | O que mede | Resultado |
| --- | --- | --- |
| IGDB | País da desenvolvedora | 38,9% do catálogo (censo) |
| IGDB + Wikidata | País da desenvolvedora ou país de origem do jogo, cruzando pelo identificador da IGDB (P5794) | 42,6% → **52,3%** numa amostra de 2.000 jogos; no catálogo todo, cerca de 50% |
| IGDB (+ Wikidata) | Jogos de estúdios brasileiros | ~240 só pela IGDB; ~20% a mais com o Wikidata |
| IGDB, palavras-chave | Alguma marca cultural (Brasil, Japão, folclore, mitologias…) | ~409 jogos (2%); 28 citam o Brasil |
| IGDB, resumo | Menção a termos culturais no texto | ~1.171 jogos (6%), com ruído |
| Wikidata | Local da narrativa (P840) | ~4,3 mil jogos em toda a base ligada à IGDB |

Conclusões:

- **País tem solução de dados.** Com o Wikidata, que é gratuito e em domínio
  público, a cobertura chega perto de 50%, e o Brasil sozinho tem volume para um
  filtro útil.
- **Cultura retratada não existe pronta em nenhuma fonte.** Qualquer solução
  passa por curadoria, que pode ser o próprio diferencial, desde que seja
  transparente.

Decisões aprovadas pelo autor:

1. **País do estúdio volta ao P0 (B-21)**, com a IGDB complementada pelo Wikidata
   na ingestão (novo B-56) e a origem do dado registrada. A regra de portão passa
   a ser por país: **cada país só aparece como opção do filtro se tiver pelo menos
   20 jogos**. Jogos sem o dado aparecem como "não informado". **Medido no B-56
   (24/10/2026):** 47,8% do catálogo com país (39,2% pela IGDB e 8,6% pelo
   Wikidata), 250 jogos brasileiros e 48 países acima do mínimo de 20 jogos.
2. **Coleções culturais curadas entram no P0 (F-24, novos B-57 e B-58)**, sem
   substituir nenhuma funcionalidade. O sistema sugere candidatos pelas
   palavras-chave, pelo resumo e pelo Wikidata; o autor revisa e aprova; a lista
   fica em arquivo versionado. Começam de 8 a 10 coleções, com destaque para a
   cultura brasileira e pelo menos 10 jogos cada.
3. A decisão reabre uma decisão herdada da proposta conceitual ("país como filtro
   secundário, sem seção própria"), e a revisão está registrada na proposta técnica.
   O ponto médio do P0 passa de 257 h para 275 h, e o autor decidiu absorver a
   diferença sem cortar escopo.

### 8.9 Cobertura de etiquetas para a recomendação — aberto em 23/10/2026, decisão pendente

Medido no B-12 sobre o catálogo aceito (19.998 jogos), depois do descarte do TF-IDF
(detalhes em `docs/vetorizacao-tfidf.md`):

- 65,1% dos jogos têm ao menos uma palavra-chave, 83,2% um tema, 95,4% um gênero além
  de Indie; só 56,1% têm os três.
- 40,5% dos jogos ficam com no máximo 4 etiquetas no vetor, e 17,8% com no máximo 2.
- 21,1% do catálogo tem vetor idêntico ao de pelo menos 10 outros jogos (476 jogos só
  com *Adventure* e *Action*, por exemplo). Para essa fatia, a recomendação por conteúdo
  não distingue nada e o desempate vira o ranqueador.
- Jogos das entrevistas da BGS: *Bloodfang* (E3) não está na IGDB; *POPAPOM* (E5) está,
  mas fica fora do catálogo por não ter sinal de interesse; *Aviãozinho do Tráfico 3*
  (E6) está, com o nome em inglês; *AFANTASIA* (E1, "[Afantasia]" na IGDB) e
  *Tape Us Out* (E2) entram com vetor de 4 e 3 etiquetas.

Decisão do M0 a tomar: ampliar os campos usados na recomendação (por exemplo, resumo,
modos de jogo ou perspectiva) ou aceitar recomendação degradada nessa fatia e registrá-la
como limitação. O escopo do B-12 não foi ampliado.

### 8.10 Cobertura de desenvolvedora para o critério indie — aberto em 23/10/2026, registrada como limitação

Medido no B-60 sobre o catálogo aceito (20.014 jogos; detalhes em
`docs/criterio-indie-casos.md`). Jogo sem desenvolvedora creditada nunca é excluído
pela regra de controle, porque não há o que avaliar.

- **Ponderada pela visibilidade: 1,54%** das avaliações do catálogo são de jogos sem
  desenvolvedora.
- **Bruta: 23,15%** dos jogos aceitos (4.634).
- A fração cai com a visibilidade: 16,49% dos lançados, 11,83% dos que têm alguma
  avaliação, 3,10% dos que têm 5 ou mais (141 jogos) e 0,92% dos que têm 20 ou mais
  (14 jogos). Os 14 foram lidos um a um, e nenhum é de estúdio controlado; os 141 foram
  revisados pelo nome e pela publisher, e nenhum tem publisher da lista de grandes.
- **Assimetria:** o crédito ausente faz a regra falhar abrindo (aceitar), um erro que
  aparece no catálogo. O crédito presente mas errado falha nos dois sentidos, e a
  exclusão errada parece resultado correto: só a verificação manual a encontra.

Decisão: limitação registrada, **sem regra de reserva** (excluir pela publisher quando
falta a desenvolvedora traria de volta a regra derrubada no B-59). Fica para o M0
confirmar se a limitação é aceita como está.

## Fixtures

Salvas em `apps/api/test/fixtures/igdb/` para os testes do B-10 e do B-11:
`games.complete.json` (25), `games.upcoming.json` (5), `games.sparse.json` (10), `games.major-publisher.json` (10).
