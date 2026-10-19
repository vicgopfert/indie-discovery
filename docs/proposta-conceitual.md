# Plataforma Web de Descoberta de Jogos Independentes

Oct 19, 2026 · @Victor Gopfert

*Recomendação explicável e controle de popularidade.* Proposta de Trabalho de Conclusão de Curso · Tecnologia em Análise e Desenvolvimento de Sistemas · Universidade do Estado do Rio de Janeiro (UERJ) · Autor: Victor Gopfert Ferreira Figueiredo · Orientadora: Adriana Aparicio Sicsú Ayres do Nascimento

## 1. Apresentação

Este documento propõe uma plataforma web que ajuda jogadores a descobrir jogos independentes compatíveis com o próprio gosto. A plataforma recomenda pela afinidade entre as características dos jogos e as preferências de cada pessoa, explica por que cada título foi indicado e deixa o usuário decidir o quanto quer se afastar do que já é popular. O catálogo inclui jogos que ainda vão ser lançados.

O projeto parte de um problema conhecido da indústria: há muito mais jogos independentes sendo lançados do que atenção disponível para eles, e os mecanismos de descoberta das lojas favorecem o que já acumulou vendas, avaliações e listas de desejos. Jogos pequenos e jogos ainda não lançados ficam para trás justamente por não terem esse histórico.

A proposta foi construída sobre duas pesquisas de campo realizadas em outubro de 2026: entrevistas com seis desenvolvedores de jogos independentes na Brasil Game Show e um questionário respondido por 60 jogadores. As duas pesquisas confirmaram o problema, corrigiram premissas da versão anterior e deram base para as escolhas descritas aqui.

### O que mudou em relação à versão anterior

Esta versão substitui a proposta de 9 de outubro de 2026. Três revisões vêm diretamente das pesquisas:

- **A popularidade passa a ser calibrada pelo usuário, e não penalizada de forma fixa.** Quatro dos seis desenvolvedores consideraram arriscado rebaixar automaticamente os jogos populares, e 75% dos jogadores preferem um equilíbrio entre conhecidos e desconhecidos ou uma escolha que dependa do momento.
- **Jogos ainda não lançados entram no catálogo.** Quatro dos seis jogos dos desenvolvedores entrevistados estavam em pré-lançamento, e 78,3% dos jogadores costumam adicionar jogos não lançados à lista de desejos.
- **O país de origem do estúdio deixa de ser o eixo da plataforma.** Para 6,7% dos jogadores ele pesa bastante na escolha de um jogo, contra 33,3% para a cultura retratada no jogo e 33,3% para a disponibilidade em português. O que está dentro do jogo ganha prioridade sobre onde a empresa foi registrada.

O título também mudou. A versão anterior falava em "recomendação e divulgação"; esta fala em descoberta. A plataforma pode ampliar a exposição de jogos independentes, mas esse efeito depende de audiência e não pode ser comprovado no âmbito deste trabalho. A palavra foi trocada para que o título não prometa mais do que o projeto entrega.

### Escopo deste documento

Este é um documento estratégico e conceitual. Ele descreve o problema, as evidências, a solução proposta, seu valor e seu posicionamento. Arquitetura, tecnologias, funcionalidades detalhadas, requisitos e cronograma serão tratados em documento separado.

## 2. Contexto da indústria

### 2.1 Uma oferta que cresce mais rápido que a atenção

A Steam, principal loja de jogos para computador, recebeu cerca de 20 mil lançamentos em 2025, segundo estimativa da Alinea Analytics — mais de 50 jogos novos por dia. Quase toda essa oferta é independente: a Video Game Insights classificou 99,9% dos jogos lançados na Steam como indie, em dados até setembro de 2024.

A receita, por outro lado, se concentra. Segundo a Alinea Analytics, os jogos independentes responderam por cerca de 25% da receita da Steam em 2025, aproximadamente US$ 4,5 bilhões de um total superior a US$ 17,7 bilhões. Só os cinco maiores lançamentos indie do ano somaram mais de US$ 500 milhões, perto de 3% de toda a receita da loja. Estimativas de terceiros indicam que apenas cerca de 8% dos jogos lançados superaram US$ 100 mil de receita bruta.

Os números variam conforme quem mede. A Video Game Insights estimou que os jogos indie geraram 48% da receita da Steam em 2024; a Alinea chegou a 25% para 2025. A diferença se explica, em boa parte, pela definição de "indie" que cada fonte adota. Essa ambiguidade não é um detalhe: ela atravessa toda a discussão sobre o setor e volta a aparecer nas pesquisas deste trabalho.

### 2.2 A descoberta depende de sinais que o jogo novo ainda não tem

Nas lojas digitais, a visibilidade costuma ser uma escada. Um jogo aparece em listas de destaque quando já acumulou sinais de interesse, como vendas, avaliações e listas de desejos. Na Steam, a seção de próximos lançamentos populares depende do número de listas de desejos, e especialistas em marketing de jogos recomendam reunir entre 7 mil e 10 mil delas antes do lançamento.

O efeito é circular: para ser visto, o jogo precisa de sinais; para acumular sinais, precisa ser visto. Quem chega sem público prévio, sem orçamento de marketing ou ainda antes do lançamento começa em desvantagem.

Os canais externos ajudam, mas com limites. Um estudo publicado na *Marketing Science* em 2025, com dados de cerca de 60 mil transmissores da Twitch, mostrou que as transmissões ao vivo tornam conhecidos jogos de publishers menores. O efeito, porém, é modesto e se dissipa em poucas horas, e os autores estimam que só cerca de um sexto dos jogos lucra com transmissões patrocinadas.

### 2.3 Os recomendadores tendem a reforçar o que já é popular

Sistemas de recomendação são frequentemente apresentados como a forma de dar visibilidade à cauda longa de um catálogo, isto é, ao grande número de itens pouco conhecidos. A literatura da área documenta o efeito oposto: o **viés de popularidade**, tendência de os algoritmos concentrarem recomendações nos itens que já são populares e, com isso, reforçarem essa concentração ao longo do tempo.

