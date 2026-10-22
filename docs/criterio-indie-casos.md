# Critério indie — casos reais conferidos (B-11)

Conferência feita em 21/10/2026 contra a IGDB real, com o critério versionado em
`apps/api/config/indie-criteria.json`. As respostas da IGDB destes 22 jogos estão
salvas em `apps/api/test/fixtures/igdb/criteria-cases.json` e o resultado esperado
de cada um roda como teste de regressão (`indie-criteria.spec.ts`).

## A regra

**Princípio:** o critério classifica a situação atual do estúdio, não a do lançamento.

Um jogo entra no catálogo quando:

1. tem o gênero Indie na IGDB;
2. não é publicado por uma dona de plataforma ou grande conglomerado AAA (lista no
   arquivo de critério). Publishers dedicadas a estúdios independentes, como Devolver
   Digital, Annapurna Interactive, Paradox, Focus e THQ Nordic, não excluem o jogo;
3. não tem um tema excluído (hoje, só Erotic);
4. não foi cancelado;
5. tem ficha completa: capa, resumo com 40 caracteres ou mais e algum gênero além de
   Indie ou algum tema;
6. tem algum sinal de interesse: lançado antes de 2015 com avaliações; lançado desde
   2015 com avaliações ou `hypes`; por lançar com data marcada; ou anunciado sem data
   com `hypes`.

**Listas de exceção** corrigem erro de classificação indie (itens 1 e 2). Nunca
sobrepõem o filtro de conteúdo (item 3), a ficha completa nem o sinal de interesse.
Cada entrada exige motivo, fonte pública e data, e as duas listas somadas têm teto de
20 entradas: se passar disso, o problema é a regra, não os casos.

## Casos

14 casos notáveis, escolhidos por testarem os limites da regra, e 8 sorteados do
catálogo indie com algum sinal de interesse (semente fixa).

| Jogo | Estúdio → publisher | Resultado | Avaliação |
| --- | --- | --- | --- |
| Hotline Miami | Dennaton → Devolver Digital | Aceito | Acerto |
| Outer Wilds | Mobius Digital → Annapurna, Limited Run | Aceito | Acerto |
| Prison Architect | Introversion → Paradox | Aceito | Acerto |
| Stardew Valley | ConcernedApe → Chucklefish, 505 Games | Aceito | Acerto |
| Papers, Please | Lucas Pope → 3909 | Aceito | Acerto |
| Celeste | Extremely OK Games → Maddy Makes Games | Aceito | Acerto |
| Two Point Campus | Two Point Studios → Sega | Excluído (publisher) | Acerto: estúdio da própria Sega |
| HuniePop | HuniePot | Excluído (tema Erotic) | Acerto: foco erótico |
| Katawa Shoujo | Four Leaf Studios | Excluído (tema Erotic) | Acerto: o rótulo de conteúdo está correto; não é erro de classificação indie |
| Fall Guys | Mediatonic → Epic Games, Devolver | Excluído (publisher) | Acerto pelo princípio: a Mediatonic é subsidiária da Epic desde 2021 |
| Ori and the Blind Forest | Moon Studios → Microsoft | Fora do conjunto candidato | Limitação: a IGDB não o marca como indie |
| Unravel | ColdWood → Electronic Arts | Fora do conjunto candidato | Limitação: a IGDB não o marca como indie |
| Journey | Thatgamecompany → Sony, Annapurna | Excluído pela regra → **aceito por exceção** | Erro da regra, corrigido na lista "sempre manter" |
| Squadron 42 | Cloud Imperium | Aceito pela regra → **excluído por exceção** | Erro da regra, corrigido na lista "sempre excluir" |
| Feed It *(sorteado)* | não informado | Aceito | Acerto |
| Forest 3 *(sorteado)* | Endnight Games | Aceito | Acerto |
| Mushroom 11 *(sorteado)* | Untame | Aceito | Acerto |
| Dark Anarchy *(sorteado)* | Yelling Lion Studio | Aceito | Acerto |
| Metal Drift *(sorteado)* | Black Jacket Studios | Aceito | Acerto |
| Lunark *(sorteado)* | Canari Games → WayForward | Aceito | Acerto |
| Resistor *(sorteado)* | Long Way Home → PQube | Aceito | Acerto |
| Aurora: The Lost Medallion - The Cave *(sorteado)* | Noema Games → Gamirror | Aceito | Acerto |

## Saldo

- A regra, antes das exceções, acertou 17 dos 22 casos. Os 8 sorteados deram 8/8.
- Os 2 erros (*Journey* e *Squadron 42*) são casos famosos e excepcionais, corrigidos
  pelas listas de exceção, não por mudança de regra.
- *Ori* e *Unravel* não chegam a ser avaliados: o conjunto candidato depende do rótulo
  Indie da IGDB. Isso é uma limitação registrada, não algo a contornar.

## Exceções em vigor

| Lista | Jogo | Motivo | Fonte |
| --- | --- | --- | --- |
| Sempre manter | Journey (1352) | A Sony foi publisher de plataforma nas versões de PS3 e PS4, e a Annapurna publicou as de PC e iOS em 2019; a regra o excluiu pela distribuição, não pela propriedade do estúdio | https://en.wikipedia.org/wiki/Journey_(2012_video_game) |
| Sempre excluir | Squadron 42 (19128) | Marcado como indie na IGDB, mas desenvolvido pela Cloud Imperium (Foundry 42) e financiado junto com Star Citizen, que passou de US$ 1 bilhão em financiamento coletivo e vendas antecipadas | https://en.wikipedia.org/wiki/Squadron_42 |

## O que esta amostra não mede

A amostra mede a precisão do que é **aceito**. O erro mais provável da regra é o
oposto: um indie legítimo **excluído** pela regra de publisher. Dois dos seis
desenvolvedores entrevistados na BGS 2026 disseram que a regra os excluiria. Essa
medição está aberta como item B-59 do backlog.
