# Etiquetas da comunidade Steam (B-77)

Medição feita entre 05/11 e 07/11/2026, sem mudar o que a API usa. O resultado é o vocabulário de
etiquetas aceitas (`apps/api/config/tags.json`, que se chamava `tags.draft.json` até o B-78), a
decisão de pôr as etiquetas no vetor e a regra de prateleiras que o B-79 implementa. A ingestão, o
vetor e a interface entraram no B-78 (seção 10); a regra de prateleiras e os nomes da comunidade, no
B-79 (seções 11 e 12).

## Por que medir

Gêneros, temas e palavras-chave da IGDB descrevem mal o tipo de jogo que o jogador reconhece:

- os gêneros são poucos e largos: Aventura está em 54% do catálogo, e "Hack and slash/Beat 'em
  up" é um gênero só;
- 29,5% do catálogo não tem nenhuma palavra-chave, e 53% tem até 2;
- por isso as prateleiras saíam largas ("Porque você curte RPG", 24% do catálogo). Hollow Knight
  tem a palavra-chave `metroidvania`, mas Grim Dawn não tem nada que diga ARPG.

Numa amostra de 500 jogos (05/11/2026), 91,8% tinham etiquetas da comunidade na Steam, com mediana
de 20 por jogo. O autor decidiu medir essa fonte no catálogo inteiro antes de implementar (B-77 a
B-79, seção 13 da proposta técnica).

## Resumo

- **Cobertura:** 95,5% do catálogo tem o id da Steam na IGDB e 94,1% tem ao menos uma etiqueta
  aceita no peso mínimo 0,3. No quartil menos popular são 87,3%.
- **Precisão:** 91,6% das etiquetas julgadas estão corretas no peso mínimo 0,3. A metade menos
  popular da amostra tem precisão maior que a mais popular.
- **Vocabulário:** 426 etiquetas com ao menos 3 jogos. Delas, 356 são aceitas, 271 podem virar
  prateleira e 90 têm título próprio. Simulação e Simulador de Caminhada saíram pela regra R3.
- **Vetor:** as etiquetas entram no lugar das palavras-chave. O empate em bloco no topo dos
  vizinhos caiu de 9 para 2 das 15 referências, e os "curingas" de 109 para 8.
- **Prateleiras:** adotada a regra de duas fases com até 6 prateleiras, como exceção explícita à
  regra de parada, com o motivo registrado. O caso "RPG com terror" fica como limitação dos dados.

## Método e reprodução

- **Coleta:** `pnpm --filter @indie/api tags:measure --cache <pasta>` (`src/measure-tags.ts`).
  - Para cada jogo do catálogo local, busca o id da Steam no `external_games` da IGDB (fonte 1).
  - Na loja da Steam, busca as etiquetas com peso (`IStoreBrowseService/GetItems`, até 20 por jogo,
    em lotes de 50) e os nomes em português e inglês (`IStoreService/GetTagList`).
  - O cliente (`src/modules/tags/steam-store.client.ts`) faz uma requisição por segundo e tenta de
    novo depois de 429 ou 5xx.
  - A coleta de 05/11/2026 levou 8 min 41 s.
- **Relatório:** `--offline` lê só o cache. Com mais de um id da Steam, vale o primeiro que tem
  etiquetas, em ordem numérica.
- **Dados brutos fora do repositório:** o cache (11 MB) não é commitado. O repositório é público, e
  os termos da Web API permitem mostrar os dados aos usuários do site, não redistribuí-los. Este
  documento traz só agregados e poucos exemplos.
- **Funções puras:** em `src/modules/tags/tags.ts`, com testes:
  - peso relativo;
  - leitura do vocabulário;
  - reserva da IGDB;
  - concordância entre a reserva e a Steam.
- **Protótipos:** o vetor com etiquetas e as regras de prateleira ficaram fora do repositório, como
  no B-73. Os números estão aqui, e as regras, descritas na seção 6.

## 1. Coleta e cobertura

| Medida | Jogos |
| --- | --- |
| Catálogo local | 22.825 |
| Com id da Steam na IGDB | 21.807 (95,5%) |
| Com mais de um id da Steam | 514 (2,3%) |
| Com etiquetas na Steam | 21.549 (94,4%) |

**Peso mínimo relativo.** Uma etiqueta conta se o peso dela for pelo menos X vezes o da etiqueta
mais votada do próprio jogo. Jogos com ao menos uma etiqueta aceita, por quartil de popularidade
(1 = menos popular), com o vocabulário final:

| Peso mínimo | Catálogo | Quartil 1 | Quartil 2 | Quartil 3 | Quartil 4 | Mediana por jogo |
| --- | --- | --- | --- | --- | --- | --- |
| 0,1 | 94,3% | 87,5% | 93,4% | 97,7% | 98,6% | 15 |
| 0,2 | 94,2% | 87,4% | 93,2% | 97,7% | 98,6% | 15 |
| **0,3** | **94,1%** | **87,3%** | **92,9%** | **97,5%** | **98,5%** | **14** |
| 0,5 | 93,7% | 86,8% | 92,4% | 97,2% | 98,2% | 12 |

Nos 6.733 jogos sem nenhuma palavra-chave da IGDB, 94,3% têm etiqueta aceita (peso 0,1).

**O peso não é contagem de votos.** O valor que a rota devolve tem mínimo de cerca de 500 na
etiqueta mais votada de cada jogo; a mediana é 790. Um quebra-cabeça pequeno (Akin) tem 1.949, mais
que um RPG em desenvolvimento (Shaype, 605). Nenhum jogo tem cinco ou mais etiquetas empatadas no
topo. Por isso o corte é relativo ao próprio jogo e não há como separar jogos "com poucos votos" por
esse valor.

## 2. Vocabulário

Etiquetas com ao menos 3 jogos no catálogo, com o nome em português da própria Steam. Os grupos vêm
da documentação da Steam (Tag Wizard), e eu classifiquei cada etiqueta para a revisão do autor.

| Grupo | Aceitas | Podem virar prateleira |
| --- | --- | --- |
| Gênero | 26 | 20 |
| Subgênero | 136 | 128 |
| Mecânica | 57 | 32 |
| Clima | 23 | 12 |
| Tema | 89 | 79 |
| Visual | 25 | 0 |
| **Total** | **356** | **271** |

