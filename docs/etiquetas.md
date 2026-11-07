# Etiquetas da comunidade Steam (B-77)

Medição feita entre 05/11 e 07/11/2026, sem mudar o que a API usa. O resultado é o vocabulário de
etiquetas aceitas (`apps/api/config/tags.draft.json`), a decisão de pôr as etiquetas no vetor e a
regra de prateleiras que o B-79 implementa. A ingestão e a interface ficam para o B-78.

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
  Montagem de Decks → "construção de baralho (deckbuilding)".
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
- **Termos da Web API da Steam:**
  - limite de 100 mil chamadas por dia, quando o catálogo inteiro pede cerca de 450;
  - a ficha cita "Etiquetas da comunidade Steam", sem sugerir endosso da Valve;
  - a Valve pode cortar o acesso a qualquer momento, e nesse caso a reserva da IGDB e as etiquetas
    já gravadas continuam valendo.

## 9. Para os próximos itens

- **B-78:**
  - ingestão do id da Steam e das etiquetas aceitas, no peso mínimo 0,3, com o vocabulário
    `tags.draft.json` revisado;
  - ficha e filtro do catálogo;
  - etiquetas no vetor, no lugar das palavras-chave;
  - RSS da API medido depois da carga e de três recargas em produção.
- **B-79:**
  - a regra de duas fases com até 6 prateleiras, com os títulos do vocabulário;
  - prateleiras "Porque você gostou de `<jogo>`" só para jogos com nota 4 ou mais, ou em favoritos.
    Um jogo só em "quero jogar" ou só em "concluídos" nunca gera essa prateleira;
  - a visão geral passa a ter até 10 seções e, com as prateleiras por jogo, é medida de novo em produção
    pela metodologia do B-33, com p95 fim a fim abaixo de 1 s.
- **B-37:** calibrar o limite de frequência das prateleiras (10%, 15% e 20%).
- **B-44:** observar se o jogador percorre a visão geral até o fim.
