# Vetorização TF-IDF — configuração e medições (B-12)

Funções em `apps/api/src/modules/ingestion/tfidf.ts`; valores em
`apps/api/config/recommendation.json`. Medições feitas em 22 e 23/10/2026 sobre o
catálogo aceito pelo critério indie (19.998 jogos).

## Como funciona

1. **Descarte, antes de qualquer normalização.** Sai o atributo presente em menos de 3
   jogos (não liga o jogo a nenhum outro), o presente em mais de 80% dos jogos (o gênero
   Indie, em 100%) e 245 palavras-chave de metadados de loja, plataforma, eventos,
   prêmios, financiamento e opções técnicas (*steam achievements*, *digital
   distribution*, *nextfest*…), excluídas por nome ou padrão. Os padrões foram
   conferidos contra as 4.058 palavras-chave do catálogo: nenhuma de conteúdo é
   apanhada (*steampunk*, *demons*, *trading card game* ficam).
2. **IDF = ln(N / df).** Atributo raro pesa mais que o comum.
3. **Normalização.** O vetor tem sempre norma 1. O modo é configurável:
   - **`block` (padrão):** cada tipo (gênero, tema, palavra-chave) é normalizado
     separadamente e ocupa uma fatia fixa do vetor, 40/30/30. A fatia de um tipo
     ausente é redistribuída entre os presentes, e o vetor registra quais blocos estavam
     presentes;
   - **`global`:** todos os atributos normalizados juntos, com o IDF multiplicado pelo
     peso do tipo (1 / 1 / 0,5). Era a primeira versão.

## Por que o padrão é por bloco

Com a normalização global, as palavras-chave raras dominam o vetor. Uma palavra-chave
rara tem IDF até **14 vezes** maior que o de um gênero comum (*rock climbing* 8,80
contra *Adventure* 0,61) e cerca de **4 vezes** maior que o de um gênero específico
(*Platform* 2,10). Com o peso 0,5, ela ainda vale o dobro de *Platform*, e as maiores
etiquetas do *Celeste* viram *rock climbing*, *transgender* e *anxiety*.

Baixar o peso das palavras-chave não resolve: a contribuição delas depende de quantas o
jogo tem (de zero a dezenas), então um multiplicador único produz equilíbrios diferentes
em cada jogo. A normalização por bloco torna o equilíbrio invariante à quantidade de
etiquetas de cada tipo.

**A mudança foi adotada pelo argumento estrutural, e a medição preliminar não a
confirmou no ranqueamento** (seção seguinte). Ela foi mantida como padrão por dois
motivos que a métrica de posição não mede:

- **O motivo mostrado ao jogador (F-11).** As etiquetas de maior peso são as que a
  interface exibe como justificativa. "Plataforma de ação em mundo de fantasia" é uma
  explicação; "ambos têm escalada" ou "ambos têm ansiedade" não é, e pode ser
  constrangedora.
- **O produto é descoberta, não parentesco.** Quem gostou de *Limbo* já conhece
  *Inside*. A normalização por bloco limita o teto das semelhanças puxadas por
  palavra-chave rara e levanta o piso das puxadas por gênero e tema, o que favorece o
  catálogo desconhecido.

O modo global continua disponível na configuração para o B-37 decidir com o protocolo
completo.

## Medição preliminar das três configurações

14 pares "deveriam ser parecidos" e 8 "não deveriam", rotulados pelo autor da medição.
Para cada par parecido, a posição do parceiro entre os ~20 mil jogos, quando o outro é
a referência.

| | a) global, palavra-chave 0,5 | b) global, palavra-chave 0,15 | c) por bloco 40/30/30 |
| --- | --- | --- | --- |
| Parceiro no top-10 | 3 de 14 | 0 de 14 | 1 de 14 |
| Parceiro no top-20 | 5 de 14 | 1 de 14 | 3 de 14 |
| Parceiro no top-50 | 8 de 14 | 2 de 14 | 5 de 14 |
| Pior caso | Into the Breach × FTL, #4343 | Celeste × Super Meat Boy, #2129 | Firewatch × What Remains of Edith Finch, #1725 |
| Parecido acima de diferente | 98% das combinações | 100% | 100% |