**Excluídas (70):**
- jogadores ("Um Jogador", "Multijogador");
- recursos técnicos ("Controle", "Acesso Antecipado");
- opinião ("Boa Trama", "Trilha Sonora Boa");
- conteúdo adulto;
- "Indie", que está em quase todo o catálogo;
- Simulação e Simulador de Caminhada (R3, seção 3).

**Decisões do autor:**
- **Grupo "mecânica" (07/11/2026):** aceito e elegível a prateleira. Separa o que descreve o jogo
  (Mundo Aberto, Fabricação, Morte Permanente) dos recursos técnicos. O limite de frequência barra
  as mais largas.
- **Visual:** entra na ficha, no filtro e na pontuação, mas não vira prateleira.
- **"Pode virar prateleira" (`shelf`) e título (`title`):** propostos por mim e revisados pelo
  autor. As etiquetas vagas ou subjetivas (Atmosférico, Sombrio, Cinematográfico) e as que repetem
  outra ideia ficam na ficha, no filtro e na pontuação, mas não viram prateleira:
  - Roguelite fica com Roguelike;
  - Vários Finais e Escolha a sua Aventura ficam com Você Decide;
  - Batalha com Cartas fica com Montagem de Decks;
  - Agricultura e Rural ficam com Simulador Rural.
- **Títulos:** o título substitui o nome em "Porque você curte `<título>`" quando o nome não se lê
  bem ali. Exemplos: Impiedoso → "jogos difíceis", Roguelike → "roguelikes e roguelites",
  Montagem de Decks → "construção de baralho (deckbuilding)". **Alterado em 09/11/2026 (B-79):** 44
  nomes passaram aos termos da comunidade (Impiedoso → Difícil, Montagem de Decks → Deckbuilding), e 9
  títulos foram revistos (seção 12).
- **Faça o que Quiser e Tático:** passaram de gênero para mecânica, porque atravessam gêneros. Assim
  saem da fase 1 da regra de prateleiras (seção 6).

**Como a revisão foi feita:** a tabela de revisão (356 linhas) foi preparada com apoio de um
assistente de IA, e as decisões foram aprovadas pelo autor em 07/11/2026. Os critérios estão
descritos no topo do arquivo de revisão:
- a fase 1 usa só etiquetas de tipo de jogo;
- uma prateleira por ideia;
- títulos que se leem bem na frase.

**Estilos e reserva da IGDB.** Os 49 estilos do B-74 deixam de ser lista paralela:
- cada um foi mapeado para uma etiqueta, e as palavras-chave e os termos do resumo dele viraram
  evidência de reserva para os jogos sem etiqueta aceita da Steam;
- dois estilos ficaram sem etiqueta correspondente: o terror liminar, que a Steam não tem com 3
  jogos ou mais, e o simulador de caminhada, que saiu pela regra R3;
- para corrigir os falsos positivos, saiu da reserva toda evidência que a Steam confirma em menos de
  50% dos jogos que têm as duas fontes, com ao menos 5 jogos. Saíram 90 de 374: 44 palavras-chave e
  46 termos do resumo, como `self-referential-humor` (0% de 29 jogos), `occult` (0% de 10) e
  `creature-compendium` (33% de 15). O `shop-keeper` ficou, com 68%;
- com a limpeza, a reserva dá etiqueta a 36,5% dos 1.306 jogos sem etiqueta aceita da Steam; antes
  davam 41,2%.

## 3. Precisão (R2 e R3)

**Amostra.** Foram sorteados 30 jogos (semente 77) entre os que têm etiquetas na Steam, com as
etiquetas aceitas no peso 0,1, o menor candidato, e o peso relativo de cada uma visível. Para cada
etiqueta, eu pré-classifiquei como correta, errada ou sem evidência, citando o resumo ou a ficha da
IGDB. O autor confirmou ou corrigiu.

**Como o julgamento foi feito.** O julgamento foi preparado com apoio de um assistente de IA, a
partir do texto do desenvolvedor na página de cada jogo na Steam, da ficha da IGDB e do
conhecimento público dos jogos, e aprovado pelo autor, como descrito no topo do arquivo de
julgamento.
- As etiquetas da própria página da Steam não foram usadas, o que tornaria o julgamento circular.
- As etiquetas visuais ou de clima sem base na descrição ficaram "sem evidência", fora da conta.
- O autor mudou 87 das 429 pré-classificações.

| Peso mínimo | Precisão | Sem evidência (fora da conta) |
| --- | --- | --- |
| 0,1 | 90,0% (316 de 351) | 78 |
| 0,2 | 91,1% (306 de 336) | 74 |
| **0,3** | **91,6% (282 de 308)** | 70 |
| 0,5 | 89,9% (222 de 247) | 54 |

**Jogos pequenos.** A metade menos popular da amostra (popularidade da IGDB até 5) tem precisão
maior que a mais popular: 95,9% contra 88,8% no peso 0,3. Pelo peso absoluto da etiqueta mais
votada, as duas metades ficam entre 88% e 93%. Os erros se concentram em alguns jogos (Akin, There
Are Millions of Goblins, JumpJet Rex, Quern), não nos pouco conhecidos. Por decisão do autor, não há
tratamento extra.

**Pares contraditórios no catálogo (peso 0,1).** 6,0% dos jogos têm algum dos pares medidos. A maior
parte é "Casual e Impiedoso" (2,8%), que nem sempre é contradição. "Linear e Não Linear" juntos
aparecem em um jogo só.

**Regras de decisão, fixadas no plano antes de medir:**
- **R2, peso mínimo:** vale o maior X com precisão de ao menos 90% que mantém R1. Resultado: **0,3**.
  O peso 0,5 cai para 89,9% porque corta mais etiquetas certas que erradas.
- **R3, precisão:** passa, com 91,6%. A etiqueta que erra em 2 ou mais jogos da amostra sai do
  vocabulário. No peso 0,3, saíram **Simulação** (Saiko no Sutoka e Kill the Bad Guy) e
  **Simulador de Caminhada** (Mundaun e Quern).
- **R1, cobertura:** passa, com 94,1% do catálogo (o critério pedia 85%) e 87,3% no quartil menos
  popular (pedia 75%).

## 4. Etiquetas no vetor (R4)

No protótipo, o bloco de palavras-chave do vetor (fatia de 0,3) passa a ser o das etiquetas aceitas,
com termo binário e IDF no catálogo, como os outros blocos. Os jogos sem etiqueta aceita da Steam
usam a reserva da IGDB.