O problema é percebido pelos próprios jogadores. Em 2019, ao anunciar uma revisão de seu sistema de descoberta, a Steam reconheceu reclamações de que suas recomendações "usually just showed whatever is popular at the time". A literatura mais recente acrescenta uma nuance importante: as pessoas têm tolerâncias diferentes a itens populares, e técnicas que corrigem o viés da mesma forma para todos ignoram essa diferença.

### 2.4 O cenário brasileiro

O Brasil tem uma produção de jogos consolidada. A 2ª Pesquisa Nacional da Indústria de Games, da Abragames com a ApexBrasil, registrou 1.042 estúdios, 13.225 profissionais e cerca de 2.600 jogos próprios desenvolvidos entre 2020 e 2022. Há casos de jogos brasileiros que despertaram interesse justamente pelo que retratam: o anúncio de Hell Clock, ambientado na Guerra de Canudos, foi seguido de um aumento de 600% nas buscas pelo tema no Google.

Esse potencial convive com as mesmas barreiras de descoberta do mercado global. Os desenvolvedores entrevistados neste trabalho descrevem essas barreiras como agravadas pelo custo de eventos, anúncios e parcerias com criadores de conteúdo.

## 3. O problema

**Jogos independentes, sobretudo os pequenos e os ainda não lançados, não chegam aos jogadores que gostariam deles.** O problema não é a falta de jogos nem a falta de interesse, e sim um descompasso entre os dois. Três mecanismos o produzem.

**O volume.** Com dezenas de lançamentos por dia, nenhum jogador consegue acompanhar a oferta, e nenhuma vitrine consegue exibi-la por inteiro.

**Os sinais acumulados.** Os mecanismos de destaque das lojas dependem de vendas, avaliações e listas de desejos. Um jogo novo ou pequeno ainda não tem esses sinais e, por isso, não é mostrado. Na área de sistemas de recomendação, isso se chama **partida a frio do item**: um item sem histórico de interações não tem como ser recomendado por sistemas que se baseiam no comportamento de outros usuários.

**O viés de popularidade e a opacidade.** Os recomendadores tendem a reforçar o que já é conhecido e oferecem pouca transparência sobre os critérios que produzem cada sugestão. O jogador não sabe por que um jogo apareceu, e o jogo que não apareceu nunca chega a ser considerado.

No questionário deste trabalho, a barreira mais citada pelos jogadores para experimentar jogos independentes foi exatamente essa: "não fico sabendo deles ou não sei qual escolher", marcada por 45% dos respondentes. Um dos desenvolvedores entrevistados resumiu o mesmo problema do outro lado: "a gente não chega na galera que gostaria do nosso jogo".

### O que fica fora do alcance deste projeto

A palavra "visibilidade" costuma reunir problemas diferentes, e nem todos podem ser enfrentados por uma plataforma de descoberta. As pesquisas identificaram pelo menos cinco que ficam fora do escopo:

- o custo de marketing, eventos e parcerias com criadores de conteúdo;
- a capacidade das equipes pequenas de manter comunidade e presença constante nas redes;
- o preconceito com determinados estilos de jogo, relatado por um dos desenvolvedores;
- o preço dos jogos, citado como barreira por 16,7% dos jogadores;
- a falta de tempo para jogar, citada por 28,3%.

Delimitar o problema dessa forma é parte da proposta. A plataforma ataca o descompasso entre jogos e jogadores com afinidade. Ela não substitui o trabalho de divulgação dos estúdios nem resolve as limitações de tempo e orçamento de quem joga.

## 4. Como a proposta foi construída

A proposta foi revisada a partir de duas pesquisas de campo complementares: uma com quem faz os jogos, outra com quem joga. Elas ouviram os dois lados sobre os mesmos temas, o que permitiu comparar diretamente oferta e demanda.

|  | Entrevistas com desenvolvedores | Questionário com jogadores |
| --- | --- | --- |
| Natureza | Estudo exploratório qualitativo | Levantamento quantitativo exploratório |
| Participantes | 6 profissionais de estúdios independentes expositores na área indie do evento | 60 respostas válidas, de 61 recebidas |
| Local e período | Brasil Game Show, São Paulo, 10 a 12 de outubro de 2026 | Formulário online anônimo, 16 a 18 de outubro de 2026 |
| Instrumento | Roteiro semiestruturado de dez perguntas | 24 perguntas em oito seções |
| Amostra | Por conveniência, com indicação em cadeia entre os entrevistados | Por conveniência, divulgada na rede pessoal do autor |
| Serve para | Levantar necessidades, requisitos e objeções | Dimensionar preferências e decidir o escopo |

Duas escolhas de método reduzem o risco de respostas de cortesia. Nas entrevistas, a proposta só foi apresentada depois das perguntas sobre a realidade de cada estúdio, sempre com o mesmo texto. No questionário, a ideia só aparecia na última seção, e os critérios de decisão — quais resultados manteriam ou mudariam cada elemento do projeto — foram fixados **antes** da coleta. Um desses critérios acabou rebaixando o país de origem, que estava no centro da proposta anterior.

### Limites

As duas pesquisas descrevem quem participou delas e não representam, estatisticamente, os desenvolvedores ou os jogadores brasileiros. Em particular:

- **Os desenvolvedores entrevistados são os que chegaram a um estande na BGS**, ou seja, estúdios que já investem em visibilidade. Os menores, que não conseguem ir a eventos, ficaram de fora.
- **Quatro dos seis jogos ainda não haviam sido lançados**, e as funções dos entrevistados variavam entre criação, arte e comunicação.
- **Em quatro entrevistas, o entrevistador sugeriu alternativas** antes de o entrevistado concluir a resposta sobre popularidade. As preferências que surgiram depois disso são tratadas como indução, não como opinião espontânea.
- **95% das respostas ao questionário vieram da rede pessoal do autor**, por mensagem direta ou indicação de amigos. Nenhuma veio de redes públicas. A amostra é jovem (73,3% entre 18 e 24 anos) e concentrada em computador (83,3%).
- **A meta de 100 respostas não foi atingida**; as 60 válidas superam o mínimo de 50 que havia sido fixado para a análise.

