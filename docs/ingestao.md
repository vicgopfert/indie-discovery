# Ingestão do catálogo (B-13)

Aplicação Nest sem servidor HTTP (`apps/api/src/ingest.ts`) que monta o catálogo a partir
da IGDB. A API nunca consulta a IGDB nem conhece as credenciais dela.

```
pnpm --filter @indie/api ingest       # depois do build: node dist/ingest.js
pnpm --filter @indie/api ingest:dev   # direto do código, com tsx
```

Variáveis: `DATABASE_URL`, `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET`. A saída é 0 quando a
execução termina como `SUCCEEDED` e 1 quando termina como `FAILED`.

**Em produção**, a ingestão roda pelo workflow manual "Ingestão" do GitHub Actions
(`.github/workflows/ingest.yml`), só a partir da `main`, com os secrets
`PRODUCTION_DATABASE_URL` (conexão direta do Neon), `IGDB_CLIENT_ID` e
`IGDB_CLIENT_SECRET`. Ele divide o grupo de concorrência com o job de migrations, para que
os dois nunca rodem juntos, e escreve no resumo da execução o registro do `IngestionRun`, a
composição do catálogo, os alertas e o tamanho do banco.

## Uma execução

1. Abre um `IngestionRun` como `RUNNING`, com a versão do critério (hash de
   `config/indie-criteria.json`) e a data da avaliação.
2. Busca o conjunto candidato inteiro (`config/ingestion.json`, recorte R4 do M0), mapeia
   e avalia cada jogo pelo critério indie com a data da execução. **Todo jogo já gravado é
   reavaliado**, não só os novos.
3. Sobe as cadeias de empresa-mãe das desenvolvedoras dos jogos aceitos.
4. Busca o "Want to Play" dos aceitos e reconstrói a contagem (seção "Popularidade").
   Busca no Wikidata o país dos jogos sem país na IGDB (seção "País do estúdio").
5. Calcula IDF e vetores TF-IDF sobre o catálogo aceito.
6. Detecta os alertas de revisão.
7. Grava tudo numa única transação e fecha a execução com contagens, escala da
   popularidade e resumo de erros.

Jogo rejeitado na primeira avaliação não é gravado. Jogo gravado que passa a ser
rejeitado fica com `inCatalog = false`, com o veredito e a versão do critério, porque
avaliações e listas de usuários apontam para ele.

## Falhas

| Situação | Resultado |
| --- | --- |
| Erro da IGDB depois das novas tentativas do cliente | `FAILED`, nada gravado |
| Jogos fora do schema acima de `maxInvalidRatio` (1%) | `FAILED`, nada gravado |
| Jogos fora do schema abaixo do teto | Pulados e contados em `gamesInvalid` |
| "Want to Play" fora da grade de múltiplos inteiros da unidade | `FAILED`, nada gravado |
| Erro na gravação | `FAILED`: a transação desfaz tudo, e a próxima execução refaz |
| Busca com menos de 95% dos jogos da última execução bem-sucedida | `SUCCEEDED`, mas nenhum jogo é desativado; o motivo fica no resumo |

Rodar duas vezes seguidas não duplica nada: a chave é sempre o id da IGDB. Cada execução
reavalia tudo, mas só regrava a linha que mudou (`ON CONFLICT ... DO UPDATE ... WHERE ...
IS DISTINCT FROM`), e as ligações de cada jogo (empresas, atributos e idiomas) são
atualizadas por diferença: entra o que falta, sai o que saiu e muda só o que mudou. No
PostgreSQL, toda atualização deixa uma linha morta, e regravar o catálogo inteiro deixava
cerca de 48 MB por execução. O `syncedAt` do jogo é a data da última mudança da linha; a
data da avaliação fica em `IngestionRun.evaluatedAt`.

## Restrições de execução

- **Nunca rodar a ingestão dentro do processo da API.** O pico de memória medido fica entre
  540 e 610 MB, acima dos 512 MB do Render. A ingestão roda pela linha de comando ou, no
  B-54, no GitHub Actions.
- **A transação cobre só a gravação.** A busca e o cálculo terminam antes de ela abrir. A
  gravação do catálogo inteiro levou de 8 a 16 s no banco local, e o limite é de 5 min.