| Item | Critério | Resultado no peso 0,3 |
| --- | --- | --- |
| (a) empate em bloco | no máximo 2 das 15 referências com 5 ou mais jogos empatados no 10º vizinho | 2 (eram 9) |
| (b) curingas | cair à metade ou mais | 8 (eram 109) |
| (c) leitura do autor | etiquetas melhores em ao menos 7 de 10 listas | 8 de 10 |
| (d) memória e tempo | RSS abaixo de 450 MB; visão geral em até 1,5 vez | estimativa aceita; tempo de 1,01 a 1,25 vez com a regra adotada |

- **Referências:** os 5 jogos da análise mais 10 sorteados entre os 500 mais populares (semente 77).
- **(b) Curingas:** jogos sem palavras-chave nem etiquetas, que tinham vetor só com gênero e tema e
  empatavam no topo de qualquer lista.
- **(c) Leitura do autor:** as listas foram lidas no peso 0,1. No 0,3, elas repetem de 5 a 10 dos 10
  vizinhos.
- **(d) Memória:**
  - o índice com etiquetas ocupa cerca de 26 MB a mais de heap (75 contra 49 MB);
  - a API atual local chegou a 299 MB de RSS logo depois da carga;
  - somando um segundo índice durante a recarga, a estimativa fica abaixo de 400 MB.
  - **Condição do autor:** o B-78 mede o RSS depois da carga e de três recargas em produção, e a
    decisão do vetor é revista se passar de 450 MB.

**Decisão:** as etiquetas entram no vetor. Com isso, as prateleiras "Porque você gostou de
`<jogo>`" continuam no B-79, e o motivo pode citar etiquetas (regra do B-74).

## 5. Regra de interesses do plano (R5): reprovada

A primeira regra, fixada no plano, era: só atributos em até 10% do catálogo, com suporte de 2 jogos,
até 4 sem sobreposição. Nos 200 perfis por avaliações da semente 71, com etiquetas, 52% ficaram sem
interesse, e só 10% com 2 ou mais. A cobertura do peso da biblioteca foi de 35,2%; o critério pedia
85%. O caso "RPG com terror" também reprovou. A regra ficou registrada como reprovada.

Os 200 perfis por avaliações sorteiam 4 jogos do catálogo inteiro, que raramente dividem um gosto.
Por decisão do autor, passaram a ser só registro, e foi criado um conjunto de **perfis coerentes**:
200 perfis, cada um com 4 jogos de uma etiqueta e 2 de outra.

## 6. Regra de prateleiras adotada

**Critérios C1 a C6, gravados antes de cada medição** (arquivo de trabalho fora do repositório):

| Critério | Exigência |
| --- | --- |
| C1, RPG com terror (o caso de produção do B-71) | o gosto secundário ganha uma prateleira de terror. Na **leitura revisada**, ela é sustentada pelos dois jogos de terror, mesmo incluindo um do gosto principal. O autor revisou a leitura antes de medir a regra de duas fases, porque a original, que exigia só os dois jogos, era mais rígida que a intenção |
| C2, Amnesia | nenhuma prateleira de etiqueta específica com um jogo só |
| C3, perfis realistas | cada um com ao menos 2 prateleiras, uma delas específica |
| C4, preferências | os 200 perfis da partida a frio com ao menos 2 prateleiras |
| C5, perfis coerentes | (a) prateleira só do gosto principal em ao menos 90%; (b) só do secundário em ao menos 70%; (c) no máximo 5% sem prateleira |
| C6, tempo | cálculo da visão geral em até 1,5 vez o atual |

**Regras medidas:**

- **Gostos largos (regra do autor, primeira versão):** gostos pela cobertura do B-71, com gêneros e
  temas, e a etiqueta de maior peso de cada grupo. Reprovou em C5 (a), com 86,5%, e em C5 (b), com
  29%.
- **A:** a mesma, com as vagas para a etiqueta que cobre mais jogos ainda sem prateleira.
- **B:** escolha direta pelas etiquetas específicas, com o atributo largo da IGDB só para os jogos
  que nenhuma etiqueta cobre.
- **Duas fases (autor):**
  - **Fase 1:** a regra B, só com etiquetas de gênero e subgênero.
  - **Preferências:** entram em seguida.
  - **Fase 2:** completa as vagas com etiquetas de qualquer grupo que pode virar prateleira, na
    ordem do peso da biblioteca que sustentam. Uma etiqueta não entra se o Jaccard dos jogos do
    catálogo com ela e com uma prateleira já escolhida passar de 0,5.

**Regras em comum:**
- atributo largo também com suporte de 2 jogos;
- preferências isentas;
- nenhuma ideia repetida (gênero "Visual Novel" e etiqueta "Romance Visual" contam como a mesma);
- o gosto de um jogo só fica com a prateleira "Porque você gostou de `<jogo>`".

Os números abaixo usam o vocabulário anterior à revisão do autor. Entre parênteses, o número máximo
de prateleiras.

| Critério | A (4) | B (4) | Duas fases (4) | Duas fases (5) | Duas fases (6) |
| --- | --- | --- | --- | --- | --- |
| C1 original | não passa | não passa | não passa | não passa | não passa |
| C1 revisado | passa | não passa | não passa | não passa | não passa |
| C2 | passa | passa | passa | passa | passa |
| C3 | não passa | não passa | passa | passa | passa |
| C4 | 200 de 200 | 200 de 200 | 200 de 200 | 200 de 200 | 200 de 200 |
| C5 (a) | 96,5% | 98,5% | 99,0% | 100% | 100% |
| C5 (b) | 70,0% | 77,5% | 70,5% | 76,5% | 85,5% |
| C5 (c) | 0% | 0% | 0% | 0% | 0% |
| C6 (razão) | 1,11 | 1,09 | 1,11 | 1,10 | 1,10 |
| Perfis coerentes com o máximo de prateleiras | — | — | 194 de 200 | 188 de 200 | 172 de 200 |
| Prateleiras que somem pelo mínimo de 4 jogos | 0 | 0 | 0 | 0 | 0 |

**Regra de parada, fixada antes de medir a regra de duas fases:** se ela não passasse, adotava-se a
variante B. **Decisão do autor (07/11/2026): fica adotada a regra de duas fases com até 6
prateleiras, como exceção explícita à regra de parada.**
- A reserva B foi fixada por ser a melhor regra medida até então.
- A regra de duas fases com 6 vagas é melhor que B em todos os critérios em que diferem (C3, C5 a,
  C5 b) e empata nos demais. As duas reprovam no C1 revisado.
