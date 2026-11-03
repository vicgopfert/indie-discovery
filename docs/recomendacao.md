# Recomendação: núcleo de pontuação (B-32), rota (B-33) e página (B-35)

O núcleo são funções puras em `apps/api/src/modules/recommendation/scoring/`, com os pesos
na seção `scoring` de `apps/api/config/recommendation.json`. Ele recebe o índice de
conteúdo (B-31) e o estado do usuário já carregado (avaliações, listas, preferências e modo)
e devolve a lista ordenada, com o motivo de cada jogo. O `GenerateRecommendationsUseCase`
lê o estado no banco, chama o núcleo e monta a resposta de `GET /api/recommendations`
(seção "A rota").

## Como funciona

1. **Peso de cada jogo da biblioteca:** `w = (nota − 3) + bônus das listas`. Sem nota,
   ficam só os bônus: favorito 2, concluído 1, quero jogar 0,5. Um jogo em duas listas
   (favorito com concluído ou com quero jogar) **soma os dois bônus**, porque cada lista é
   um sinal independente. Notas 1 e 2 afastam o perfil daqueles atributos; nota 3 é neutra.
2. **Perfil:** `u = Σ w_i · v_i + β · Σ e_f`, com `e_f` o vetor unitário de cada gênero ou
   tema escolhido na partida a frio e β = 1. O perfil é um vetor denso, com uma posição por
   atributo do índice.
3. **Candidatos:** os jogos do índice que o usuário não avaliou e que não estão em nenhuma
   lista, com vetor não vazio e **cosseno acima de zero**, para que todo jogo recomendado
   tenha ao menos um atributo a favor. Com poucos candidatos, a lista sai menor, sem
   completar com outros jogos.
4. **Pontuação:** `score = cos(u, v_j) − λ_modo · pop_j`, com λ de −0,2 em Populares, 0 em
   Equilibrado e +0,3 em Descobertas. Os vetores dos jogos têm norma 1, então
   `cos = u · v_j / ‖u‖`.
5. **Desempate:** sorteio fixo por usuário, pelo hash SHA-256 de `userId:gameId`, com o id
   do jogo como último critério.
6. **"Pouco conhecido":** só no modo Descobertas. Marca o jogo que está na lista mas ficaria
   fora dela se a ordem fosse só pelo cosseno (o mesmo corte, com λ = 0).
7. **Motivo:** ver a seção abaixo.
8. **Perfil sem nenhuma componente positiva** (só notas negativas ou neutras, que anulam
   também as preferências): os mais populares dos gêneros e temas preferidos, se algum
   candidato tiver um deles, ou do catálogo inteiro. O modo não muda essa lista, e o motivo
   são os preferidos que o jogo tem; no catálogo inteiro, não há motivo.