Cada configuração tem um desastre: na global, quem gostou de *FTL* não vê *Into the
Breach*; na por bloco, quem gostou de *Firewatch* não vê *What Remains of Edith Finch*.

**Limites desta medição:**

- 14 pares rotulados por uma pessoa não decidem nada.
- Os pares parecidos são majoritariamente irmãos diretos (mesmo estúdio ou sucessor
  espiritual: *Inside*/*Limbo*, *Terraria*/*Starbound*), que compartilham
  palavra-chave rara por construção. A amostra favorece a normalização global de saída.
- Para o B-37, a fixture precisa de pares "mesma proposta, estúdios diferentes, sem
  palavra-chave rara em comum" e de pares sorteados do catálogo como linha de base.

## Empates

Em 300 jogos sorteados, o maior grupo de jogos empatados que toca o top-10 tem mediana
de 4 (global 0,5), 4 (global 0,15) e 6 (por bloco), com p90 entre 118 e 168. Em todas
as configurações, a mediana passa de 3: o desempate vira o ranqueador. A causa não é a
normalização, e sim os jogos com poucas etiquetas (seção seguinte).

Desempate decidido: pelo identificador, determinístico. Não pela popularidade, que já
entra pelo λ dos modos Populares/Equilibrado/Descobertas; no desempate, ela contaria duas
vezes, uma delas invisível. A solução dos empates é do B-32.

## Cobertura — escalada ao M0

Depois do descarte:

| Tipo | Jogos com ao menos um | Mediana de quem tem |
| --- | --- | --- |
| Gênero (sem Indie) | 95,4% | 2 |
| Tema | 83,2% | 2 |
| Palavra-chave | 65,1% | 3 |

- Os três blocos presentes: 56,1% dos jogos. Gênero e tema: 22,5%. Só gênero: 9,8%.
  Gênero e palavra-chave: 7,0%. Só tema: 2,6%. Tema e palavra-chave: 2,0%.
- Etiquetas distintas no vetor: no máximo 2 em **17,8%** dos jogos, no máximo 4 em
  **40,5%**, 6 em 59,9% e 8 em 73,7%.
- **Vetor idêntico ao de pelo menos 10 outros jogos: 21,1% do catálogo** (14,8% com pelo
  menos 50). Os maiores grupos: 476 jogos só com *Adventure* e *Action*, 408 só com
  *Action*, 382 só com *Adventure*, 233 só com *Simulator*. Para essa fatia, o conteúdo
  não distingue nada, e a recomendação por conteúdo é, na prática, um desempate.

## Jogos das entrevistas da BGS

São o tipo de jogo que a plataforma existe para mostrar. Quatro dos seis estavam sem
lançamento nas entrevistas.

| | Jogo | Na IGDB | Critério indie | Blocos | Etiquetas no vetor |
| --- | --- | --- | --- | --- | --- |
| E1 | AFANTASIA (noidnoidnoid) | Sim, como "[Afantasia]" (identidade confirmada pelo autor), sem data | Aceito | só gênero | 4 |
| E2 | Tape Us Out (Digital Graveyard Studio) | Sim, 31/12/2026 | Aceito | gênero, palavra-chave | 3 |
| E3 | Bloodfang (Ignite Dreams) | **Não**: a Ignite Dreams está na IGDB só com *Shattered Fate* | — | — | — |
| E4 | Hell Clock (Rogue Snail) | Sim, lançado em 22/07/2025 | Aceito | os três | 7 |
| E5 | POPAPOM (Nebula Devs) | Sim, sem data e sem estúdio creditado | **Excluído**: sem sinal de interesse | gênero, tema | 2 |
| E6 | Aviãozinho do Tráfico 3 (Joeveno) | Sim, como *Brazilian Drug Dealer 3: I Opened a Portal to Hell in the Favela…*, lançado em 17/09/2025 (identidade confirmada pelo autor) | Aceito | os três | 8 |

Um dos seis não está na IGDB, um fica fora do catálogo por não ter sinal de interesse e
dois dos quatro restantes têm vetor de 3 ou 4 etiquetas. A análise parou aqui, como
resultado do portão do M0; os jogos da BGS não entram como pares de semelhança.