- Nenhum critério foi alterado e nenhuma regra nova foi testada: a escolha foi entre opções já
  medidas.
- **Aprovado pelo autor:** na fase 1, a sobreposição é medida pelo Jaccard dos jogos da biblioteca
  acima de 0,8, como na variante B, e as preferências entram entre as duas fases, para a fase 2 não
  tirar o lugar delas.

**Com o vocabulário revisado** (grupos, prateleiras, títulos e reserva limpa), a regra de duas fases
com 6 prateleiras foi medida de novo, só para registro:

| Critério | Resultado |
| --- | --- |
| C1 original | passa (pela prateleira "Tiro em Primeira Pessoa", que os dois jogos de terror sustentam juntos, e não por uma de terror) |
| C1 revisado | não passa |
| C2, C3, C4 | passam (C4: 200 de 200) |
| C5 (a), (b), (c) | 100%; 87,0%; 0% |
| C6 | passa, entre 1,01 e 1,25 em duas rodadas (variação de medição) |
| Ideia repetida | nenhuma |
| Prateleiras nos perfis coerentes | 6 em 141, 5 em 29, 4 em 20, 3 em 8, 2 em 2 |

| Perfil realista | Prateleiras |
| --- | --- |
| Metroidvania e plataforma (Hollow Knight, Dead Cells, Celeste, Axiom Verge) | Metroidvania, Impiedoso, Soulslike, Fantasia Sombria |
| ARPG e roguelike de ação (Grim Dawn, Hades, Hades II, Vampire Survivors) | Roguelike de Ação, RPG de Ação, Roguelike, Mitologia, Hack and Slash, Explorador de Calabouços |
| Aconchegante (Stardew Valley, A Short Hike, Unpacking, Spiritfarer) | Simulador Rural, Simulador de Vida Real, Fabricação, Mundo Aberto |
| Estratégia e baralho (Slay the Spire, Into the Breach, Inscryption, Monster Train) | Roguelike, Montagem de Decks, Tática por Turnos, Estratégia em Turnos |

## 7. Limitações registradas

- **RPG com terror (C1).** No catálogo, a única etiqueta de terror que os dois jogos do caso de teste
  (7 Days to Die e Amnesia: The Bunker) dividem é "Terror", em 16,3% do catálogo, acima do limite de
  10%.
  - "Terror de Sobrevivência" está só em Amnesia.
  - O tema Terror da IGDB entra só para os jogos que nenhuma etiqueta de gênero ou subgênero cobre.
  - O gosto secundário ganha prateleira, mas não de terror.
  - O B-37 calibra o limite de frequência das prateleiras (10%, 15% e 20%), medindo C1, C5 e a
    especificidade das prateleiras. Terror Psicológico (10,3%) está logo acima do limite atual.
- **Perfil aconchegante.** "Aconchegante" (4,7% do catálogo, pode virar prateleira) não aparece nas
  20 etiquetas que a loja devolve para Stardew Valley, Unpacking e Spiritfarer. Em A Short Hike, ela
  tem peso relativo 0,29, logo abaixo do mínimo de 0,3. "Relaxante", que os quatro dividem, está em
  12% do catálogo. Simulador Rural é a prateleira aceita para esse perfil, sem regra especial.
- **Etiquetas aplicadas pelo desenvolvedor.** Parte das etiquetas erradas da amostra parece aplicada
  em bloco pelo próprio desenvolvedor (JumpJet Rex com "Linear" e "Não Linear" juntas; Akin com
  "Sokoban" e "Incremental"). O peso da rota não permite separá-las.

## 8. Riscos e desvio

- **Desvio da premissa de fonte única.** A IGDB deixa de ser a única fonte de atributos dos jogos. A
  Steam passa a ser a terceira fonte externa do projeto. A IGDB continua sendo a fonte do catálogo e
  do critério de indie, e a Steam entra só com as etiquetas.
- **Rota sem documentação pública.** A `IStoreBrowseService/GetItems` não está na documentação
  pública da Valve. O B-78 grava as etiquetas na ingestão: nenhuma requisição de usuário chama a
  Steam (RNF-02), e, se a rota falhar, a execução não falha e mantém as etiquetas gravadas.
  **Alterado em 07/11/2026 (B-78), por decisão do autor:** isso vale depois da primeira coleta
  bem-sucedida. Antes dela, não há etiqueta gravada para manter, e a execução falha sem gravar
  nada (seção 10).
- **Termos da Web API da Steam:**
  - limite de 100 mil chamadas por dia, quando o catálogo inteiro pede cerca de 450;
  - a ficha cita "Etiquetas da comunidade Steam", sem sugerir endosso da Valve;
  - a Valve pode cortar o acesso a qualquer momento, e nesse caso a reserva da IGDB e as etiquetas
    já gravadas continuam valendo.

## 9. Para os próximos itens

- **B-78:**
  - ingestão do id da Steam e das etiquetas aceitas, no peso mínimo 0,3, com o vocabulário
    `tags.draft.json` revisado (hoje `tags.json`);
  - ficha e filtro do catálogo;
  - etiquetas no vetor, no lugar das palavras-chave;
  - RSS da API medido depois da carga e de três recargas em produção.
- **B-79** (feito em 09/11/2026, seções 11 e 12):
  - a regra de duas fases com até 6 prateleiras, com os títulos do vocabulário;
  - prateleiras "Porque você gostou de `<jogo>`" só para jogos com nota 4 ou mais, ou em favoritos.
    Um jogo só em "quero jogar" ou só em "concluídos" nunca gera essa prateleira;
  - a visão geral passa a ter até 10 seções e, com as prateleiras por jogo, é medida de novo em produção
    pela metodologia do B-33, com p95 fim a fim abaixo de 1 s.
- **B-37:** calibrar o limite de frequência das prateleiras (10%, 15% e 20%).
- **B-44:** observar se o jogador percorre a visão geral até o fim.

## 10. Na plataforma (B-78)

Implementado em 07/11/2026. As decisões do plano foram aprovadas pelo autor, com os ajustes
marcados abaixo como "decisão do autor".

### Ingestão