- **No Neon (B-14), usar a conexão direta, não a do pooler.** A transação longa de
  gravação não combina com o pooler em modo de transação.

## Carência pós-lançamento

O jogo que estava no catálogo na execução anterior bem-sucedida e foi lançado há menos de
180 dias segue a regra de "por lançar" para o sinal de interesse. A carência protege a
passagem de "por lançar" a lançado e não admite jogo que nunca esteve no catálogo.
**Na primeira carga, com o banco vazio, ninguém tem carência**: é consequência da regra,
não defeito. O prazo é um valor inicial sem evidência (`postLaunchGraceDays`).

A primeira versão da carência valia para qualquer jogo lançado há menos de 180 dias e
admitia 4.943 jogos que nunca tinham entrado. Balanço do catálogo em 24/10/2026, sobre os
mesmos 130.519 candidatos:

| | Critério do B-60 | Carência corrigida (primeira carga) | Carência sem estado (descartada) |
| --- | --- | --- | --- |
| Lançados há 180 dias ou mais | 13.092 | 13.092 | 13.092 |
| Lançados há menos de 180 dias | 965 | 965 | 5.908 |
| Por lançar, com data | 3.151 | 3.151 | 3.151 |
| Por lançar, sem data | 2.842 | 2.842 | 2.842 |
| **Total** | **20.050** | **20.050** | **24.993** |

Fora a carência, o critério do B-13 decide igual ao do B-60: a lista `reviewedCompanies`
só controla alertas. A diferença para os 20.014 jogos do B-60 (23/10) vem da IGDB, que
ganhou jogos em um dia. Os 965 recentes já tinham sinal de interesse e já estavam no
catálogo antes da carência.

## País do estúdio (B-56)

O país vem da desenvolvedora na IGDB. Quando falta, vem do Wikidata, cruzando pelo
identificador da IGDB (P5794, que é o slug do jogo), e a origem fica em
`Game.studioCountrySource` (`IGDB` ou `WIKIDATA`). No Wikidata, vale o país da
desenvolvedora (P178 → P17) e, só quando ele não existe, o país de origem do jogo (P495).
Mais de um país distinto é ambíguo e fica sem país. Uma consulta SPARQL traz o catálogo
inteiro em cerca de 6 segundos.

**A IGDB vem primeiro.** Nos 3.224 jogos em que as duas fontes informam, o Wikidata diverge
em 148 (4,6%), e os erros aparecem dos dois lados: *Cuphead* e *Rogue Legacy* são de
estúdios canadenses, e a IGDB diz Estados Unidos e Holanda; *Ridiculous Fishing* é da
Vlambeer, holandesa, e o Wikidata diz Estados Unidos.

**Se o Wikidata falhar**, a ingestão segue, mantém os países que já tinham vindo dele e
registra o motivo no resumo da execução: é um enriquecimento, não pode derrubar a ingestão
nem apagar dados.

Cobertura na carga local de 24/10/2026, sobre 20.054 jogos:

| Origem | Jogos | Cobertura |
| --- | --- | --- |
| IGDB | 7.862 | 39,2% |
| Wikidata | 1.731 | 8,6% |
| **Com país** | **9.593** | **47,8%** |
| Não informado | 10.461 | 52,2% |

Outros 14 jogos ficaram sem país por ambiguidade. Os estúdios brasileiros passam de 205 para
250 jogos (45 pelo Wikidata), e 48 países chegam ao mínimo de 20 jogos que a regra de portão
do filtro exige (B-21). O M0 estimava cerca de 50% de cobertura, a partir de uma amostra de
2.000 jogos.

## Alertas de revisão (`IngestionReviewFlag`)

| Tipo | Quando |
| --- | --- |
| `NO_EFFECT_STUDIO` | Jogo do catálogo de estúdio "sem efeito atual" é do ano da compra em diante (ou não tem data e a execução é) |
| `PARENT_OUTSIDE_MAJORS` | Desenvolvedora com empresa-mãe na IGDB fora da lista de grandes e não revisada |
| `PARENT_MAJOR_NOT_CONTROLLED` | Desenvolvedora sob uma grande, fora dos estúdios controlados e não revisada |
| `RELEASE_DATE_ASSIGNED` | Jogo gravado sem data ganhou data de lançamento |
| `VERDICT_CHANGED` | A reavaliação mudou o jogo de lado; o detalhe diz se a versão do critério mudou e se a saída foi pelo fim da carência pós-lançamento |
| `LEFT_CANDIDATE_SET` | Jogo do catálogo não voltou na busca; o detalhe separa `LOST_INDIE_GENRE`, `OUT_OF_SCOPE` e `NOT_FOUND` |

