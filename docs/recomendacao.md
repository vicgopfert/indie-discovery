# Núcleo de pontuação da recomendação (B-32)

Funções puras em `apps/api/src/modules/recommendation/scoring/`; pesos na seção `scoring`
de `apps/api/config/recommendation.json`. O núcleo recebe o índice de conteúdo (B-31) e o
estado do usuário já carregado (avaliações, listas, preferências e modo) e devolve a
lista ordenada, com o motivo de cada jogo. Ler o banco, montar a resposta da API e traduzir
os nomes é do B-33.

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

A resposta indica a base da lista: `profile` (pelo perfil), `popular` (o caso 8) ou
`empty` (sem avaliações, listas nem preferências: o jogador vai para a partida a frio).

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

## Limitações e pendências para o B-33

- **Jogo da biblioteca fora do catálogo:** o índice só tem os jogos do catálogo, e o
  núcleo só usa no perfil os jogos que chegam com vetor. Sem vetor, o jogo só sai dos
  candidatos. Pela decisão do B-27, ele continua na biblioteca; o B-33 decide se monta
  esse vetor a partir do banco, com o IDF do índice.
- **Preferências:** chegam ao núcleo como posições no índice. As preferências são gravadas
  pelo id do atributo, que o índice ainda não guarda; o B-33 acrescenta o mapeamento.
- **Lista de populares:** não respeita o modo, como previsto na proposta.