Ao longo do documento, os números das pesquisas aparecem sempre como resultados desta amostra. Os entrevistados são identificados por código (E1 a E6), e trechos literais aparecem entre aspas.

## 5. A perspectiva dos desenvolvedores

Os seis entrevistados têm perfis diferentes: de um desenvolvedor solo a um estúdio médio de 21 pessoas, de projetos autofinanciados a jogos com publisher, de um sucesso comercial consolidado a quatro jogos ainda sem data de lançamento. Apesar disso, seis temas atravessaram as conversas.

### Visibilidade é o problema, mas com faces diferentes

Todos descreveram a visibilidade como dificuldade real. Perguntados se ela seria seu maior gargalo, numa escala de 1 a 5, os quatro que deram nota responderam 3, 4, 3 e 4 — nenhum a máxima. Por trás da mesma palavra apareceram problemas distintos: não alcançar o público que gostaria do jogo, fazer as pessoas entenderem do que o jogo trata, juntar listas de desejos antes do lançamento, pagar por eventos e anúncios, manter comunidade com equipe pequena e enfrentar preconceito com o estilo do jogo. Apenas os dois primeiros estão diretamente ao alcance de uma plataforma de descoberta.

### Nenhum pediu uma plataforma de descoberta

Perguntados sobre que ajuda gratuita de divulgação pediriam primeiro, dois citaram acesso a criadores de conteúdo ou mídia paga, dois pediram alguém que entendesse e mostrasse a essência do jogo, um pediu apoio para construir comunidade e um descreveu um recurso da própria Steam. **Nenhum mencionou uma plataforma como a proposta.** Para o desenvolvedor, ela é um canal complementar, não a necessidade que ele formula sozinho.

### Não há consenso sobre o que é indie

Cada entrevistado usou um critério diferente: pouco financiamento, autonomia criativa, autofinanciamento, investimento abaixo de "milhões e milhões", ausência de grande corporação por trás, ausência de investidor externo. Os critérios entraram em conflito entre si: um teto de US$ 1 milhão, defendido por um, excluiria o jogo de outro, que relatou orçamento de cerca de US$ 1,5 milhão. Dois desenvolvedores divergiram sobre se Clair Obscur: Expedition 33, vencedor do prêmio de Melhor Jogo Independente do The Game Awards 2025, é indie. E dois dos três que têm publisher disseram que um critério baseado na ausência de publisher os excluiria, embora se considerem independentes.

### A penalização fixa por popularidade foi rejeitada

Quatro dos seis consideraram arriscado um sistema que rebaixa de propósito os jogos mais populares. Os argumentos foram concretos: o jogo popular pode ainda precisar de público e ajuda a atrair usuários para a própria plataforma; jogos de popularidade média acabariam escondidos; e, nas palavras de um deles, "se um jogo é muito popular ele tem uma razão". Os dois favoráveis apontaram que as lojas só abrem espaço para jogos desconhecidos em momentos específicos, e que uma plataforma "deveria ter isso a todo momento".

### A identidade brasileira importa, mas como conteúdo

Quatro avaliaram positivamente ser encontrados como jogo brasileiro, um se mostrou ambíguo e um disse que isso é "só uma curiosidade". O ponto decisivo está no que eles valorizavam: a história do Brasil retratada no jogo, o apelo turístico de um cenário brasileiro, o desejo de encontrar "um jogo que tem cultura coreana". Todos falavam do que está **dentro** do jogo, não do país onde a empresa está registrada.

### O pré-lançamento é o momento crítico

Quatro dos seis jogos estavam em pré-lançamento. Para esses estúdios, o que importa agora não é vender, e sim acumular listas de desejos, que são o principal sinal de interesse antes da estreia. Dois entrevistados também disseram preferir que o catálogo fosse montado automaticamente a partir de bases já existentes, em vez de exigir cadastro manual.

Um entrevistado levantou ainda o risco mais difícil do projeto: "o maior desafio que você teria nesse projeto é conseguir que o público entenda que ele consegue encontrar jogos legais na sua plataforma". Esse ponto volta na análise integrada.

## 6. A perspectiva dos jogadores

O questionário perguntou primeiro sobre o comportamento atual dos jogadores e só no fim apresentou a ideia da plataforma. Os resultados abaixo seguem essa ordem.

### Como os jogadores descobrem jogos hoje

Perguntados, com as próprias palavras, como souberam do último jogo que começaram a jogar, os respondentes citaram principalmente vídeos e transmissões ao vivo (28,3%), redes sociais (13,3%), amigos (11,7%), franquias que já acompanhavam (11,7%) e a própria loja (10%). **Nenhum chegou ao jogo por um site de recomendação**, e 20 dos 39 que responderam à pergunta sobre ferramentas disseram não usar nenhuma para descobrir jogos; entre os que usam, a mais citada foi a própria Steam.

As recomendações das lojas convencem pouco: só 8,3% dizem que elas costumam acertar o próprio gosto, 26,7% dizem que mostram "quase sempre os mesmos jogos famosos" e 28,3% nem prestam atenção nelas.

### O problema existe, mas é moderado

A principal barreira para experimentar jogos independentes é não ficar sabendo deles ou não saber qual escolher, com 45%. Esse é exatamente o problema que a plataforma enfrenta. Mas falta de tempo (28,3%) e preço (16,7%) também pesam, e nenhum dos dois se resolve com descoberta. Encontrar um jogo novo que combine com o próprio gosto é difícil para 35% e fácil para 25%; o restante fica no meio.

Há também um dado de comportamento relevante para qualquer serviço de descoberta: 45% dos respondentes raramente procuram ativamente um jogo novo, e 10% nunca procuram.

### O interesse pela proposta

Depois de lerem uma descrição padronizada da plataforma, 70% dos respondentes deram nota 4 ou 5 à chance de usá-la. Entre os 29 que jogaram algum jogo independente nos últimos seis meses — o público mais próximo do pretendido —, a proporção foi de 62,1%, acima do limite de 50% que havia sido fixado para manter o foco do projeto.