Os alertas de empresa não dependem de histórico: disparam enquanto a empresa não estiver
em `reviewedCompanies` (`config/indie-criteria.json`). Revisar o caso é registrar a
decisão lá. Os de transição comparam o jogo com o que estava gravado.

## Popularidade

O "Want to Play" da IGDB é a fração da base de usuários que marcou o jogo, não uma
contagem. A execução usa como unidade `u` a menor fração positiva do catálogo aceito,
confere que todo valor é múltiplo inteiro dela e calcula
`pop_j = log(1 + p_j/u) / log(1 + p_max/u)`, com `p_max` do catálogo aceito. O jogo guarda a
contagem (`popularityCount`), e a execução guarda a unidade. A unidade, o
máximo e a mediana da contagem ficam no `IngestionRun`. A premissa de que a menor fração
corresponde a uma pessoa vale porque milhares de jogos têm contagem 1; se a quantização
mudar, a execução falha em vez de normalizar errado.

## Cargas reais (banco local, 24/10/2026)

Duas execuções seguidas com a regra corrigida, a partir do banco vazio:

| | Primeira | Segunda |
| --- | --- | --- |
| Duração | 6 min 57 s | 6 min 31 s |
| Gravação | 16 s | 8 s |
| Pico de memória | 541 MB | 559 MB |
| Conjunto candidato | 130.519 jogos, nenhum fora do schema | igual |
| Catálogo | 20.050 jogos | 20.050 jogos, nenhum regravado |
| Popularidade | unidade 1/882.912, máximo 764 pessoas, mediana 5 | igual |
| Banco | 68 MB, dos quais 26 MB em `GameFeature` (189 mil linhas) | 68 MB, nenhuma linha morta |
| Alertas | 1 `PARENT_OUTSIDE_MAJORS`: IoStudios sob indie.io (*Biosphere Simulator*) | o mesmo |

As cinco empresas que apareceram com a carência sem estado (Polyp's Pond, AGE Zero, ProGen
Games, Inspector Studios e Cathedral Studios) não geram mais alerta: só tinham jogos que
aquela carência admitia.

**O crescimento entre dias não foi medido.** A IGDB recalcula o "Want to Play" todo dia, e a
unidade muda com a base de usuários (1/881.744 em 23/10, 1/882.912 em 24/10). Por isso o
jogo guarda a **contagem reconstruída** (`popularityCount`), que não muda quando a base
cresce: um jogo com 5 pessoas continua com 5. A fração da IGDB se recupera multiplicando a
contagem pela unidade da execução (`IngestionRun.popularityUnit`). O `popularityNorm` só
muda quando muda a contagem do jogo ou o máximo do catálogo.

Os pesos de `GameFeature` continuam sendo regravados quando o catálogo muda: um jogo a mais
ou a menos muda o N, todos os IDF e todos os pesos (a tabela tem 189 mil linhas e 26 MB). A
medição entre dias está na seção "Execução em outro dia". Pergunta para o B-31: se o índice de
recomendação é montado em memória na API, é preciso persistir `tfidfWeight`? O IDF em
`Feature` (cerca de 4 mil linhas) basta para reconstruir os pesos na inicialização.

## Carga em produção (Neon, 24/10/2026, B-14)

Duas execuções do workflow "Ingestão" no mesmo dia:

| | Primeira (carga inicial) | Segunda |
| --- | --- | --- |
| Duração do workflow | 4 min 4 s | — |
| Duração da execução (`IngestionRun`) | — | 2 min 51 s |
| Gravação | 8 s | — |
| Conjunto candidato | 130.520 jogos, nenhum fora do schema | 130.520 |
| Catálogo | 20.051 jogos | 20.051 jogos: 14.057 lançados, 3.152 por lançar com data e 2.842 sem data |
| Popularidade | — | máximo 764 pessoas, mediana 5 |
| Alertas | 0 | 0 |
| Banco | — | 69 MB; `GameFeature` 26 MB (188.779 linhas), `GameLanguage` 15 MB, `Game` 14 MB |