- **Id da Steam:** a ingestão busca no `external_games` da IGDB (fonte 1) o id da Steam dos jogos
  aceitos, 200 jogos por consulta. Com mais de um id, vale o primeiro que tem etiquetas, em ordem
  numérica, como no B-77. O id fica em `Game.steamAppId`, sem índice único: hoje nenhum id é
  dividido entre dois jogos, mas uma colisão nos dados da IGDB derrubaria a gravação inteira, e
  nenhuma consulta depende da unicidade (desvio do texto do B-65, aprovado no plano).
- **Etiquetas:** a ingestão busca na loja da Steam as etiquetas de todos os ids, em lotes de 50,
  uma requisição por segundo, e fica com as aceitas pelo vocabulário (`config/tags.json`) no peso
  mínimo relativo 0,3 (`minRelativeWeight`, com a justificativa no próprio arquivo). Etiqueta fora
  do vocabulário é ignorada até uma nova revisão.
- **Reserva:** o jogo sem nenhuma etiqueta aceita da Steam recebe as etiquetas pelas palavras-chave
  e pelos termos do resumo do vocabulário (as evidências que vieram dos estilos).
- **Gravação:** as etiquetas são atributos do tipo `TAG` em `Feature` e `GameFeature`, com o id da
  Steam em `Feature.igdbId` e o nome em português do vocabulário. Nas etiquetas da Steam, o
  `GameFeature.rank` guarda a posição (1 para a mais votada), e não o peso: o peso muda a cada
  coleta e regravaria cerca de 300 mil vínculos por execução, todos com linha morta no
  PostgreSQL. A origem fica em `Game.tagSource` (`STEAM`, `IGDB` ou nula).
- **Falhas (decisão do autor):** se a loja falhar depois das novas tentativas, a ingestão segue com
  as etiquetas da Steam já gravadas e com a reserva da IGDB para os outros jogos, e o motivo fica
  no `errorSummary`. Isso só vale depois da primeira coleta bem-sucedida. Antes dela, nenhum jogo
  do catálogo tem etiquetas da Steam gravadas, e a execução termina `FAILED` sem gravar nada, para
  o catálogo não ficar só com a reserva. Os dois caminhos têm teste e2e com um servidor falso da
  Steam. Uma falha no `external_games` é falha da IGDB, como as outras consultas a ela.
- **Sonda antes do merge (decisão do autor):** o modo `sonda-steam` do workflow "Ingestão" roda a
  partir da branch e busca as etiquetas de uma amostra sistemática de 200 jogos do catálogo de
  produção (um a cada k, na ordem do `igdbId`), só leitura, com o status, o tempo e as falhas de
  cada requisição (`src/probe-steam.ts`). Se a Steam bloquear o Actions, o merge espera.
- **Entre o deploy e a primeira ingestão (decisão do autor):** a migration e o código novo entram
  antes de qualquer etiqueta gravada. Nesse intervalo, o vetor novo roda sem etiquetas: as
  palavras-chave já não contam, e o vetor fica só com gêneros e temas. Por isso a ingestão manual
  é feita logo depois do merge.

### Vetor, interesses e motivo

- **Vetor:** gênero, tema e etiqueta, com fatias de 40/30/30, termo binário e IDF no catálogo, com
  os limites de sempre (mínimo de 3 jogos, máximo de 80%). As palavras-chave saíram do vetor.
- **Interesses:** a regra de cobertura do B-71 continua, até o B-79. As etiquetas que podem virar
  prateleira (`shelf`) entram no lugar dos estilos, ao lado de gêneros e temas, com o mesmo limite
  de 40% do catálogo. A prateleira é `tag:<slug>`, com o "ver mais" em
  `/recomendacoes/etiqueta-<slug>`. Os títulos do vocabulário ficam para o B-79.
- **Motivo (decisão do autor):** entra o primeiro grupo com alguma contribuição positiva, com até
  3 atributos: as etiquetas que podem virar prateleira; depois as outras etiquetas (visuais e
  vagas); depois gêneros e temas; e por fim "Porque você gostou de `<jogo>`". Como todo atributo do
  vetor está num dos três primeiros grupos, o jogo curtido virou só reserva: ele aparecia nos jogos
  que só dividiam palavras-chave com a biblioteca.
- **Estilos:** o `config/styles.json`, o módulo de estilos e o `styles:measure` saíram do código.

### Ficha e catálogo

- **Ficha:** a linha "Etiquetas" vem depois de Temas, com todas as aceitas, na ordem da Steam, e
  cada uma leva ao catálogo filtrado. Abaixo dela, a atribuição:
  - etiquetas da Steam: "Etiquetas da comunidade Steam", com link para a página do jogo na loja,
    sem sugerir endosso da Valve;
  - reserva: "Etiquetas atribuídas pelo resumo e pelas palavras-chave da IGDB", sem link;
  - sem etiqueta: "Não informado".
- **Filtro:** `tag` repetível em `GET /api/games`, como gênero e tema (o jogo precisa ter todas, até
  5), e `GET /api/features?type=tag` com a contagem. Na página do catálogo, a lista "Etiquetas" fica
  em ordem alfabética, com a contagem e, por decisão do autor, um campo de busca por nome no topo.
  A busca ignora acentos e maiúsculas, só esconde as opções (as marcadas continuam no formulário)
  e não vai para a URL.

### Medições locais (07/11/2026)

Os critérios foram fixados no plano antes de medir. A ingestão local real usou o build de produção
(`node dist/ingest.js`) contra a IGDB e a Steam, no banco local.

**Ingestão** (23.001 jogos no catálogo; 22.825 na carga local anterior, por dados novos da IGDB):

| Etapa | Tempo |
| --- | --- |
| Conjunto candidato (132.122 jogos) | 5 min 37 s |
| "Want to Play", empresas e Wikidata | cerca de 3 min |
| Ids da Steam na IGDB (21.974 jogos com id) | 63 s |
| Etiquetas na loja (21.828 ids com etiquetas) | 7 min 31 s |
| Gravação | 25 s |
| **Total** | **17 min 36 s** |

| Origem das etiquetas | Jogos |
| --- | --- |
| Steam | 21.637 (94,1%) |
| Reserva da IGDB | 493 (2,1%) |
| Nenhuma | 871 (3,8%) |

A reserva cobre 36,1% dos jogos sem etiqueta aceita da Steam; o B-77 tinha medido 36,5%.