Um resultado pede cautela: quem **não** jogou indie no período deu notas mais altas (77,3% entre 4 e 5) do que quem jogou. A pesquisa não permite saber se isso indica que esse grupo veria mais valor em ser apresentado a jogos independentes ou se reflete entusiasmo com uma ideia que não chegaria a usar.

### O que os jogadores valorizam

| Tema | Resultado |
| --- | --- |
| Função mais útil | Recomendações personalizadas com o motivo de cada uma: 85% · Escolher entre populares e pouco conhecidos: 58,3% · Jogos que ainda vão ser lançados: 25% · Filtro por país do estúdio: 10% · Seção de jogos brasileiros: 8,3% |
| Preferência de popularidade | Equilíbrio entre conhecidos e pouco conhecidos: 46,7% · Depende do momento: 28,3% · Jogos que muita gente já joga: 20% · Principalmente pouco conhecidos: 5% |
| O que pesa na escolha (pesa bastante ou é decisivo) | Cultura ou lugar retratado no jogo: 33,3% · Legenda ou dublagem em português: 33,3% · País onde o jogo foi feito: 6,7% · O jogo ser brasileiro: 6,7% |
| Jogos não lançados | 78,3% adicionam jogos ainda não lançados à lista de desejos, com frequência ou às vezes |
| Esforço inicial aceito | 48,3% topam avaliar de 1 a 4 jogos para receber recomendações; 16,7% não avaliariam nenhum |
| Confiança na justificativa | 50% confiariam mais numa recomendação que mostra o motivo (nota 4 ou 5) |

Dois desses resultados merecem leitura cuidadosa. O primeiro é a explicação das recomendações: a função "recomendações personalizadas com o motivo de cada uma" foi a mais escolhida, mas só metade dos respondentes disse que o motivo aumentaria a confiança. Como a opção juntava personalização e justificativa, a leitura mais prudente é que **a personalização atrai, e a justificativa é um diferencial de apoio**.

O segundo é o país de origem. Um respondente escreveu, sem ser perguntado: "A plataforma focar em recomendar jogos de um determinado país, seja qual for […] Mas acho legal a ideia de ter filtro por país." Apenas 11,7% jogaram algum jogo feito no Brasil nos últimos 12 meses.

### O que afastaria os jogadores

Entre os 41 que responderam à pergunta aberta sobre o que os faria não usar a plataforma, quase metade citou interface ruim, lenta ou confusa (48,8%). Seguiram-se a qualidade das recomendações (22%) e o excesso de anúncios ou cobrança (19,5%). Várias respostas descreveram, com outras palavras, o próprio problema que justifica o projeto: "se recomendasse somente os mesmos mais populares de sempre"; "como se quisesse me guiar para algo óbvio ou repetitivo"; "indicação tendenciosas, forçando escolher tal jogo, por comissão por exemplo".

Três respondentes levantaram, espontaneamente, o risco de simplesmente esquecer que a plataforma existe. Um deles: "Me incomoda ter um site só pra buscar jogos indies […] Provavelmente eu ia até esquecer da existência do site."

## 7. Análise integrada

Lidas em conjunto, as duas pesquisas convergem no diagnóstico, corrigem uma premissa importante e apontam o risco central do projeto.

| Tema | Desenvolvedores | Jogadores | Síntese |
| --- | --- | --- | --- |
| O problema central | "Não chega na galera que gostaria do nosso jogo" | 45%: não ficam sabendo dos jogos ou não sabem qual escolher | Convergência: o descompasso existe dos dois lados |
| O que é indie | Seis critérios, sem consenso | Equipe pequena (40,4%), sem grande empresa (38,3%), orçamento baixo (25,5%) | Núcleo comum, ênfases diferentes |
| Popularidade | 4 de 6 rejeitam a penalização fixa | 5% querem principalmente desconhecidos; 75% querem equilíbrio ou escolha | Convergência: o usuário deve decidir |
| País de origem | Valorizado, mas falando do conteúdo do jogo | 6,7% contra 33,3% da cultura retratada e do idioma | Premissa corrigida |
| Jogos não lançados | 4 de 6 jogos em pré-lançamento | 78,3% usam lista de desejos para eles | Complementaridade mais forte |
| Adesão | "O maior desafio […] é conseguir que o público entenda" | 55% raramente ou nunca procuram jogos; 3 citaram esquecer do site | Risco central, apontado pelos dois lados |

### O descompasso é real dos dois lados

O desenvolvedor descreve um jogo que não alcança quem gostaria dele. O jogador descreve jogos dos quais não fica sabendo. São duas faces do mesmo problema, e é esse problema — não a visibilidade em geral — que a plataforma se propõe a enfrentar.

### Os dois lados querem calibrar a popularidade, não eliminá-la

Nenhum dos grupos apoia um sistema que esconde sistematicamente o que é popular. Os desenvolvedores temem que jogos de sucesso moderado sumam; os jogadores, em sua maioria, querem equilíbrio. A convergência coincide com o que a literatura mais recente sobre viés de popularidade recomenda: ajustar a correção à tolerância de cada pessoa, em vez de aplicá-la igualmente a todos.

### O país era o atributo errado para uma necessidade real

As entrevistas davam um sinal positivo sobre a identidade brasileira dos jogos, e esse sinal poderia ter sido lido como apoio à navegação por país de origem. A leitura atenta das falas mostrou que os desenvolvedores se referiam à cultura retratada nos jogos; o questionário confirmou que, para o jogador, a cultura e o idioma pesam cinco vezes mais do que o país. A necessidade existe, mas é de **conteúdo**, não de **cadastro**. Este foi o principal ajuste que as pesquisas imprimiram à proposta.

### O pré-lançamento é onde os dois lados se encontram

O momento em que o desenvolvedor mais precisa de atenção é antes da estreia, quando ainda não tem vendas nem avaliações. Esse é também um momento que os jogadores já acompanham, por meio das listas de desejos. Uma recomendação baseada nas características do jogo, e não no comportamento de outros usuários, pode alcançar justamente esses títulos sem histórico. É o ponto em que a necessidade de um lado, o hábito do outro e a natureza da técnica escolhida se alinham.

### Interesse não é hábito