Painel de uso do Neon no mesmo dia (período desde 30/09/2026, plano gratuito): 2,94 CU-h de
computação, de 100 por mês; 32,44 MB de armazenamento e 1,4 MB de histórico (retenção de
6 horas); 648 kB de tráfego de saída. O armazenamento é calculado pelo Neon e o painel não é
atualizado em tempo real, por isso difere dos 69 MB de `pg_database_size`; os dois ficam
registrados, cada um com a sua origem.

Na segunda execução, só 3 linhas de `Game` foram regravadas, as dos jogos que mudaram na
IGDB entre as duas, e nenhuma tabela de ligação ganhou linha morta. As 28 linhas mortas de
`Language` vêm do seed do job de migrations, que regrava os idiomas a cada merge na `main`.
No primeiro resumo, o `psql` falhou ao validar o certificado do Neon (`sslmode=verify-full`),
o que foi corrigido no #29; a ingestão não foi afetada.

## Execução em outro dia (Neon, 25/10/2026)

Primeira execução em dia diferente da anterior (24 → 25/10), já com o país pelo Wikidata:

| | |
| --- | --- |
| Duração da execução | 7 min 18 s |
| Catálogo | 20.056 jogos (+5): 14.058 lançados, 3.154 por lançar com data e 2.844 sem data |
| País do estúdio | 39,2% pela IGDB, 8,6% pelo Wikidata, 52,2% não informado, igual à carga local |
| Alertas | 0 |
| Banco | 84 MB (eram 69 MB) |

Linhas regravadas:

- **`Game`: 2.130.** Cerca de 1.731 são os jogos que ganharam país pelo Wikidata, efeito de
  uma vez só; o resto são jogos que mudaram de fato. A unidade da popularidade mudou entre
  os dias, e a contagem gravada no jogo evitou regravar as 20 mil linhas.
- **`GameFeature`: 135.364 de 188.807 (72%).** O catálogo ganhou 5 jogos, o N mudou, e com
  ele todos os IDF e os pesos. Só ficaram iguais os pesos que não dependem do IDF: os de
  blocos com um único atributo, que valem a fatia inteira do bloco.
- **`Feature`: 2.593**, os IDF recalculados.

Quase toda execução muda o catálogo em alguns jogos, então cada uma regrava cerca de 135 mil
linhas de `GameFeature`. O autovacuum reaproveita o espaço, e o tamanho deve estabilizar perto
do dobro da tabela viva, longe do limite de 1 GB do Neon. O dado responde à pergunta do B-31:
os pesos persistidos são regravados quase inteiros a cada execução, enquanto o IDF de
`Feature` (cerca de 4 mil linhas) basta para reconstruí-los na inicialização da API.

## Medições para decisões pendentes (B-61)

**Quanto da carência se resolve sozinha.** O destino dos 3.151 jogos "por lançar" com data
só aparece nas execuções depois da carga. Aproximação pelos jogos já lançados, com ficha
completa e conteúdo aceito, sem sinal de interesse hoje: 83,6% dos lançados há até 180
dias, **86,1% dos lançados há 180 a 365 dias e 88,9% dos lançados há 1 a 2 anos**. Se o
padrão se repetir, a maioria dos jogos da carência sai do catálogo ao fim dela. É esse
dado que embasa manter ou tirar a carência.

**"Want to Play" como sinal de interesse** (não implementado). Entre os 89.793 candidatos
rejeitados só por falta de sinal:

| | Rejeitados | "Want to Play" > 0 | Contagem ≥ 2 | Contagem ≥ 5 |
| --- | --- | --- | --- | --- |
| Lançados antes de 2015 | 2.487 | 643 | 336 | 76 |
| Lançados desde 2015 | 69.360 | 17.266 | 8.114 | 2.394 |
| Por lançar, sem data | 17.946 | 2.477 | 761 | 94 |
| **Total** | **89.793** | **20.386** | **9.211** | **2.564** |

Aceitar qualquer valor positivo dobraria o catálogo; com contagem mínima de 5, ele
cresceria cerca de 13%. A decisão é do B-61, ao lado da medição da carência.