| Banco local | Antes | Depois |
| --- | --- | --- |
| Tamanho (`pg_database_size`) | 110 MB | 133 MB |
| `GameFeature` | 211.808 linhas, 46 MB | 489.804 linhas, 69 MB |
| Vínculos de etiqueta | — | 276.217 (12,5 por jogo com etiqueta) |
| Atributos no índice (IDF > 0) | 2.690 (22 gêneros, 21 temas, 2.647 palavras-chave) | 399 (22 gêneros, 21 temas, 356 etiquetas) |

**Memória da API local** (carga da inicialização e três recargas seguidas, RSS do log da carga):

| Versão | Carga | 1ª recarga | 2ª recarga | 3ª recarga |
| --- | --- | --- | --- | --- |
| `main` | 299 MB | 352 MB | 408 MB | 465 MB |
| B-78 | 286 MB | 319 MB | 361 MB | 404 MB |
| `main`, heap limitado a 256 MB | 295 MB | 325 MB | 327 MB | 333 MB |
| B-78, heap limitado a 256 MB | 281 MB | 313 MB | 317 MB | 316 MB |

- Sem limite de heap, o RSS cresce a cada recarga, porque o coletor não devolve a memória dos
  índices antigos entre recargas seguidas, na máquina local com muita memória. Na `main`, ele
  já passava de 450 MB na terceira recarga.
- Com o heap limitado a 256 MB, como numa instância de 512 MB, o RSS se estabiliza. É só uma
  aproximação do Render; a condição do autor (RSS abaixo de 450 MB) vale para a medição em
  produção, depois da primeira ingestão.
- O índice ficou menor que o da `main`: a carga não lê mais os resumos nem os estilos, e o vetor
  tem 399 atributos em vez de 2.690.

**Tempo da visão geral** (os 400 perfis da semente 71 nos três modos, em processo, duas rodadas):
mediana de 12,0 ms na `main` e 12,3 ms no B-78, razão de 1,02 (critério C6: até 1,5); p95 de 20,3
contra 19,2 ms.

**Conferência com o protótipo do B-77** (as mesmas 15 referências; as etiquetas são de 07/11, e
não do cache de 05/11):

| Critério | Protótipo | Implementado |
| --- | --- | --- |
| (a) referências com 5 ou mais empatados no 10º vizinho (até 2) | 2 | 2 (Gravity Circuit e Atmasphere) |
| (b) curingas entre os 10 primeiros, somados (até 8) | 8 | 8 |

**Interesses com a regra atual** (400 perfis da semente 71):
- 184 dos 200 perfis por avaliações têm alguma etiqueta entre os interesses, e 307 dos 419
  interesses deles são etiquetas. Os 200 perfis por preferências não têm etiqueta, porque as
  preferências da partida a frio são só gêneros e temas (B-34). **Alterado em 11/11/2026 (B-34):**
  a partida a frio passou a oferecer as etiquetas que podem virar prateleira, sem as que repetem a
  ideia de um gênero ou tema (`docs/recomendacao.md`, seção "Partida a frio").
- **Ideia repetida** (gênero ou tema e etiqueta da mesma ideia, pela tabela de equivalência do
  protótipo do B-77): nenhum perfil, entre os interesses escolhidos e entre as prateleiras
  mostradas.
- **Limitação que o B-79 corrige:** com uma biblioteca coerente, um gênero ou tema largo da IGDB
  ainda cobre a biblioteca inteira e encerra a escolha. Hollow Knight, Dead Cells, Hades, Celeste,
  Grim Dawn e Slay the Spire, todos com o tema Fantasia, ficam só com a prateleira de Fantasia,
  embora Metroidvania, Roguelike e Impiedoso sejam candidatas. Com dois gostos distintos (Inside e
  Limbo; Vampire Survivors e Brotato), saem as prateleiras "Inferno de Balas" e "Plataforma com
  Quebra-Cabeça".

**Navegador local:** 14 de 14 conferências: a ficha de Hollow Knight com 13 etiquetas e o link
para a página da loja, a ficha de um jogo da reserva com a atribuição à IGDB, o filtro pela URL e
pelo formulário, a busca por nome e as prateleiras e o "ver mais" de etiqueta. A busca casa o
trecho em qualquer lugar do nome, sem acento: "acao" também mostra Automação e Decoração.

### Em produção

- **Sonda da Steam, antes do merge (08/11/2026, 14:41 UTC):** a Steam respondeu ao GitHub
  Actions. Na amostra de 200 dos 22.834 jogos do catálogo (um a cada 114), 196 tinham id da
  Steam. As 4 requisições voltaram com status 200, sem nova tentativa, com latência mediana de
  140 ms e máxima de 190 ms (no local, a mediana foi de 268 ms). Na amostra, 194 jogos ficaram
  com etiquetas da Steam, 1 com a reserva e 5 sem etiqueta. O job inteiro levou 47 s e não gravou
  nada.
  - **Decisão do autor:** com o resultado da sonda, estima-se o tempo total da ingestão em
    produção (IGDB, ids, loja e gravação), comparando a velocidade da sonda com a da carga local.
    Se a estimativa passar de 25 minutos, o merge espera e as opções voltam ao autor; o workflow
    tem limite de 30 minutos.
  - **Estimativa:** de 18 a 20 minutos. A base foi a última ingestão em produção (02/11, 7 min de
    workflow e gravação de 17 s), mais cerca de 1 min para os ids, 7,5 min para a loja e até 2 min a
    mais na gravação. A loja é limitada a 1 requisição por segundo, e a sonda confirmou esse ritmo
    (4 requisições em 3,1 s).
- **Primeira ingestão em produção (08/11/2026):** o workflow levou 12 min 26 s, abaixo da
  estimativa, e o passo da ingestão, 11 min 43 s. Os ids da Steam saíram em 29 s (22.058 jogos), e
  as etiquetas da loja, em 452 s (21.912 ids); a gravação levou 23 s. Do catálogo de 23.085 jogos,
  21.721 (94,1%) ficaram com etiquetas da Steam, 493 com a reserva e 871 sem etiqueta. O log não
  teve nenhum aviso nem nova tentativa.