O risco mais importante foi apontado pelos dois lados de forma independente. Um desenvolvedor previu a dificuldade de atrair público para a plataforma; três jogadores disseram que esqueceriam dela; e mais da metade dos respondentes raramente ou nunca sai procurando jogos novos. O interesse declarado — 70% de notas altas — não garante uso recorrente. Somado ao fato de que a amostra veio quase toda da rede pessoal do autor, isso significa que **a demanda está indicada, mas não comprovada**.

## 8. Soluções existentes e a lacuna

Há muitas formas de descobrir jogos hoje, e cada uma resolve parte do problema. Nenhuma, no levantamento realizado, reúne personalização por afinidade de conteúdo, transparência sobre os motivos, controle do usuário sobre a popularidade e alcance a jogos ainda sem histórico.

| Solução | O que oferece | O que não oferece |
| --- | --- | --- |
| Steam | Maior catálogo; recomendador baseado no comportamento de jogadores parecidos; opção de equilibrar jogos populares e de nicho, recentes e clássicos | Pouca transparência sobre os critérios; jogos sem histórico de jogadores têm pouco sinal para serem recomendados; é loja e tem interesse comercial |
| itch.io | Vitrine aberta e ampla de jogos independentes, com filtros por gênero, plataforma e preço | Recomendação personalizada; filtro por país |
| The Gaming Nest | Guia editorial de jogos independentes de várias regiões do mundo, com filtros por gênero, plataforma e país | Personalização, avaliações de usuários; o catálogo, de cerca de mil títulos, depende de seleção manual |
| Backloggd | Registro da coleção, avaliações, listas, lista de desejos e recursos sociais | Recomendação personalizada; as seções de destaque são gerais, iguais para todos |
| Criadores de conteúdo e redes sociais | O canal de descoberta mais citado pelos jogadores e o que mais gera vendas, segundo os desenvolvedores | Alcance limitado aos jogos que os criadores escolhem mostrar; efeito curto e caro para o estúdio |
| Moreira e Soares (2024) | Proposta acadêmica de modelagem de uma plataforma para jogos independentes brasileiros, voltada a desenvolvedores e jogadores | Pelo resumo publicado, não há recomendador implementado nem avaliação mensurável |

Dois pontos precisam ser ditos com clareza. O primeiro é que **controlar a popularidade, isoladamente, não é inédito**: a Steam já oferece ao usuário um equilíbrio entre jogos populares e de nicho. O segundo é que **filtrar por país também não é**: o The Gaming Nest já o faz, de forma editorial.

A lacuna, portanto, não está em nenhum recurso isolado, e sim na combinação. Não foi identificada solução que recomende jogos independentes **pelas características do próprio jogo**, **explique** cada indicação, deixe o usuário **calibrar** o grau de novidade e alcance **jogos ainda não lançados**, sobre um catálogo com critério de recorte público. A originalidade dessa combinação será confirmada na revisão bibliográfica do trabalho.

A plataforma também não se propõe a substituir o canal dominante. Vídeos e redes sociais continuarão sendo o principal caminho de descoberta para a maioria dos jogadores. A proposta é complementar: alcançar os jogos que esses canais não mostram, para as pessoas que eles não alcançam.

## 9. Justificativa

O projeto se justifica em três planos: a relevância do problema, a contribuição acadêmica e a solidez do processo que levou à proposta.

### Relevância do problema

O descompasso entre oferta e atenção no mercado de jogos independentes está quantificado por fontes de mercado e foi confirmado dos dois lados pelas pesquisas de campo. A principal barreira relatada pelos jogadores para experimentar jogos independentes — não saber que eles existem ou não saber qual escolher — é precisamente o problema que a plataforma enfrenta. Do lado dos desenvolvedores, o momento de maior necessidade, o pré-lançamento, é justamente aquele em que os mecanismos atuais de descoberta menos funcionam.

O cenário brasileiro, com mais de mil estúdios e milhares de jogos lançados em poucos anos, dá ao problema uma dimensão local concreta. A plataforma não é voltada exclusivamente a jogos nacionais, mas um sistema que não depende de popularidade acumulada beneficia, por construção, quem tem menos acesso a ela.

### Contribuição acadêmica

O trabalho se conecta a três problemas reconhecidos na área de sistemas de recomendação:

1. **O viés de popularidade**, documentado em revisões sistemáticas recentes, e a proposta de tratá-lo como parâmetro ajustado por cada usuário, em linha com a literatura que mostra que as pessoas têm tolerâncias diferentes a itens populares.
2. **A explicabilidade**, isto é, a capacidade de um sistema de mostrar por que fez cada recomendação, em contraste com a opacidade dos recomendadores comerciais.
3. **A partida a frio do item**, o problema de recomendar algo que ainda não tem histórico de uso. A recomendação baseada em características do próprio jogo é uma resposta conhecida a esse problema, aqui aplicada a jogos ainda não lançados.

Há ainda uma contribuição conceitual: a definição operacional de jogo independente. O termo não tem definição única, e as próprias fontes de mercado chegam a números diferentes por defini-lo de formas distintas. O trabalho propõe um critério explícito, documentado e confrontado com casos reais, incluindo os dos estúdios entrevistados. As pesquisas mostraram que desenvolvedores e jogadores compartilham um núcleo comum de definição — porte da equipe, orçamento e ausência de grande empresa por trás —, o que dá base para um critério que, embora sempre discutível, não é arbitrário.

O projeto produz, além disso, um resultado mensurável: o efeito do grau de novidade escolhido sobre a diversidade do que é recomendado. Isso permite avaliar a proposta com dados, e não apenas pela existência de um sistema funcionando.

### Solidez do processo

A proposta não nasceu pronta. Ela foi revisada a partir de evidências de campo coletadas com os dois públicos, e o questionário teve critérios de decisão fixados antes da coleta. Um desses critérios retirou do centro do projeto um elemento que era apresentado como seu principal diferencial — a navegação por país de origem. Esse é o melhor indicador de que as pesquisas orientaram as decisões, e não apenas as confirmaram.

## 10. A proposta