O núcleo indica a base da lista: `profile` (pelo perfil) ou `popular` (o caso 8, que
inclui o perfil vazio). A rota acrescenta `empty`, decidido antes do núcleo (seção "A
rota").

## Desempate: por que o sorteio não contradiz o B-12

O B-12 decidiu que a **popularidade não entra no desempate**: ela já está no λ do modo e,
no desempate, contaria duas vezes, uma delas invisível. O sorteio por usuário respeita
isso, porque não usa nenhum dado do jogo além do id.

O que mudou foi o critério entre empatados. O B-12 previa o identificador do jogo. Como o
id é um UUID aleatório, essa ordem já era arbitrária, mas era a mesma para todos os
usuários: quem tem gosto parecido veria sempre os mesmos empatados. Com o hash de
`userId + gameId`, a ordem continua determinística (o mesmo estado gera a mesma lista), mas
muda de um usuário para outro, o que aumenta a cobertura do catálogo, uma das métricas do
B-37.

## Motivo da recomendação

- **Gêneros e temas:** os até 3 de maior contribuição positiva, `u_k · v_jk / (‖u‖ · ‖v_j‖)`,
  da maior para a menor.
- **Palavras-chave nunca viram motivo**, nem como reserva. Elas não têm tradução no
  `feature-labels.json` e, raras, pesam mais justamente nos jogos com poucas etiquetas, o
  que reabriria o problema do B-12: motivos como "anxiety" e "rock climbing", em inglês e às
  vezes constrangedores.
- **Reserva, quando nenhum gênero ou tema contribui a favor:** "Porque você gostou de
  `<jogo>`", o jogo da biblioteca de maior contribuição positiva para o candidato,
  `w_i · cos(v_i, v_j)`, calculada só para os jogos da lista final. Ela existe sempre que o
  cosseno é positivo: a contribuição veio de um atributo que algum jogo de peso positivo da
  biblioteca também tem.
- **Perfil só de preferências declaradas:** não há jogo da biblioteca para a reserva, e ela
  não faz falta. As únicas componentes positivas do perfil são os gêneros e temas
  preferidos, então o motivo são os preferidos que batem com o jogo.
- **Blocos futuros:** a reserva também cobre os blocos do B-62 (modo de jogo e
  perspectiva) e do B-63 (palavras do resumo), que não viram motivo. Um jogo que só pontua
  por eles recebe "Porque você gostou de `<jogo>`".

## Medições no catálogo local (02/11/2026)

Catálogo local com 22.825 jogos, todos com vetor, e 43 gêneros e temas. Perfis sorteados
com semente fixa, lista de 20 itens:

- **por avaliações:** 200 perfis, cada um com quatro jogos sorteados, avaliados com 5, 5,
  4 e 1;
- **só por preferências:** 200 perfis, cada um com três gêneros ou temas sorteados.

**Tempo de uma recomendação**, em Node 24 local, fora da API:

| Perfis | Populares | Equilibrado | Descobertas |
| --- | --- | --- | --- |
| Por avaliações, mediana (p95) | 9,7 ms (13,0) | 8,9 ms (13,0) | 14,7 ms (18,8) |
| Só por preferências, mediana (p95) | 4,3 ms (7,4) | 4,3 ms (7,1) | 5,6 ms (10,9) |

A primeira versão ordenava todos os candidatos e levava de 43 a 93 ms de mediana, com picos
de 210 ms: calculava o hash do desempate em grupos de empate bem abaixo do corte. A versão
final só ordena os jogos que alcançam a pontuação do 20º; nos 400 perfis, as listas saíram
idênticas às da ordenação completa. Descobertas custa mais porque faz o segundo corte, só
pelo cosseno, para o "pouco conhecido". O tempo em produção é medido no M2 (RNF-03); a
carga do índice lá foi cerca de dez vezes mais lenta que a local (B-31).

**Empates no corte do top-20:**

| Perfis | Modo | Perfis com empate no corte | Tamanho do grupo empatado, mediana (p90) | Itens do top-20 decididos pelo sorteio, mediana |
| --- | --- | --- | --- | --- |
| Por avaliações | Populares | 31 de 200 | 3 (4) | 1 |
| Por avaliações | Equilibrado | 151 de 200 | 34 (416) | 13 |
| Por avaliações | Descobertas | 125 de 200 | 15 (102) | 6 |
| Só por preferências | Populares | 26 de 200 | 3 (4) | 1 |
| Só por preferências | Equilibrado | 120 de 200 | 11 (74) | 5 |
| Só por preferências | Descobertas | 99 de 200 | 11 (55) | 4 |

No Equilibrado, que não usa a popularidade, o sorteio decide a maior parte da lista nos
perfis por avaliações. A causa é a já registrada no B-12: muitos jogos têm vetores
idênticos, por terem poucas etiquetas (21,1% do catálogo tem vetor idêntico ao de 10 ou
mais jogos). Os blocos do B-62 e do B-63 diminuem esses empates, e o B-37 mede o efeito.

**Motivos e "pouco conhecido":**

- A reserva "Porque você gostou de" não apareceu em nenhum dos 24 mil itens: todo jogo
  recomendado tinha ao menos um gênero ou tema a favor.
- No modo Descobertas, 62% dos itens dos perfis por avaliações (2.494 de 4.000) e 39% dos
  perfis só por preferências (1.546 de 4.000) saíram marcados como "pouco conhecido". Com
  λ = 0,3, a popularidade muda a maior parte da lista. A calibração do λ é do B-37, e a
  forma de exibir a marca é do B-35.

## A rota (B-33)

`GET /api/recommendations?mode=&limit=`, autenticada. O contrato está em
`packages/contracts/src/recommendation.ts` e no Swagger.

1. **Índice indisponível:** com o índice carregando ou com falha, responde 503 com "As
   recomendações ainda não estão disponíveis; tente novamente em alguns instantes.", nunca
   lista vazia, que o jogador leria como falta de jogos para o gosto dele. O filtro de erros
   mantém a mensagem de um 5xx lançado de propósito e o registra como aviso; erro inesperado
   e 500 continuam com a mensagem genérica.
2. **Modo e limite:** `mode` em minúsculas e opcional; sem ele, vale o salvo no usuário. A
   consulta não grava a escolha: quem grava é o `PATCH /api/me`. `limit` de 1 a 50, padrão
   20.
3. **Estado do usuário:** avaliações, listas e preferências numa só transação. Nota e listas
   do mesmo jogo viram uma interação só.
4. **Partida a frio (`empty`):** decidida pelo que está gravado, e não pelo que o índice
   reconhece. Uma preferência sem posição no índice (um gênero que caiu abaixo do mínimo de
   jogos, com IDF zero) é ignorada; se só sobrar ela, o perfil fica vazio e a lista é a de
   populares, em vez de mandar de volta para a partida a frio quem acabou de fazê-la.
5. **Jogo da biblioteca fora do catálogo:** o índice só tem os jogos do catálogo, mas o jogo
   que saiu dele continua na biblioteca (B-27) e no perfil. Os atributos dele vêm do banco, e
   o vetor é montado com o mesmo `tfidfVector` e o IDF do índice: atributo fora do índice fica
   de fora, como nos outros jogos. O índice e os filtros de candidatos do B-32 não mudam.
   - **Por que importa:** pelas medições do B-61 e do B-13, entram cerca de 65 jogos por dia
     na carência, e de 84% a 89% deles saem 180 dias depois, a partir de abril de 2027. São
     os jogos que mais vão estar nas bibliotecas; deixá-los fora do perfil o pioraria aos
     poucos, sem erro visível.
   - **No motivo:** "Porque você gostou de" pode citar esse jogo. Ele vem com
     `inCatalog: false`, e a interface o mostra sem link, como na biblioteca.
6. **Resposta:** o resumo de cada jogo, como no catálogo, numa consulta só para os itens e os
   jogos citados nos motivos. Os gêneros e temas do motivo vêm com o nome em português, na
   ordem da contribuição, e os escondidos dos filtros ficam de fora. Um jogo que saiu do
   catálogo depois da última carga do índice sai da lista, que fica menor até a recarga.
7. **Pontuação:** não sai na resposta. Não é informação para o jogador, e o B-37 chama as
   funções puras direto.

### Tempo de resposta no catálogo local (03/11/2026)

Os mesmos perfis da medição do B-32 (semente fixa), gravados como contas de teste no banco
local e apagados depois: 200 por avaliações e 200 só por preferências, 20 itens, os três
modos. A API rodou com o build de produção (`node dist/main.js`), e o tempo inclui o banco,
a pontuação e a montagem da resposta.

| Perfis | Populares | Equilibrado | Descobertas |
| --- | --- | --- | --- |
| Por avaliações, mediana (p95) | 17,5 ms (20,8) | 16,8 ms (20,1) | 21,0 ms (25,6) |
| Só por preferências, mediana (p95) | 11,3 ms (14,6) | 11,1 ms (14,9) | 12,5 ms (17,8) |

A tabela traz o tempo medido pelo cliente, na mesma máquina. No log da API, as 1.200 requisições ficaram
em 15 ms de mediana, 21 ms no p95 e 54 ms no máximo.

### Tempo de resposta em produção (03/11/2026)

Medido logo depois do deploy do B-33, das 15:05 às 15:07 UTC, com o Render já acordado:
instância gratuita (0,1 CPU e 512 MB) e catálogo com 22.834 jogos. Duas contas de teste foram
criadas pela própria API, porque não há acesso direto ao banco de produção, e ficam lá até
existir a exclusão de conta (B-52): `medicao-m2-preferencias@example.com` e
`medicao-m2-avaliacoes@example.com`.

- **Só por preferências:** Quebra-cabeça, Plataforma e Terror.
- **Por avaliações:** quatro jogos sorteados do catálogo com semente fixa, com notas 5, 5, 4
  e 1, como na medição local: `time-for-bed`, `lavaloop`, `foundlings` e `banebush`.

Foram 30 chamadas por modo e por caminho, 20 itens, depois de 5 de aquecimento. O cliente
estava no Brasil e chamou a API direto no Render e pela Vercel, que é o caminho do navegador.
Todas as respostas vieram com `basis: profile` e 20 itens.

**Tempo medido pelo cliente, mediana (p95):**

| Perfil | Modo | Direto no Render | Pela Vercel |
| --- | --- | --- | --- |
| Por avaliações | Populares | 206 ms (795) | 293 ms (803) |
| Por avaliações | Equilibrado | 204 ms (701) | 218 ms (603) |
| Por avaliações | Descobertas | 202 ms (685) | 284 ms (694) |
| Só por preferências | Populares | 179 ms (209) | 205 ms (482) |
| Só por preferências | Equilibrado | 175 ms (313) | 205 ms (328) |
| Só por preferências | Descobertas | 177 ms (574) | 213 ms (790) |
| `GET /api/health`, para comparar | — | 139 ms (162) | 181 ms (274) |

**Tempo no servidor** (`durationMs` do log do Render), nas 360 requisições medidas, mediana
(p90):

| Perfil | Modo | Direto no Render | Pela Vercel |
| --- | --- | --- | --- |
| Por avaliações | Populares | 64 ms (167) | 65 ms (150) |
| Por avaliações | Equilibrado | 59 ms (415) | 32 ms (227) |
| Por avaliações | Descobertas | 64 ms (148) | 96 ms (209) |
| Só por preferências | Populares | 37 ms (71) | 33 ms (102) |
| Só por preferências | Equilibrado | 32 ms (69) | 32 ms (39) |
| Só por preferências | Descobertas | 37 ms (107) | 37 ms (102) |

No conjunto, o perfil por avaliações ficou em 62 ms de mediana e 658 ms no p95, e o só por
preferências em 33 ms e 213 ms.

**Leitura:**

- **Rede:** a maior parte do tempo. A rota de saúde, que só faz um `SELECT 1`, já leva
  139 ms daqui até o Render, e a Vercel acrescenta de 10 a 90 ms.
- **Servidor:** de 2 a 4 vezes o tempo local (15 ms), coerente com a carga do índice no Render,
  que também foi muito mais lenta que na máquina local (B-31).
- **Picos:**
  - **o que se vê:** acima de 400 ms no servidor, 18 das 180 requisições do perfil por
    avaliações (de 415 a 816 ms, cerca de 1 em 10) e 7 das 180 do só por preferências (de 497
    a 695 ms). Aparecem em todos os modos e nos dois caminhos, em intervalos regulares de cerca
    de 3 s no perfil por avaliações, e a rota de saúde não teve nenhum;
  - **causa provável:** a falta de CPU da instância gratuita, que fica limitada depois de um
    pico de uso, ou a coleta de lixo do Node. Não foi isolada.
- **Conclusão (RNF-03):** sem espera perceptível na demonstração. Fim a fim, a mediana ficou
  em cerca de 200 ms direto e de 205 a 293 ms pela Vercel. O pior caso fica abaixo de 1,1 s, e
  o jogador abre a lista uma vez por visita, não em sequência.
- **Se o pico aparecer no teste de usabilidade:** medir a coleta de lixo com `perf_hooks` e o
  limite de CPU, e reduzir a alocação por candidato no `rankCandidates`, que cria um objeto
  para cada um dos cerca de 22 mil jogos a cada requisição.

## Na interface (B-35)

A página `/recomendacoes` está descrita na seção 5 da proposta técnica ("Frontend e mesma
origem"). Sobre o que vem do núcleo:

- **Motivo:** "Recomendado por: Roguelike, Fantasia", em texto, na ordem da contribuição. Os
  gêneros e temas não viram links para o catálogo, porque o motivo não diz qual é gênero e
  qual é tema. "Porque você gostou de <jogo>" tem link só se o jogo continua no catálogo.
- **"Pouco conhecido":** um selo no cartão e, só no modo Descobertas, a frase "Pouco
  conhecido: o jogo entrou na lista por ser menos popular." acima da lista. A frase existe
  porque a marca é frequente: 62% dos itens nas medições do B-32. Na conferência local do
  B-35, um perfil com três jogos avaliados (`time-for-bed` e `lavaloop` com 5, `foundlings`
  com 4) teve os 20 itens marcados, e nenhum jogo em comum com a lista do Equilibrado. Se o
  λ de 0,3 está dominando a afinidade é uma verificação do B-37.
- **Listas `empty` e `popular`:** sem o seletor de modo, porque o modo não as muda.

## Limitações

- **Lista de populares:** não respeita o modo, como previsto na proposta.
- **Filtros:** a rota não recebe filtros (por exemplo, só "em breve"), porque nenhuma tela do
  P0 os usa (decidido no B-33).