- **RSS da API** (condição do autor no B-77): o maior RSS entre a carga e três recargas precisa
  ficar abaixo de 450 MB; se passar, a decisão do vetor é revista. A medida vem na resposta da
  recarga do índice (`rssMb` e `heapUsedMb`) e no log da carga, e é tomada depois do merge e da
  primeira ingestão em produção.
  - **Linha de base (decisão do autor):** antes do merge, a `main` em produção é medida pelo mesmo
    método (reinício e três recargas), para separar o efeito das etiquetas do comportamento do
    coletor de lixo, que no local já levava a `main` acima de 450 MB. O critério não muda.
  - **Alternativa não aplicada:** se o critério falhar em produção, uma opção é fixar o limite de
    heap do Node no Render (`--max-old-space-size`), que no local manteve o RSS em até 317 MB
    com o limite de 256 MB. Ela só seria adotada por decisão do autor, depois da medição.
  - **Resultado (08/11/2026): critério atendido.** O RSS chegou a no máximo 216,7 MB, abaixo
    também da linha de base da `main`. As etiquetas ficam no vetor.

    | Medida (log da carga) | `main`, antes do merge | B-78, depois da ingestão |
    | --- | --- | --- |
    | Carga do reinício | 187,9 MB (13,8 s) | 165,7 MB (11,9 s) |
    | 1ª recarga | 225,2 MB (8,6 s) | 191,9 MB (7,6 s) |
    | 2ª recarga | 231,6 MB (9,1 s) | 215,8 MB (5,1 s) |
    | 3ª recarga | 253,0 MB (8,1 s) | 216,7 MB (5,4 s) |
    | Atributos no índice | 2.690 | 399 |

    - Em produção, com 512 MB, o Node coleta mais cedo que na máquina local: a mesma `main` chegou
      a 465 MB no local sem limite de heap e a 253 MB em produção.
    - O índice com etiquetas é menor e carrega mais rápido, porque a carga não lê mais os resumos
      nem os estilos.
    - A recarga feita pelo workflow, logo depois da ingestão, respondeu com `rssMb` de 188.
- **Conferência no navegador em produção** (conta de teste reutilizável): 13 de 13 conferências.
  - Ficha de Hollow Knight com 13 etiquetas e o link para a página da loja; ficha de Star Citizen com
    a atribuição à reserva da IGDB.
  - Filtro `?tag=metroidvania` com 811 jogos; busca por nome e filtro pelo formulário.
  - Na conta, a prateleira "Porque você curte Roguelike", com motivos como "Roguelike de Ação,
    Roguelike, Impiedoso", e o "ver mais" com 20 jogos.
  - Na primeira rodada, o script leu o título provisório da página do "ver mais" antes da carga;
    a conferência isolada mostrou o título final em 0,9 s.
- **Neon:** o painel de uso mostrou 137,04 MB de armazenamento antes e depois da ingestão; ele não
  tinha atualizado na hora da leitura. Pelo resumo da execução, o banco tem 134 MB
  (`pg_database_size`), dentro do limite de 1 GB.
  - `GameFeature`: 69 MB e 491.906 linhas.
  - Linhas mortas: 20.061 em `Game` e 2.652 em `Feature`, de uma vez só. A primeira gravação
    preencheu as colunas novas de todo jogo do catálogo e zerou o IDF das palavras-chave, que
    saíram do vetor.
  - Nas próximas execuções, só mudam as linhas que mudarem de fato.

## 11. Regra de prateleiras na plataforma (B-79)

Implementado em 08 e 09/11/2026. As decisões do plano foram aprovadas pelo autor e estão marcadas
abaixo como "decisão do autor". A regra é a da seção 6. O registro completo da recomendação está em
`docs/recomendacao.md` (seção "Recomendações específicas").

### Regra no código

- **Vocabulário no índice:** cada etiqueta que pode virar prateleira traz do `tags.json` o grupo
  (gênero ou subgênero, para a fase 1), o título e a ideia (`sameIdeaAs`). O índice também
  responde o Jaccard de dois atributos no catálogo, calculado na primeira vez que o par aparece.
- **Valores** (`config/recommendation.json`, com a justificativa de cada um):
  - até 6 prateleiras;
  - etiqueta específica em até 10% do catálogo;
  - suporte de 2 jogos;
  - atributo largo da IGDB em até 40% do catálogo;
  - Jaccard dos jogos da biblioteca acima de 0,8 barra a etiqueta na fase 1;
  - Jaccard dos jogos do catálogo acima de 0,5 barra a etiqueta na fase 2.
- **`u_k > 0` (decisão do autor):** continua exigido, como no B-71, para que uma nota negativa
  possa anular um atributo. O protótipo do B-77 não tinha essa condição; nenhum perfil dos
  critérios C1 a C5 tem nota negativa.
- **Ordem das preferências (decisão do autor):** pela frequência no catálogo e depois pela posição.
  O protótipo usava a ordem recebida, que o banco não garante.
- **Cota na lista principal:** o peso de todos os jogos da biblioteca que sustentam a prateleira,
  como no protótipo; a preferência sem jogo vale β. No empate do déficit, entra a prateleira que
  vem antes na página (decisão do autor).

### Mesma ideia: IGDB e Steam

A tabela de equivalência foi preparada com apoio de um assistente de IA no protótipo do B-77 e
aprovada pelo autor em 09/11/2026, com um par a mais (Music ↔ Ritmo). São 42 atributos da IGDB em
46 pares, gravados no campo `sameIdeaAs` das etiquetas. Simulação não está aceita no vocabulário, e
o par dela não tem efeito.

| Atributo da IGDB | Etiqueta da Steam |
| --- | --- |
| Gênero Adventure | Aventura |
| Gênero Arcade | Arcade |
| Gênero Card & Board Game | Cartas; Jogo de Tabuleiro; Jogo de Mesa |
| Gênero Fighting | Luta |
| Gênero Hack and slash/Beat 'em up | Hack and Slash; Beat 'em Up |
| Gênero MOBA | MOBA |
| Gênero Music | Música; Ritmo (acrescentado pelo autor) |
| Gênero Pinball | Pinball |
| Gênero Platform | Plataforma |
| Gênero Point-and-click | Point-and-Click |
| Gênero Puzzle | Puzzle |
| Gênero Quiz/Trivia | Perguntas e Respostas |
| Gênero Racing | Corrida |
| Gênero Real Time Strategy (RTS) | Estratégia em Tempo Real (RTS) |
| Gênero Role-playing (RPG) | RPG |
| Gênero Shooter | Tiro |
| Gênero Simulator | Simulação (não aceita) |
| Gênero Sport | Esportes |
| Gênero Strategy | Estratégia |
| Gênero Tactical | Tático |
| Gênero Turn-based strategy (TBS) | Estratégia em Turnos |
| Gênero Visual Novel | Visual Novel |
| Tema 4X | 4X |
| Tema Action | Ação |
| Tema Business | Gerenciamento |
| Tema Comedy | Comédia; Engraçado |
| Tema Educational | Educativo |
| Tema Fantasy | Fantasia |
| Tema Historical | Histórico |
| Tema Horror | Terror |
| Tema Kids | Para Toda a Família |
| Tema Mystery | Mistério |
| Tema Open world | Mundo Aberto |
| Tema Party | Party Game |
| Tema Romance | Romance |
| Tema Sandbox | Sandbox |
| Tema Science fiction | Ficção Científica |
| Tema Stealth | Furtividade |
| Tema Survival | Sobrevivência |
| Tema Thriller | Thriller |
| Tema Warfare | Guerra |