**A plataforma é um serviço web de descoberta de jogos independentes que recomenda títulos pela afinidade entre as características de cada jogo e as preferências de cada jogador, mostra o motivo de cada indicação e deixa o usuário escolher o quanto quer se afastar do que já é popular.** Ela reúne jogos lançados e por lançar, e encaminha o interesse do jogador para a página oficial de cada jogo.

### Como a plataforma pretende gerar valor

A lógica central é a **recomendação por afinidade de conteúdo**. Em vez de sugerir o que pessoas parecidas jogaram, a plataforma compara as características dos jogos — gêneros, temas, ambientação, estilo — com o perfil de preferências que o próprio usuário constrói ao avaliar os jogos que já conhece. Essa escolha tem três consequências que sustentam a proposta:

- **Funciona desde o primeiro usuário**, porque não depende de uma grande base de pessoas usando o sistema.
- **Alcança jogos sem histórico**, inclusive os que ainda não foram lançados, porque um jogo pode ser recomendado pelas próprias características antes de ter qualquer avaliação.
- **Permite explicar cada recomendação**, porque o motivo de uma indicação é sempre uma relação identificável entre o jogo e o perfil do usuário.

### Princípios

Sete princípios orientam a plataforma. Eles definem o que ela deve ser, não como será construída.

**1. Afinidade antes de popularidade.** A recomendação parte do que o jogo é e do que o jogador gosta, não do quanto o jogo já vendeu. A popularidade entra como fator que o usuário calibra, e não como critério que decide por ele.

**2. O usuário decide o grau de novidade.** Cada pessoa escolhe se quer ver mais jogos consagrados, mais jogos pouco conhecidos ou um equilíbrio entre os dois, e pode mudar essa escolha conforme o momento. O equilíbrio é o ponto de partida, por ser a preferência mais comum entre os jogadores consultados.

**3. Toda recomendação tem um motivo visível.** O usuário sabe por que cada jogo apareceu. A transparência responde à desconfiança que os próprios jogadores expressaram em relação a recomendações "viciadas" ou "tendenciosas".

**4. Jogos por lançar fazem parte do catálogo.** A plataforma acompanha os jogos desde antes da estreia, quando o desenvolvedor mais precisa de atenção e o jogador já os acompanha por meio de listas de desejos.

**5. O recorte independente tem critério público.** O que conta como jogo independente é definido de forma explícita e visível, reconhecendo que o termo não tem consenso. O critério não exclui um jogo apenas por ele ter publisher, já que publishers voltadas a jogos independentes são comuns, inclusive entre os estúdios entrevistados.

**6. O que importa é o que está dentro do jogo.** A navegação privilegia o conteúdo — temas, ambientação, cultura retratada — e a disponibilidade em português, que pesaram cinco vezes mais do que o país de origem para os jogadores. O país do estúdio permanece disponível como recorte secundário, para quem quiser usá-lo.

**7. Neutralidade comercial.** A plataforma não vende jogos e não recebe para recomendar. Ela leva o jogador à página oficial de cada jogo, onde a decisão de compra acontece. A neutralidade é condição para a confiança nas recomendações.

### Pouco esforço para começar

A plataforma deve entregar valor rapidamente. Para gerar as primeiras recomendações, pede pouco do usuário, em linha com o que os jogadores consultados disseram aceitar: a maioria topa avaliar poucos jogos, e uma parte não avaliaria nenhum. Para essas pessoas, as preferências de gênero bastam como ponto de partida.

## 11. Proposta de valor

> Descubra jogos independentes parecidos com os que você gosta, inclusive os que ainda vão sair, sabendo por que cada um foi indicado e escolhendo o quanto quer fugir do óbvio.

A plataforma tem um público usuário e um público beneficiário, e a distinção importa para não prometer o que não pode ser comprovado.

### Para os jogadores, que usam a plataforma

O público prioritário são jogadores que já têm algum contato com jogos independentes e querem encontrar títulos além do que as lojas destacam. Para eles, a plataforma pretende oferecer:

- **recomendações alinhadas ao próprio gosto**, e não ao que está em alta — o recurso mais valorizado pelos respondentes;
- **controle sobre o grau de risco**, escolhendo entre o consagrado e o desconhecido conforme o momento;
- **clareza sobre o motivo de cada indicação**, sem interesses comerciais por trás;
- **acesso antecipado ao que vem por aí**, com jogos ainda não lançados que combinam com suas preferências;
- **busca pelo que está dentro do jogo**, como temas, ambientação e idioma.

### Para os estúdios independentes, que se beneficiam dela

Os estúdios não operam a plataforma: os jogos entram no catálogo a partir de bases de dados públicas, como dois dos desenvolvedores entrevistados preferiram. O benefício pretendido para eles é:

- **exposição a jogadores com afinidade real**, independentemente de vendas e avaliações acumuladas;
- **visibilidade no pré-lançamento**, o momento de maior necessidade, encaminhando o interesse para a página oficial do jogo;
- **um ambiente neutro**, em que nenhum jogo é promovido por pagamento.

Esses benefícios são **pretendidos, não comprovados**. Eles dependem de a plataforma ter usuários em número suficiente, o que não pode ser garantido nem medido no âmbito deste trabalho. O valor para os estúdios é uma consequência esperada do valor para os jogadores, e não um resultado a ser demonstrado.

### Para a área acadêmica

O trabalho oferece uma aplicação concreta de três temas da área de sistemas de recomendação — viés de popularidade ajustado ao usuário, explicabilidade e partida a frio do item — em um domínio com problema real e documentado. Oferece também um critério operacional de jogo independente, explicitado e testado contra casos reais, e um registro de pesquisa de campo com os dois lados do mercado sobre as mesmas questões.

## 12. Diferenciais e posicionamento

### Posicionamento

> Para jogadores que querem descobrir jogos independentes além do que as lojas destacam, a plataforma é um serviço de descoberta que recomenda pela afinidade com o conteúdo de cada jogo, explica cada indicação e deixa o usuário decidir o quanto quer se afastar do popular. Diferente das lojas, não vende jogos nem depende de popularidade acumulada. Diferente das curadorias editoriais, é personalizada e não depende de seleção manual.

### Diferenciais

