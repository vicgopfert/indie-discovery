# Avaliação offline do recomendador (B-37, F-14)

Protocolo da seção 12 da proposta técnica ("Avaliação da qualidade"), com as decisões do plano do
B-37, aprovado pelo autor em 11/11/2026, e os dois acréscimos de método dele: a estratificação por
tipo de atributo e o intervalo de confiança por *bootstrap*. O script é reproduzível a partir do
repositório. A configuração da avaliação está em `apps/api/config/evaluation.json`, e a do
recomendador em `apps/api/config/recommendation.json`.

## Rodadas

1. **Rodada 1, linha de base:** a configuração atual contra as duas linhas de base e contra a lista
   única, sem decidir nada. Dá a tabela da seção 12 e a escala dos números.
2. **Pausa:** o autor fixa os limiares numéricos das regras de calibração (seção "Regras da rodada
   2") antes de qualquer variante ser medida.
3. **Rodada 2, calibração:** uma regra por parâmetro, na ordem limite das prateleiras → fatias e
   normalização → λ → β, com cada valor fixado antes do seguinte.
4. **Rodada 3, tabela final:** a configuração escolhida, que é a tabela do TCC, e a foto completa das
   respostas com quantas mudaram.

## Método

### Execução

- `pnpm --filter @indie/api build` e, em `apps/api`, `pnpm recommendations:evaluate <saída>`
  (`src/evaluate-recommendations.ts`). Grava `<saída>.md` com as tabelas e `<saída>.json` com todos
  os números. Com `--round 2`, aplica as regras da rodada 2 na ordem a → b → c → d, cada uma
  sobre os valores escolhidos pelas anteriores, e calcula só as listas que cada regra compara.
- **Em memória, sem contas:** o script lê o catálogo do banco local uma vez e chama o núcleo de
  pontuação (`recommend`, com `only: 'main'`) para cada perfil, como o caso de uso faz. Recusa outro
  banco que não o local e não grava nada nele.
- **Variantes do vetor:** as fatias e a normalização mudam só a montagem do índice, a partir das
  mesmas linhas do banco (`buildContentIndex`), sem nova ingestão. Os limites de frequência do
  TF-IDF exigiriam nova carga e ficam fora (decisão 8).
- **Lista única:** a mesma pontuação com 1 interesse no máximo. Com menos de 2 interesses, a
  principal é a ordem da pontuação, sem intercalar (B-71).
- **Determinismo:** a mesma execução dá o mesmo hash dos resultados. O e2e do B-36 já confere o
  determinismo na rota.

### Famílias de perfis

| Família | Como é montada | Para que serve |
| --- | --- | --- |
| A, por atributo | Para gêneros, temas e etiquetas de gênero ou subgênero com ao menos 20 jogos, o mesmo número de perfis por tipo (360; eram 120 na primeira execução da rodada 1), distribuídos em rodízio pelos atributos em ordem sorteada. Cada perfil avalia 4 jogos com o atributo (notas 5, 5, 4, 4) e 2 sem ele (1, 2). Cada jogo bem avaliado é escondido uma vez | Acerto por omissão contra as linhas de base, por tipo |
| B, coerentes | 600 perfis por amostragem, montados como os 200 do B-77, que são os 200 primeiros da amostragem uniforme (eram 200 até a regra c da rodada 2): 4 jogos de uma etiqueta (5, 5, 4, 4) e 2 de outra (5, 4), entre as etiquetas que podem virar prateleira em até 10% do catálogo. O jogo escondido sai uma vez do gosto principal e uma vez do secundário | Cobertura dos interesses; lista única × intercalada; C5 |
| C, partida a frio | 200 perfis com 3 preferências entre as opções da partida a frio (gêneros, temas e etiquetas), com uma etiqueta acima de 10% do catálogo a cada 10 perfis, e 0 a 4 jogos avaliados (5, 4, 5, 4), os primeiros da lista de jogos para avaliar | β e cobertura das preferências |
| D, semente 71 | Os 400 perfis das medições anteriores: 200 com 4 jogos sorteados do catálogo (5, 5, 4, 1) e 200 com 3 gêneros ou temas preferidos | Continuidade (ARP, cobertura, C4), sem acerto por omissão |

- **Por que o mesmo número de perfis por tipo:** um perfil montado por um tipo de atributo favorece
  a fatia desse tipo no vetor. Um perfil de gênero, por exemplo, sobe com uma fatia maior de
  gêneros. Com os três tipos em proporção igual e o acerto por tipo, uma fatia só pode ganhar se
  ganhar nos três (acréscimo do autor ao plano).
- **Duas amostragens nas famílias A e B:** os jogos do perfil saem de um sorteio uniforme entre os
  jogos do atributo, que dá quase sempre jogos pouco conhecidos, e de um sorteio proporcional ao
  `popularityCount`, que dá quase sempre os conhecidos. São os dois extremos de uma biblioteca
  real. Uma conclusão só vale se aparecer nos dois (decisão 3). O sorteio uniforme da família B
  refaz exatamente os perfis do B-77.

### Métricas

O top-20 é a primeira página do "ver mais" da lista principal.

| Métrica | Definição |
| --- | --- |
| Acerto@10 e @20 | Fração dos jogos escondidos que voltam entre os 10 ou 20 primeiros da lista montada sem eles. O @20 é o da seção 12; o @10, o critério das variantes do vetor (decisão 4) |
| Cobertura do catálogo@20 | Fração do catálogo que aparece em algum top-20 da família |
| ARP@20 | Média, entre os perfis, da popularidade normalizada (`pop_j`) média do top-20 |
| Em breve@20 | Fração dos itens do top-20 que são "em breve" |
| Interesses@20 | Média, entre os perfis, da fração dos interesses do perfil (as prateleiras escolhidas por `pickInterests`) com algum jogo no top-20 (decisão 5) |
| Gêneros e temas@20 | A definição antiga da seção 12: a mesma conta com os gêneros e temas de componente positiva no perfil. Fica como registro |
| Preferências@20 | A mesma conta com as preferências da partida a frio (família C) |
| Pouco conhecido@20 | Fração dos itens do top-20 do Descobertas marcados "pouco conhecido", pela regra da página |
| Sobreposição | Fração de jogos em comum entre os top-20 de dois modos do mesmo perfil |

### Linhas de base

- **Aleatória:** 20 jogos com vetor e fora da biblioteca, com semente por perfil e jogo escondido.
- **Populares dos gêneros e temas (alternativa 1 da seção 12):** os mais populares que têm algum
  gênero ou tema dos jogos com nota 4 ou mais, ou alguma preferência. Usa o mesmo caminho da lista
  dos perfis sem componente positiva (`popularFallback`).

### Intervalo de confiança

Para cada comparação de acerto, o intervalo de 95% da diferença sai de um *bootstrap* pareado sobre
os perfis (acréscimo do autor ao plano):

- os perfis são sorteados com reposição 2.000 vezes, com semente 71 (`bootstrap` em
  `config/evaluation.json`);
- em cada sorteio, as duas listas são recalculadas nos mesmos perfis, como acertos sobre jogos
  escondidos;
- o intervalo vai do percentil 2,5 ao 97,5 das diferenças.

Na rodada 2, um limiar só conta como atingido se o intervalo inteiro estiver do lado da melhora.

### Critérios C1 a C5

Os critérios do B-77, com os limites mantidos no B-79 (`docs/etiquetas.md`, seção 6), saíram do
protótipo fora do repositório (`conformance.mts`, B-79) e vieram para `src/evaluation/criteria.ts`.
O código agora roda sobre a implementação: `pickInterests`, `recommend` e a visão geral do modo
Equilibrado.

## Rodada 1: linha de base (11/11/2026, refeita em 13/11/2026)

- **Configuração:** a de `config/recommendation.json` na `main` em `ffb91bb` (λ de −0,2, 0 e 0,3; β = 1; fatias 40/30/30; limite das prateleiras de 10%).
- **Dados:** catálogo local de 23.001 jogos e 399 atributos. 5.829 jogos (25,3%) são "em breve", com popularidade média de 0,153, contra 0,299 dos lançados.
- **Tamanho e tempo:** a primeira execução, com 120 perfis por tipo na família A e 200 por amostragem na B, teve 1.720 perfis e 3.680 jogos escondidos, em cerca de 9 minutos. As tabelas abaixo são da execução refeita com os tamanhos da rodada 2 (360 por tipo na família A e 600 por amostragem na B): 3.960 perfis e 11.440 jogos escondidos, em 24 minutos, ao lado da foto completa das respostas.
- **Determinismo:** duas execuções seguidas da primeira versão deram o mesmo hash dos resultados (`e04ced52…`). O hash da execução refeita é `cffa3889…`.
- **Perfis da família A:** 360 por tipo, que cobrem os 22 gêneros, os 21 temas e as 131 etiquetas de gênero ou subgênero elegíveis (com 120, eram 120 das 131).

### Acerto@20 (acerto@10)

| Método | A, uniforme | A, popularidade | B, uniforme | B, popularidade | C |
| --- | --- | --- | --- | --- | --- |
| Populares, intercalada | 7,22% (3,75%) | 12,57% (8,03%) | 2,33% (0,92%) | 6,00% (3,67%) | 18,75% (13,50%) |
| Equilibrado, intercalada | 7,27% (3,84%) | 7,73% (4,17%) | 2,67% (1,58%) | 2,42% (1,17%) | 6,50% (3,00%) |
| Descobertas, intercalada | 6,30% (3,61%) | 3,31% (1,25%) | 2,83% (1,67%) | 0,92% (0,25%) | 1,75% (0,00%) |
| Populares, lista única | 6,23% (3,40%) | 11,71% (7,64%) | 1,58% (0,75%) | 3,50% (2,25%) | 8,25% (4,75%) |
| Equilibrado, lista única | 6,41% (3,61%) | 7,18% (3,75%) | 1,50% (1,00%) | 1,25% (0,92%) | 0,25% (0,25%) |
| Descobertas, lista única | 5,51% (3,10%) | 2,52% (0,97%) | 0,83% (0,75%) | 0,25% (0,17%) | 0,00% (0,00%) |
| Aleatório | 0,07% (0,02%) | 0,12% (0,02%) | 0,08% (0,08%) | 0,08% (0,08%) | 0,00% (0,00%) |
| Populares dos gêneros e temas (alternativa 1) | 0,14% (0,05%) | 2,36% (1,25%) | 0,25% (0,00%) | 1,17% (0,67%) | 38,75% (26,75%) |

Na família A, pelo tipo de atributo, no Equilibrado intercalado, acerto@20 (acerto@10):

| Amostragem | Gênero | Tema | Etiqueta |
| --- | --- | --- | --- |
| Uniforme | 8,89% (5,28%) | 3,54% (1,67%) | 9,38% (4,58%) |
| Pela popularidade | 10,07% (5,21%) | 3,54% (1,81%) | 9,58% (5,49%) |

### Popularidade, cobertura e "em breve" (listas intercaladas, @20)

| Medida | Modo | A, uniforme | A, popularidade | B, uniforme | B, popularidade | C | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ARP | Populares | 0,469 | 0,487 | 0,484 | 0,521 | 0,480 | 0,453 |
| ARP | Equilibrado | 0,276 | 0,301 | 0,281 | 0,323 | 0,290 | 0,240 |
| ARP | Descobertas | 0,102 | 0,113 | 0,086 | 0,095 | 0,106 | 0,080 |
| Cobertura do catálogo | Populares | 35,5% | 32,6% | 23,1% | 21,9% | 11,1% | 21,2% |
| Cobertura do catálogo | Equilibrado | 46,2% | 43,0% | 30,0% | 29,7% | 12,6% | 24,0% |
| Cobertura do catálogo | Descobertas | 34,7% | 32,8% | 22,4% | 22,4% | 11,5% | 19,0% |
| Em breve | Populares | 9,9% | 8,7% | 13,1% | 9,0% | 11,8% | 12,2% |
| Em breve | Equilibrado | 22,7% | 20,9% | 27,5% | 22,5% | 24,6% | 23,9% |
| Em breve | Descobertas | 39,8% | 39,7% | 48,3% | 47,0% | 42,0% | 37,2% |
| Pouco conhecido | Descobertas | 46,7% | 47,9% | 53,9% | 57,4% | 46,0% | 45,2% |
| Sobreposição Equilibrado × Descobertas | — | 53,3% | 52,1% | 46,1% | 42,6% | 54,0% | 54,8% |
| Sobreposição Populares × Equilibrado | — | 57,2% | 58,7% | 52,8% | 54,6% | 59,1% | 54,1% |

A cobertura do catálogo depende do número de perfis do grupo: as famílias A e B, com 1.080 e 600
perfis, cobrem mais que a C e a D, com 200 e 400. Ela só compara modos dentro do mesmo grupo.

As linhas de base, para comparação: a aleatória tem ARP de 0,26 a 0,27, cobertura de 16% a 61% e
24% a 26% de "em breve", perto da fração do catálogo; a alternativa 1 tem ARP de 0,90 a 0,93,
cobertura de 0,1% a 2% e quase nenhum "em breve".

### Lista intercalada × lista única

| Grupo | Interesses@20, intercalada / única (Equilibrado) | Diferença de acerto@20 no Equilibrado [intervalo de 95%] |
| --- | --- | --- |
| A, uniforme | 99,8% / 94,4% | +0,86 [+0,37; +1,32] |
| A, popularidade | 99,9% / 94,3% | +0,56 [+0,09; +1,06] |
| B, uniforme | 100% / 79,8% | +1,17 [+0,50; +1,92] |
| B, popularidade | 100% / 81,9% | +1,17 [+0,50; +1,83] |
| C (preferências@20: 100% / 72,0%) | 100% / 75,9% | +6,25 [+3,86; +8,66] |
| D | 99,1% / 94,3% | — |

Diferenças em pontos percentuais. Os três modos e os estratos estão no relatório completo do script.

### O que a rodada 1 mostra

Com os tamanhos da rodada 2. Onde a primeira execução, com 120 perfis por tipo e 200 por
amostragem, dizia outra coisa, a diferença está anotada.

1. **Contra as linhas de base (famílias A e B):** nos três modos, nas duas amostragens e nos três
   estratos, a lista intercalada acerta mais que a aleatória no @20, com o intervalo acima de zero.
   Contra a alternativa 1, o intervalo fica acima de zero nas duas amostragens uniformes, em todos os
   modos e estratos. Na amostragem pela popularidade:
   - o Equilibrado empata no estrato de tema da família A (−0,49 [−2,01; +0,97]);
   - o Descobertas empata na família B (−0,25 [−1,08; +0,50]) e perde no estrato de tema da família
     A (−3,13 [−4,24; −2,01]). Com 120 perfis por tipo, esse estrato dava empate ([−3,75; 0,00]).
     É esperado, e fica registrado sem ação (decisão do autor, 16/11/2026): o jogo escondido
     sorteado pela popularidade tende a ser popular, que é o que a alternativa 1 devolve.
2. **A família C não serve para comparar com a alternativa 1.** Os jogos escondidos são os primeiros
   da lista de jogos para avaliar, isto é, os mais populares das preferências, que é exatamente o que
   a alternativa 1 devolve. Ela ganha por construção (−20,00 a −37,00 pontos, com o intervalo abaixo
   de zero). O acerto da família C só vale para comparar variantes pareadas, como o β.
3. **Intercalada × única:** a intercalada cobre quase todos os interesses do perfil. A única deixa de
   fora cerca de 6% deles na família A e de 18% a 24% nas famílias B e C, que têm dois gostos ou
   preferências. O acerto@20 sobe com o intervalo acima de zero nas 15 combinações de grupo agregado
   e modo (eram 9 de 15 na primeira execução). Nos estratos da família A, nenhum intervalo fica
   inteiro abaixo de zero, mas no de gênero a intercalada fica abaixo da única no ponto medido em 5
   das 6 combinações de modo e amostragem, e o intervalo do Descobertas uniforme toca o zero (−0,76
   [−1,60; 0,00]). Fica registrado sem ação (decisão do autor, 16/11/2026): os perfis da família A
   são de um gosto só e não têm o que ganhar com a intercalação; nos agregados, ela ganha nas 15
   combinações.
4. **Modos:**
   - **ARP:** a ordem Populares > Equilibrado > Descobertas aparece em todas as famílias, com cerca de
     0,2 entre um modo e o seguinte, o que a seção 12 espera.
   - **Cobertura do catálogo:** a expectativa da seção 12 (maior no Descobertas que no Populares) não
     se confirma. Os dois ficam a menos de 1 ponto um do outro nas famílias A a C, e na D o
     Descobertas fica abaixo (19,0% contra 21,2%). O Equilibrado tem a maior cobertura em todas.
     **Hipótese, não medida:** com λ = 0,3, as listas de perfis diferentes convergem para o mesmo
     grupo de jogos pouco populares.
5. **"Em breve":** no Descobertas, de 37% a 48% do top-20, contra 25,3% do catálogo. No Equilibrado
   fica perto do catálogo, e no Populares abaixo. A seção 12 pede revisar o `p_j` dos não lançados se
   eles dominarem um modo, mas não define "dominar".
6. **"Pouco conhecido":** de 45% a 57% do top-20 do Descobertas, abaixo dos 62% do B-32 (antes das
   etiquetas) e dos 90% do perfil conferido em produção no B-35. A sobreposição com o Equilibrado é
   de 43% a 55%.
7. **Critérios C1 a C5:** iguais aos do protótipo do B-79 no mesmo catálogo. O C1 revisado continua
   não passando com o limite de 10%; C2 a C5 passam (C5: 100%, 88,0% e 0%). A frequência mediana das
   prateleiras mostradas é de 3,4% do catálogo, e 5,1% delas passam de 10% (os atributos largos da
   IGDB).
8. **Escala dos intervalos:** na comparação intercalada × única da família A, a meia-largura do
   intervalo da diferença de acerto@10 vai de 0,2 a 0,8 ponto nos estratos e de 0,2 a 0,4 no
   agregado, para acertos de 0,3% a 10%. Contra as linhas de base, chega a 2,3 pontos nos estratos.

## Regras da rodada 2

As formas foram aprovadas no plano (decisão 6). Os limiares foram fixados pelo autor em 13/11/2026,
depois da rodada 1 e antes de medir qualquer variante, e estão em `rules` em
`config/evaluation.json`. As regras são aplicadas na ordem a → b → c → d, cada uma sobre os
valores escolhidos pelas anteriores.

- **Intervalos:** toda condição, de acerto ou não, só conta como atingida se o intervalo de 95% do
  *bootstrap* pareado sobre os perfis estiver inteiro do lado dela (acréscimo do autor). Isso inclui
  a diferença de ARP, o "pouco conhecido", as coberturas e a razão de acerto.
- **Modo das regras b e d:** o Equilibrado, o padrão, em que λ = 0 e a lista sai só da semelhança.
  O λ é calibrado depois.
- **Tamanho:** a família A passou de 120 para 360 perfis por tipo antes da rodada 2, e a rodada 1
  foi refeita com esse tamanho. A família B passou de 200 para 600 perfis por amostragem antes de
  refazer a regra c (decisão do autor em 13/11/2026): com 200, a família B uniforme tinha 7
  acertos@20 do Equilibrado, pouco para a razão de acerto. O C5 continua nos 200 primeiros perfis
  uniformes, os do B-77, que o sorteio sequencial mantém iguais.
- **Cobertura do catálogo na regra c:** a cobertura conta os jogos distintos do grupo, e o
  *bootstrap* com reposição repete perfis e puxa o intervalo para zero. Na primeira medição da regra
  c, o valor medido caiu fora do próprio intervalo (−0,80 ponto com [−0,70; −0,03]). Por decisão do
  autor (13/11/2026), o intervalo dessa condição sai de subamostras de metade dos perfis, sem
  reposição, com as duas listas na mesma subamostra; a condição é decidida pela diferença
  Descobertas − Populares nas subamostras.

| Regra | Parâmetro e grade | Regra e limiares |
| --- | --- | --- |
| a | Limite de frequência das prateleiras: 10%, 15%, 20% | Adota o menor que passa no C1 revisado mantendo C2 a C5. Se nenhum passar, fica 10% e o C1 continua como limitação. A especificidade é só registrada. Os limites do C1 a C5 são os do B-77 |
| b | Fatias 40/30/30, 34/33/33, 30/30/40, 50/25/25, 25/25/50 e normalização global | Troca só se o intervalo da diferença de acerto@10 contra a configuração atual ficar inteiro acima de zero nas 8 combinações (gênero, tema e etiqueta da família A, nas duas amostragens, mais a família B nas duas amostragens), e o intervalo da diferença de cobertura dos interesses@20 não ficar inteiro abaixo de zero nelas. Caso contrário, 40/30/30 |
| c | λ do Descobertas: 0,05 a 0,3; do Populares: −0,05 a −0,3 | O maior λ, em valor absoluto, que cumpre em todas as combinações das famílias A e B, nas duas amostragens. **Descobertas:** ARP Populares > Equilibrado > Descobertas, com diferença mínima de 0,05; "pouco conhecido" no top-20 ≤ 50%; acerto@20 ≥ 0,7 vez o do Equilibrado; cobertura do catálogo@20 ≥ a do Populares. **Populares:** a mesma diferença de ARP e acerto@20 ≥ 0,7 vez o do Equilibrado. Se nenhum valor passar, vale a reserva abaixo, com as condições que falharam registradas |
| d | β: 0,5, 1, 2 | Entre os valores com cobertura das preferências@20 ≥ 95% na família C, troca só se outro valor tiver acerto@20 maior que o de β = 1, com o intervalo da diferença inteiro acima de zero |
| — | "Em breve" | Domina um modo se passar de 50% do top-20, e então o `p_j` dos não lançados é revisto (seção 12). Abaixo disso, só é registrado |

### Reserva da regra c (fixada em 13/11/2026, 12:42, antes de refazer a regra c)

Fixada pelo autor depois da primeira medição da regra c e antes de refazê-la; está em
`rules.lambda.fallbackRationale` em `config/evaluation.json`. Vale para o Descobertas e para o
Populares.

1. Se algum valor da grade passar em todas as condições, vale a regra como está: o maior λ em valor
   absoluto.
2. Se nenhum passar: entre os valores da grade que cumprem toda condição que o λ atual cumpre, pelo
   ponto medido e pelo intervalo, adota-se o que falha em menos condições; no empate, o de maior
   |λ|.
3. Se nenhum valor cumprir isso, fica o λ atual.

**Motivo:** na primeira medição, a reserva "fica o λ atual" manteria o pior valor da grade. No
Descobertas, 0,3 falhou em 4 condições, e 0,1 falhou em 1, com a razão de acerto medida em 0,71 e
o intervalo [0,65; 0,77]. A reserva existia para não trocar sem evidência, e a evidência contra o
valor atual é a mais forte da medição. É a mesma lógica da exceção do B-77, aqui fixada antes de
medir.

### Regra c por pares (fixada em 16/11/2026, 11:20, antes de refazer a regra c)

Fixada pelo autor depois da rodada 3 e antes de refazer a regra c; está em
`rules.lambda.pairRationale` em `config/evaluation.json`. A regra, os limiares, os intervalos e a
grade não mudam; muda a forma de aplicá-la.

1. Avaliam-se os 20 pares da grade: Descobertas {0,05; 0,1; 0,15; 0,2; 0,3} × Populares {−0,05;
   −0,1; −0,2; −0,3}. Todas as condições da regra c são calculadas sobre o par, nas famílias A e B
   e nas duas amostragens, com os mesmos intervalos.
2. Se algum par passar em tudo, escolhe-se o de maior |λ| do Descobertas e, no empate, o de maior
   |λ| do Populares.
3. Se nenhum passar, vale a reserva aplicada aos pares: entre os pares que cumprem toda condição
   que o par atual (0,3; −0,2) cumpre, pelo ponto medido e pelo intervalo, adota-se o que falha em
   menos condições; no empate, o de maior |λ| do Descobertas e depois o do Populares. Se nenhum par
   cumprir isso, fica o par atual.

**Motivo:** as condições referem-se à configuração inteira. A ordem de ARP e a cobertura do
Descobertas ≥ a do Populares envolvem os dois modos, e a primeira aplicação avaliou cada modo com o
valor antigo do outro. Com os dois valores escolhidos juntos (0,2; −0,05), a cobertura do
Descobertas ficou abaixo da do Populares em todas as combinações das famílias A e B (rodada 3). É
correção da aplicação da regra, sem mudar critérios nem a grade.

## Rodada 2: calibração (13/11/2026)

`pnpm recommendations:evaluate <saída> --round 2`, com a família A em 360 perfis por tipo e a B em
200 por amostragem; a regra c foi refeita depois com a família B em 600 e a reserva
(`--rule c`). O relatório completo, com todos os intervalos, sai do script.

| Regra | Resultado | Decisão do autor |
| --- | --- | --- |
| a, limite das prateleiras | O C1 revisado não passa com 10%, 15% nem 20%; C2 a C5 passam nos três | Fica 10%, e o C1 continua como limitação |
| b, fatias e normalização | Nenhuma variante passa nas 8 combinações; a de menos falhas tem 5 das 16 | Fica 40/30/30 |
| c, λ | Aplicada por pares (16/11/2026): nenhum dos 20 pares passa em tudo, e a reserva escolhe (0,2; −0,3) (ver abaixo) | λ de 0,2 no Descobertas e −0,3 no Populares |
| d, β | β = 0,5 piora o acerto@20 da família C (−2,75 [−4,52; −1,19]); β = 2 melhora sem o intervalo inteiro acima de zero (+1,25 [−0,25; +2,93]); a cobertura das preferências fica em 100% nos três | Fica β = 1 |

- **As variantes com mais peso nas etiquetas só melhoram os perfis montados por etiquetas.** 30/30/40,
  25/25/50 e a normalização global melhoram o acerto@10 do estrato de etiqueta com o intervalo acima
  de zero (até +2,08 [+0,97; +3,26]), mas não o de tema nem a família B. É o viés que a
  estratificação foi feita para pegar: sem ela, o ganho na etiqueta puxaria o agregado da família A
  e trocaria as fatias. A 50/25/25 piora a etiqueta (−1,11 [−1,81; −0,49]).
- **C1 a C5 não mudam** em nenhuma variante das regras b e d. As prateleiras saem quase todas do bloco
  de etiquetas, e as fatias e o β não mudam a ordem dentro dele.
- **"Em breve"** não domina nenhum modo: o máximo é 48,7% do top-20, no Descobertas da família B
  uniforme. Fica registrado, sem rever o `p_j`.

### Regra c, λ

A regra c foi aplicada duas vezes. A primeira, modo a modo, mediu cada λ com o valor antigo do
outro modo e escolheu (0,2; −0,05). Com os dois juntos, a cobertura do Descobertas ficou abaixo da
do Populares (rodada 3 de 13/11/2026), e o autor fixou a aplicação por pares antes de refazê-la.
Vale a segunda.

#### Por pares (16/11/2026)

`--round 2 --rule c`, com os 20 pares e as 24 condições de cada um (6 por combinação das famílias
A e B), em 33 minutos, com o hash dos resultados `cb08f649…`. As listas de cada valor são as mesmas
da primeira aplicação; só a combinação muda. Os pares (0,3; −0,2) e (0,2; −0,2) repetem as falhas
medidas modo a modo (8 + 1 e 2 + 1).

Condições que falham, de 24, por par. Em negrito, os pares que cumprem toda condição que o par atual
cumpre, pelo ponto medido e pelo intervalo:

| Descobertas \ Populares | −0,05 | −0,1 | −0,2 | −0,3 |
| --- | --- | --- | --- | --- |
| 0,05 | 4 | 4 | 4 | 4 |
| 0,1 | 6 | **3** | **3** | **3** |
| 0,15 | 6 | 6 | **3** | **3** |
| 0,2 | 6 | 7 | **3** | **3, escolhido** |
| 0,3 | 8 | 9 | **9, atual** | **5** |

- **Nenhum par passa em tudo.** Sete pares empatam na reserva com 3 falhas, e as três são as mesmas
  em todos: a razão de acerto do Descobertas na amostragem pela popularidade, nas famílias A e B, e
  a do Populares na família B uniforme. No empate, a regra fica com o maior |λ| do Descobertas e
  depois do Populares: (0,2; −0,3).
- **Fora da reserva:** com o Descobertas em 0,05, falha a diferença de ARP para o Equilibrado, que
  o par atual cumpre. Com o Descobertas de 0,1 a 0,3 e o Populares em −0,05 ou −0,1, a cobertura
  do Descobertas fica abaixo da do Populares em 3 ou 4 das combinações, exceto no par (0,1; −0,1).
- **O par escolhido:**
  - no Descobertas, 0,2 falha na razão de acerto da amostragem pela popularidade: 0,55 [0,48; 0,62]
    na família A e 0,45 [0,27; 0,65] na B;
  - no Populares, −0,3 falha na razão de acerto da família B uniforme, pelo intervalo: 0,72 [0,50;
    0,97]. É o valor da grade com o ponto mais perto do limiar de 0,7 (com −0,2, 0,88 [0,68; 1,10]);
  - a diferença de ARP do Populares para o Equilibrado vai de 0,24 a 0,26 (com −0,2, de 0,19 a
    0,20), e a cobertura do catálogo do Descobertas fica acima da do Populares em todas as
    combinações (de +5,55 a +9,51 pontos no valor medido).

#### Modo a modo (13/11/2026, substituída)

A primeira aplicação, refeita com a família B em 600 perfis por amostragem, a cobertura do catálogo
por subamostras e a reserva fixada antes da medição. Fica como registro.

| Modo | Atual | Escolhido | Caminho |
| --- | --- | --- | --- |
| Descobertas | 0,3 | **0,2** | Nenhum valor passa em tudo. Pela reserva, 0,1, 0,15 e 0,2 cumprem tudo o que 0,3 cumpre e falham em 2 condições, contra 8 do 0,3; no empate, o de maior λ |
| Populares | −0,2 | **−0,05** | É o único valor que passa em todas as condições |

- **Descobertas:** o 0,2 falha só na razão de acerto da amostragem pela popularidade: 0,55 [0,48;
  0,62] na família A e 0,45 [0,27; 0,65] na B. O 0,05 falha na diferença de ARP, por pouco (0,048
  [0,046; 0,050] na família A uniforme). O 0,3 falha também no "pouco conhecido" da família B
  (53,9% e 57,4%) e na cobertura do catálogo: o ponto medido fica abaixo do Populares nas duas amostragens
  uniformes (−0,80 e −0,72 ponto), e nenhum intervalo fica inteiro acima de zero.
- **Populares:** −0,1, −0,2 e −0,3 passam no ponto medido da razão de acerto da família B uniforme
  e falham só pelo intervalo: −0,1 com 0,84 [0,68; 1,00], −0,2 com 0,88 [0,68; 1,10] e −0,3 com
  0,72 [0,50; 0,97]. Mesmo com 600 perfis, a família B uniforme tem poucos acertos, e o intervalo
  da razão fica largo. O −0,05 foi adotado pela regra fixada, por ser o único valor que passa em
  todas as condições. Com ele, o Populares fica mais perto do Equilibrado: a diferença de ARP vai
  de 0,053 a 0,062, acima do mínimo de 0,05 (era de cerca de 0,2 com −0,2). Se os jogadores
  percebem diferença entre os dois modos fica para o teste de usabilidade (B-44).
- **Cobertura por subamostras:** o valor mostrado é a diferença na amostra inteira, e o intervalo é
  o das subamostras de metade dos perfis, em que cada lista cobre menos do catálogo. Por isso o
  valor pode ficar fora do intervalo. A condição é decidida pelo intervalo.
- **"Em breve"** com os λ escolhidos: de 35,3% a 43,6% do top-20 no Descobertas, contra 39,7% a
  48,7% com 0,3; no Populares, de 16,8% a 22,3%, contra 8,6% a 14,6% com −0,2. Nenhum modo passa de
  50%.
- **Erro corrigido no registro do "em breve":** na primeira execução refeita, a tabela do "em breve"
  saiu com o Descobertas de λ = 0,3. Ao juntar a lista escolhida do Populares, o script copiava
  também a do Descobertas da execução de base. A junção passou a copiar só as listas do modo
  escolhido, com teste, e a regra c foi refeita. As condições e as escolhas saíram idênticas, com o
  mesmo hash; só o registro do "em breve" mudou. O erro não teve efeito nas decisões.
- **Decisão do autor (13/11/2026):** confirmados 0,2 no Descobertas, pela reserva fixada antes da
  medição, e −0,05 no Populares, pela regra, sem nova reserva. Substituída em 16/11/2026 pela
  aplicação por pares.

## Rodada 3: tabela final (16/11/2026)

- **Configuração:** a de `config/recommendation.json` com os valores escolhidos na rodada 2: λ de
  −0,3, 0 e 0,2; β = 1; fatias 40/30/30; limite das prateleiras de 10%. Só o λ mudou.
- **Perfis:** os mesmos da rodada 1 refeita (360 por tipo na família A e 600 por amostragem na B,
  aprovado pelo autor também para a tabela final), o que deixa as duas tabelas comparáveis perfil a
  perfil.
- **Execução:** `pnpm recommendations:evaluate <saída>`, em 23 minutos, com o hash dos resultados
  `0834d638…`.
- **Primeira versão (13/11/2026, substituída):** com o par (0,2; −0,05) da regra c modo a modo, a
  cobertura do catálogo do Descobertas ficou abaixo da do Populares em todas as combinações das
  famílias A e B (de −3,0 a −6,1 pontos), e o Populares teve de 83% a 87% de sobreposição com o
  Equilibrado. Isso levou à aplicação da regra c por pares. A foto completa daquela versão mudou
  35.787 respostas.

### Acerto@20 (acerto@10)

O Equilibrado, as listas únicas do Equilibrado e as linhas de base não mudam, porque não usam o λ.
Na linha de baixo de cada modo que muda, o acerto@20 da rodada 1.

| Método | A, uniforme | A, popularidade | B, uniforme | B, popularidade | C |
| --- | --- | --- | --- | --- | --- |
| Populares, intercalada | 6,92% (3,56%) | 14,31% (9,68%) | 1,92% (0,75%) | 7,83% (4,42%) | 30,00% (20,50%) |
| ↳ rodada 1 | (7,22%) | (12,57%) | (2,33%) | (6,00%) | (18,75%) |
| Equilibrado, intercalada | 7,27% (3,84%) | 7,73% (4,17%) | 2,67% (1,58%) | 2,42% (1,17%) | 6,50% (3,00%) |
| Descobertas, intercalada | 6,74% (3,63%) | 4,26% (1,83%) | 2,83% (1,83%) | 1,08% (0,33%) | 2,25% (1,00%) |
| ↳ rodada 1 | (6,30%) | (3,31%) | (2,83%) | (0,92%) | (1,75%) |
| Populares, lista única | 5,83% (3,17%) | 13,31% (8,96%) | 0,83% (0,58%) | 3,75% (2,75%) | 14,25% (10,50%) |
| Equilibrado, lista única | 6,41% (3,61%) | 7,18% (3,75%) | 1,50% (1,00%) | 1,25% (0,92%) | 0,25% (0,25%) |
| Descobertas, lista única | 5,88% (3,24%) | 3,54% (1,53%) | 1,08% (0,75%) | 0,33% (0,17%) | 0,00% (0,00%) |
| Aleatório | 0,07% (0,02%) | 0,12% (0,02%) | 0,08% (0,08%) | 0,08% (0,08%) | 0,00% (0,00%) |
| Populares dos gêneros e temas (alternativa 1) | 0,14% (0,05%) | 2,36% (1,25%) | 0,25% (0,00%) | 1,17% (0,67%) | 38,75% (26,75%) |

### Popularidade, cobertura e "em breve" (listas intercaladas, @20)

Entre parênteses, a rodada 1.

| Medida | Modo | A, uniforme | A, popularidade | B, uniforme | B, popularidade | C | D |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ARP | Populares | 0,530 (0,469) | 0,542 (0,487) | 0,543 (0,484) | 0,575 (0,521) | 0,543 (0,480) | 0,536 (0,453) |
| ARP | Equilibrado | 0,276 | 0,301 | 0,281 | 0,323 | 0,290 | 0,240 |
| ARP | Descobertas | 0,136 (0,102) | 0,150 (0,113) | 0,120 (0,086) | 0,139 (0,095) | 0,144 (0,106) | 0,108 (0,080) |
| Cobertura do catálogo | Populares | 29,3% (35,5%) | 27,1% (32,6%) | 19,4% (23,1%) | 18,5% (21,9%) | 10,1% (11,1%) | 17,9% (21,2%) |
| Cobertura do catálogo | Equilibrado | 46,2% | 43,0% | 30,0% | 29,7% | 12,6% | 24,0% |
| Cobertura do catálogo | Descobertas | 38,8% (34,7%) | 36,5% (32,8%) | 25,0% (22,4%) | 25,3% (22,4%) | 12,1% (11,5%) | 20,5% (19,0%) |
| Em breve | Populares | 7,1% (9,9%) | 6,4% (8,7%) | 9,9% (13,1%) | 6,8% (9,0%) | 9,2% (11,8%) | 8,5% (12,2%) |
| Em breve | Equilibrado | 22,7% | 20,9% | 27,5% | 22,5% | 24,6% | 23,9% |
| Em breve | Descobertas | 36,2% (39,8%) | 35,3% (39,7%) | 43,6% (48,3%) | 41,7% (47,0%) | 38,2% (42,0%) | 34,7% (37,2%) |
| Pouco conhecido | Descobertas | 36,7% (46,7%) | 37,4% (47,9%) | 43,8% (53,9%) | 45,6% (57,4%) | 35,9% (46,0%) | 36,4% (45,2%) |
| Sobreposição Equilibrado × Descobertas | — | 63,3% (53,3%) | 62,6% (52,1%) | 56,2% (46,1%) | 54,4% (42,6%) | 64,1% (54,0%) | 63,6% (54,8%) |
| Sobreposição Populares × Equilibrado | — | 45,1% (57,2%) | 47,3% (58,7%) | 40,7% (52,8%) | 43,1% (54,6%) | 46,8% (59,1%) | 39,9% (54,1%) |

### O que muda com o λ calibrado

1. **Descobertas:** o "pouco conhecido" cai para 36% a 46% do top-20 e fica abaixo de 50% em todas
   as famílias (era de 45% a 57%). A sobreposição com o Equilibrado sobe para 54% a 64% (era de
   43% a 55%). O acerto@20 sobe ou fica igual em todos os grupos. A diferença de ARP para o
   Equilibrado vai de 0,13 a 0,18.
2. **Populares:** fica mais longe do Equilibrado. A diferença de ARP vai de 0,24 a 0,30 (era de
   0,19 a 0,21), e a sobreposição com o Equilibrado cai para 40% a 47% (era de 53% a 59%). O
   acerto@20 sobe onde a popularidade ajuda (de 12,57% para 14,31% na família A pela popularidade,
   de 6,00% para 7,83% na B pela popularidade e de 18,75% para 30,00% na C) e cai nas amostragens
   uniformes (de 7,22% para 6,92% na A e de 2,33% para 1,92% na B).
3. **Cobertura do catálogo:** a do Descobertas sobe e a do Populares cai. O Descobertas passa a
   cobrir mais que o Populares em todas as famílias, de A a D (de +2,0 a +9,5 pontos), o que a
   seção 12 espera e a rodada 1 não confirmava. O Equilibrado continua com a maior cobertura.
4. **Contra as linhas de base:** no @20, os três modos continuam acima da aleatória nas famílias A,
   B e C, em todas as amostragens e estratos. Contra a alternativa 1, na amostragem pela
   popularidade:
   - o Populares passa em todos os grupos e estratos;
   - o Equilibrado continua empatando no estrato de tema da família A (−0,49 [−2,01; +0,97]);
   - o Descobertas continua perdendo nesse estrato (−2,92 [−4,10; −1,81]) e empatando na família B
     (−0,08 [−0,92; +0,75]). É esperado, e fica registrado sem ação (decisão do autor,
     16/11/2026): o jogo escondido sorteado pela popularidade tende a ser popular, que é o que a
     alternativa 1 devolve.
5. **Intercalada × única:** o acerto@20 continua com o intervalo acima de zero nas 15 combinações
   agregadas. No estrato de gênero da família A, a intercalada fica abaixo da única com o intervalo
   inteiro abaixo de zero no Descobertas uniforme (−1,11 [−1,88; −0,42]) e no Populares pela
   popularidade (−1,25 [−2,29; −0,35]); o Populares uniforme toca o zero (−0,56 [−1,18; 0,00]). Fica
   registrado sem ação (decisão do autor, 16/11/2026): os perfis da família A são de um gosto só e
   não têm o que ganhar com a intercalação; nos agregados, ela ganha nas 15 combinações.
6. **"Em breve":** nenhum modo passa de 50%. No Descobertas, de 35% a 44% do top-20; no Populares,
   de 6% a 10%.
7. **Critérios C1 a C5:** iguais aos da rodada 1. As prateleiras e a visão geral do Equilibrado não
   dependem do λ.

### Foto completa das respostas

`pnpm recommendations:snapshot` com a configuração anterior e com a nova, nos 400 perfis da semente
71, com todas as páginas de cada lista. A foto com a configuração anterior saiu idêntica à da prova
do refactor do B-37.

| Modo | Respostas | Mudaram |
| --- | --- | --- |
| Populares | 17.997 | 17.979 (99,9%) |
| Equilibrado | 17.997 | 0 |
| Descobertas | 17.997 | 17.820 (99,0%) |
| Total | 53.991 | 35.799 (66,3%) |

Nenhuma resposta apareceu nem sumiu: cada lista tem o mesmo número de páginas.

### Conferência em produção, depois do merge

Repete a conferência do B-35 com o mesmo perfil (`time-for-bed` e `lavaloop` com 5, `foundlings`
com 4) e compara com os números de lá: 18 de 20 itens do top-20 do Descobertas marcados "pouco
conhecido" (90%) e só 2 jogos em comum com o Equilibrado.

## Limitações

- **Perfis sintéticos favorecem a recomendação por conteúdo.** Na família A, o perfil é montado pelo
  mesmo atributo que o vetor usa para achar o jogo escondido. O acerto mede se o recomendador
  recupera jogos do mesmo atributo, não se um jogador real gostaria deles. Os critérios da seção 12
  são comparativos (contra as linhas de base e entre configurações), e o teste de usabilidade (B-44)
  complementa com percepção humana.
- **O bônus das listas não é calibrado:** os perfis sintéticos não usam favoritos, concluídos nem
  "quero jogar", então não há sinal para ele (decisão 8).
- **A família C acerta os jogos mais populares por construção:** os jogos avaliados vêm da lista
  de jogos para avaliar, ordenada pela popularidade. A comparação com a alternativa 1 nela não diz
  nada sobre o recomendador.
- **A ordem dos jogos para avaliar na família C** compara os nomes pela ordem do JavaScript, e não
  pela do banco. Só pesa no empate de popularidade.