As etiquetas estão com os nomes da seção 12.

### Conformidade com o protótipo e critérios

Os critérios foram gravados antes de medir, no mesmo formato do B-77, no catálogo local (ingestão
de 07/11/2026).

- **Conformidade:** o protótipo `rule-c6.mts` foi portado para o índice atual, com a tabela de
  ideias pelos nomes em inglês e o Jaccard calculado à parte, sem usar o código novo. Nos 606
  perfis (regressão, 4 realistas, caso Fantasia do B-78, 200 por preferências, 200 coerentes e 200
  sorteados), a implementação deu os mesmos interesses, na mesma ordem, com as mesmas cotas e os
  mesmos jogos de apoio: 606 de 606.
- **Critérios, pela implementação completa** (com as prateleiras por jogo antes das de interesse e
  a remoção dos repetidos):

| Critério | Resultado |
| --- | --- |
| C1 original / revisado (registro) | passa / não passa (limitação da seção 7) |
| C2, Amnesia | passa |
| C3, perfis realistas | passa, com as mesmas prateleiras da seção 6 |
| C4, preferências | 200 de 200 |
| C5 (a), (b), (c) | 100%; 88,0%; 0% |
| Ideia repetida | nenhuma |

- **Prateleiras por jogo:** aparecem nos 406 perfis com avaliações (2 em cada) e em nenhum dos 200
  só com preferências. Os números das prateleiras de interesse são os mesmos com e sem elas.
- **Caso Fantasia do B-78** (Hollow Knight, Dead Cells, Hades, Celeste, Grim Dawn e Slay the Spire):
  antes ficava só "Fantasia"; agora saem Roguelike, Soulslike, Fantasia (atributo largo, só para os
  jogos sem etiqueta de gênero ou subgênero), Difícil, Metroidvania e Hack and Slash.

## 12. Nomes da comunidade (B-79)

**Decisão do autor (09/11/2026):** o nome em português da Steam é trocado pelo termo que a
comunidade usa quando é o que o jogador brasileiro fala, e fica em português quando o português é
natural. Os slugs, que vêm do nome em inglês, e as URLs não mudam. O nome antigo fica em `aliases`
no `tags.json`, e a busca do filtro do catálogo também o encontra.

| Nome da Steam | Nome novo |
| --- | --- |
| Quebra-Cabeça | Puzzle |
| Faça o que Quiser | Sandbox |
| Plataforma com Quebra-Cabeça | Puzzle Platformer |
| Impiedoso | Difícil |
| Romance Visual | Visual Novel |
| Apontar e Clicar | Point-and-Click |
| Gráficos Pixelados | Pixel Art |
| Montagem de Decks | Deckbuilding |
| Montagem de Decks Roguelike | Roguelike Deckbuilder |
| Batalha com Cartas | Card Battler |
| Mandando Bala | Shoot 'em Up |
| SHMUP com Visão Superior | Top-Down Shooter |
| Inferno de Balas | Bullet Hell |
| Paraíso de Balas | Bullet Heaven |
| Porradaria | Beat 'em Up |
| Explorador de Calabouços | Dungeon Crawler |
| Calabouço Misterioso | Mystery Dungeon |
| Tiro de Tiozão | Boomer Shooter |
| Tiro com Saques | Looter Shooter |
| Tiro de Extração | Extraction Shooter |
| Tiro de Heróis | Hero Shooter |
| Tiro em Arena | Arena Shooter |
| Tiro em Primeira Pessoa (FPS) | FPS |
| Controle com Alavanca Dupla | Twin Stick Shooter |
| Tiro sobre Trilhos | Rail Shooter |
| Jogo de Ação Focado em Personagem | Character Action |
| Simulador Imersivo | Immersive Sim |
| Coleção de Criaturas | Creature Collector |
| Progressão Ociosa | Idle |
| Batalha Automática | Auto Battler |
| Fuja da Sala | Escape Room |
| Combinar 3 | Match 3 |
| Corredor | Endless Runner |
| Saques | Loot |
| Fabricação | Crafting |
| Duelo contra Chefões | Boss Rush |
| Simulador de Encontros | Dating Sim |
| Você Decide | Escolhas Importam |
| Reúna a Galera | Party Game |
| Estrada de Terra | Off-Road |
| Mágica | Magia |
| Furtivo | Furtividade |
| Simulador de Vida Real | Simulador de Vida |
| Simulador Rural | Simulador de Fazenda |

**Títulos revisados**, para ficarem coerentes com os nomes novos (os outros títulos já combinavam):

| Etiqueta | Título antes | Título novo |
| --- | --- | --- |
| Deckbuilding | construção de baralho (deckbuilding) | jogos de deckbuilding |
| Top-Down Shooter | tiro com visão de cima | top-down shooters |
| Twin Stick Shooter | tiro com dois analógicos (twin stick) | twin stick shooters |
| Character Action | ação focada em combos | jogos de character action |
| Creature Collector | coleta de criaturas | creature collectors |
| Escape Room | jogos de sala de fuga | escape rooms |
| Endless Runner | runners (corrida infinita) | endless runners |
| Boomer Shooter | boomer shooters (tiro retrô) | boomer shooters |
| Party Game | jogos para jogar com a galera | party games |

- **Na produção:** o nome do atributo é gravado pela ingestão, que atualiza o nome do `Feature` já
  gravado quando ele muda. Os nomes novos chegam à produção na primeira ingestão depois do deploy.
- **Medições anteriores:** as tabelas das seções 2 a 7 e 10 usam os nomes da época.