O diferencial está na combinação de quatro elementos, não em nenhum deles isoladamente:

- **Transparência.** Cada recomendação mostra seu motivo. Entre as soluções analisadas, nenhuma adota a explicação de cada indicação como princípio.
- **Controle do usuário sobre a popularidade**, combinado com recomendação por conteúdo. O controle em si existe em outras plataformas; a novidade está em aplicá-lo a um catálogo independente, com critério transparente.
- **Alcance a jogos sem histórico**, incluindo os por lançar, que os mecanismos baseados em comportamento de outros usuários tendem a deixar de fora.
- **Recorte independente com critério público**, que assume a ambiguidade do termo em vez de escondê-la.

### O que a plataforma não é

Definir os limites é parte do posicionamento. Cada um deles decorre das pesquisas:

| A plataforma não é | Por quê |
| --- | --- |
| Uma loja | A neutralidade sustenta a confiança; jogadores citaram "indicação tendenciosa" e excesso de anúncios como motivos para abandonar um serviço |
| Uma curadoria editorial | Curadorias manuais já existem e têm catálogo limitado pelo trabalho de seleção |
| Uma vitrine de jogos de um país | O país de origem pesou pouco para os jogadores, e um respondente citou espontaneamente esse foco como motivo para não usar o serviço |
| Um sistema contra jogos populares | Só 5% dos jogadores preferem ver principalmente jogos desconhecidos, e quatro dos seis desenvolvedores rejeitaram a penalização fixa |
| Uma ferramenta de marketing para estúdios | Ferramentas de divulgação com criadores de conteúdo já existem; a plataforma atua do lado da descoberta |
| Uma rede social | Recursos de comunidade foram pedidos por alguns desenvolvedores, mas exigem uma base de usuários que ainda não existe |
| Um substituto dos criadores de conteúdo | Vídeos e redes continuam sendo o principal canal de descoberta; a plataforma os complementa |

## 13. Hipóteses em aberto e riscos estratégicos

As pesquisas sustentam o problema e orientaram as escolhas, mas deixaram questões sem resposta. Elas são listadas aqui para que não sejam tratadas como resolvidas.

| Hipótese ou risco | O que se sabe hoje | Como será verificado |
| --- | --- | --- |
| **Interesse declarado se converte em uso** | 70% deram nota alta, mas a amostra veio quase toda da rede pessoal do autor, e quem não joga indie deu notas mais altas do que quem joga | Teste com usuários do protótipo, observando uso real e não apenas opinião |
| **Os jogadores voltam à plataforma** | 55% raramente ou nunca procuram jogos novos; três respondentes e um desenvolvedor anteciparam o risco de esquecimento | Risco declarado como limitação do trabalho; a plataforma deve ser útil desde a primeira visita e encontrável por quem busca um jogo específico |
| **A explicação aumenta a confiança** | Metade dos jogadores disse que sim; o recurso mais escolhido juntava personalização e explicação | Teste com usuários, comparando a percepção das recomendações com e sem o motivo |
| **Os dados públicos sobre jogos pequenos são suficientes** | Não medido. Jogos pequenos e por lançar podem ter fichas incompletas, e as bases demoram a refletir mudanças — duas semanas depois de um dos jogos entrevistados anunciar sua publisher, a loja ainda não havia registrado a mudança | Medição da completude dos dados antes de qualquer outro passo, usando os jogos da pesquisa como casos de teste |
| **O critério de jogo independente é aceitável** | Desenvolvedores e jogadores compartilham um núcleo de definição, mas divergem nas bordas | Confronto do critério com os casos reais dos estúdios entrevistados, documentando acertos e erros |
| **A qualidade de execução é decisiva** | Interface ruim, lenta ou confusa foi o motivo mais citado para não usar a plataforma (48,8%) | Teste de usabilidade com jogadores |

Dois limites estruturais não serão superados pelo projeto e devem ser declarados como tal. A plataforma **não tem audiência própria**: seu efeito sobre a visibilidade dos estúdios depende de adoção e não poderá ser demonstrado. E ela **não enfrenta preço, falta de tempo nem orçamento de marketing**, que juntos respondem por boa parte das barreiras relatadas.

## 14. Visão de futuro e impacto esperado

### Visão

A visão de longo prazo é que descobrir um jogo independente deixe de depender de sorte, de orçamento de marketing ou de o jogo já ser popular. Que um jogador encontre o jogo que combina com ele pelo que o jogo é, e que um estúdio pequeno seja encontrado pelas pessoas que gostariam do que ele fez, mesmo antes da estreia.

### Direções de evolução

Algumas direções apareceram nas pesquisas e ficam fora da versão inicial, seja por dependerem de uma base de usuários, seja por ampliarem demais o escopo de um trabalho acadêmico.

A primeira é uma **participação maior dos próprios estúdios**, que poderiam apresentar seus jogos com as próprias palavras e incluir títulos ausentes das bases públicas. Dois desenvolvedores pediram, cada um a seu modo, que alguém "entendesse" a essência do jogo; um terceiro pediu espaço para jogos que ainda não estão catalogados.

A segunda é a **dimensão de comunidade**, pedida por desenvolvedores que veem no boca a boca o caminho mais orgânico de descoberta. Ela só faz sentido quando houver pessoas suficientes para formar uma comunidade.

A terceira é o **aprofundamento da navegação pelo conteúdo cultural dos jogos** — a possibilidade de procurar jogos que retratam um lugar, uma história ou uma cultura específica. As pesquisas indicaram que esse é o interesse real por trás da ideia original de navegar por país.

A quarta é o **aprendizado com o comportamento coletivo**: quando houver base de usuários, a recomendação por afinidade de conteúdo pode ser combinada com técnicas que aprendem com o que pessoas parecidas jogaram, sem abrir mão da transparência e do controle sobre a popularidade.

### Impacto esperado

Se a plataforma for adotada, o impacto pretendido é de três ordens:

- **Para os jogadores**, uma descoberta mais diversa e mais ajustada ao gosto, com menos dependência do que já está em destaque.
- **Para os estúdios independentes**, em especial os pequenos e os em pré-lançamento, a chance de alcançar jogadores com afinidade sem precisar antes acumular popularidade. Os estúdios brasileiros, que têm produção expressiva e, segundo os desenvolvedores entrevistados, disputam atenção com empresas de orçamento muito maior, estão entre os potenciais beneficiados, como consequência e não como foco exclusivo.
- **Para a área acadêmica**, um caso aplicado e mensurável de recomendação com viés de popularidade ajustado ao usuário, replicável em outros domínios de cauda longa.

O impacto sobre os estúdios e o mercado é uma expectativa condicionada à adoção, e não um resultado a ser comprovado neste trabalho. O que o trabalho se propõe a demonstrar é mais restrito e verificável: que é possível recomendar jogos independentes de forma personalizada, explicável e com controle do usuário sobre a popularidade, alcançando inclusive jogos que ainda não têm histórico.

## 15. Considerações finais

A proposta enfrenta um problema real e documentado: jogos independentes, sobretudo os pequenos e os ainda não lançados, não chegam aos jogadores que gostariam deles, porque a descoberta nas lojas depende de sinais que esses jogos ainda não têm e porque os recomendadores tendem a reforçar o que já é popular. As pesquisas de campo confirmaram esse diagnóstico dos dois lados do mercado.

A solução proposta — recomendação por afinidade de conteúdo, com motivo visível, popularidade calibrada pelo usuário e alcance a jogos por lançar — é coerente com o que desenvolvedores e jogadores disseram, com a literatura sobre viés de popularidade e com as limitações das soluções existentes. Ela foi moldada pelas evidências, e não apenas confirmada por elas: a navegação por país de origem, apresentada antes como principal diferencial, cedeu lugar ao conteúdo dos jogos e ao idioma quando os dados mostraram que é isso o que os jogadores valorizam.

A questão decisiva daqui em diante não é se a ideia interessa, e sim se será usada. O interesse está indicado; o uso recorrente, não. Essa distinção orienta o tom deste documento: os benefícios para os jogadores são o objetivo do trabalho, os benefícios para os estúdios são uma consequência esperada, e o que se propõe demonstrar é a viabilidade e o efeito mensurável de uma forma diferente de recomendar — não uma mudança no mercado.

## 16. Referências

Fontes consultadas entre 9 e 19 de outubro de 2026.

### Pesquisas de campo deste trabalho

- Entrevistas semiestruturadas com seis desenvolvedores de estúdios independentes, realizadas na Brasil Game Show, São Paulo, de 10 a 12 de outubro de 2026. Transcrição e análise mantidas pelo autor.
- Questionário online anônimo "Como você descobre jogos novos?", com 60 respostas válidas coletadas de 16 a 18 de outubro de 2026. Base de respostas e análise mantidas pelo autor.

### Literatura acadêmica

- Abdollahpouri, H.; Mansoury, M.; Burke, R.; Mobasher, B.; Malthouse, E. [User-centered Evaluation of Popularity Bias in Recommender Systems](https://arxiv.org/abs/2103.06364v1). ACM UMAP, 2021. DOI 10.1145/3450613.3456821.
- Huang, Y.; Morozov, I. [The Promotional Effects of Live Streams by Twitch Influencers](https://ideas.repec.org/a/inm/ormksc/v44y2025i4p916-932.html). *Marketing Science*, v. 44, n. 4, p. 916–932, 2025.
- Klimashevskaia, A.; Jannach, D.; Elahi, M.; Trattner, C. [A Survey on Popularity Bias in Recommender Systems](https://arxiv.org/abs/2308.01118v2). *User Modeling and User-Adapted Interaction*, 2024. DOI 10.1007/s11257-024-09406-0.
- Moreira, A. B.; Soares, L. S. [Modeling a Platform for Distribution of Brazilian Indie Games](https://sol.sbc.org.br/index.php/wsis/article/view/33694). Anais do XV Workshop de Sistemas de Informação (WSIS), SBC, 2024, p. 172–174.

### Mercado e indústria

- [Alinea Analytics: participação dos jogos independentes na receita da Steam em 2025](https://tech4gamers.com/25-steams-revenue-in-2025-from-indie-titles/), via Tech4Gamers, 20 dez. 2025.
- [Distribuição de receita na Steam em 2025](https://game-developers.org/2025-steam-game-revenue-distribution), Game Developers. Fonte da estimativa de cerca de 20 mil lançamentos e de cerca de 8% dos jogos acima de US$ 100 mil.
- [Video Game Insights: indie games on Steam](https://gamedevreports.substack.com/p/video-game-insights-indie-games-on), via GameDev Reports, 17 out. 2024.
- [Abragames e ApexBrasil: 2ª Pesquisa Nacional da Indústria de Games](https://www.meioemensagem.com.br/marketing/games-cresce-o-numero-de-desenvolvedores-e-estudios-brasileiros), via Meio & Mensagem, 28 fev. 2024.
- Zukowski, C. [Do wishlists matter any more?](https://howtomarketagame.com/2024/01/29/do-wishlists-matter-any-more/) How To Market A Game, 29 jan. 2024.
- [Steam: atualização do sistema de descoberta](https://techraptor.net/gaming/news/steam-updating-discovery-to-give-better-recommendations), via TechRaptor, 12 set. 2019.
- [Steam Interactive Recommender](https://www.vortez.net/news_story/steam_introduces_the_steam_interactive_recommender.html), via Vortez.
- [Hell Clock, jogo brasileiro inspirado na Guerra de Canudos](https://www.itatiaia.com.br/games/conheca-hell-clock-o-jogo-brasileiro-inspirado-na-guerra-de-canudos/), Itatiaia, 17 jul. 2025.
- [Clair Obscur: Expedition 33 vence o The Game Awards](https://www.wlrn.org/npr-breaking-news/2025-12-12/clair-obscur-expedition-33-sweeps-the-game-awards-analysis-and-full-winners-list), NPR via WLRN, 12 dez. 2025.

### Soluções existentes

- [Steam](https://store.steampowered.com) · [itch.io](https://itch.io/games) · [The Gaming Nest: Discover Indie Games](https://thegamingnest.com/en/discover) · [Backloggd](https://backloggd.com)
