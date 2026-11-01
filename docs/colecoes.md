# Coleções culturais (B-57)

Navegação por cultura retratada (F-24). Nenhuma fonte de dados registra a cultura de um
jogo de forma ampla (relatório do M0, seção 8.8), então as coleções são curadas: o sistema
sugere candidatos, o autor aprova ou recusa cada um com o motivo, e o resultado fica no Git.

## Fluxo

1. A coleção entra em `apps/api/config/collections.json` como rascunho
   (`published: false`), com nome, descrição, escopo e as regras de sugestão.
2. `pnpm --filter @indie/api collections:suggest [slug...] [--json]` lista os jogos do
   catálogo que batem com as regras e ainda não foram decididos, com a evidência de cada
   um e do mais popular para o menos. O script não grava nada.
3. O autor lê cada candidato e o põe em `games` (aprovado) ou em `rejected`, com o motivo.
   Rodar o script de novo só traz os candidatos novos.
4. Com pelo menos `minGames` (10) aprovados, a coleção vira `published: true`.
5. A ingestão sincroniza as coleções publicadas na mesma transação do catálogo (seção
   "Coleções" de `docs/ingestao.md`), e a API passa a servi-las.

O arquivo é validado ao ser lido: coleção publicada abaixo do mínimo, slug repetido, jogo
repetido ou jogo aprovado e recusado ao mesmo tempo impedem a ingestão de começar. Rascunho fica fora do banco e do mínimo.

## Regra de curadoria

Um jogo entra quando a cultura está no centro dele: mitologia, religião, folclore, música,
história ou cotidiano.

**Ambientação** (decidida pelo autor na revisão de 01/11/2026, igual para todas as coleções):

- **Lugar real da coleção, de hoje ou do passado, conta sozinho.** *Rio: Raised in
  Oblivion* (uma área isolada do Rio de Janeiro), *Cop Bastard* (o Japão do começo dos anos
  1990) e *Shenzhen I/O* (uma empresa de Shenzhen) entram.
- **Versão futurista, distópica ou inventada de um lugar só conta com a cultura em si no
  centro.** O nome do lugar ou a estética não bastam. *Nine Sols* (imagens taoístas),
  *Sense* (Neo Hong Kong e o folclore chinês), *Lunr.Rdio.Taxi* (o funk brasileiro) e
  *Aztech Forgotten Gods* (os deuses mesoamericanos) entram. *Tokyo 42*, as Neo-Tóquios,
  *Shadowrun: Hong Kong*, *Acts of Blood* (Bandung distópica), *Brigand: Oaxaca* (México
  pós-apocalíptico) e *Die by the Blade* (mundo samuraipunk) ficam de fora.

Também não bastam um nome, um item ou uma referência isolada ("Maya" como nome de
personagem, piñatas como item), a origem do estúdio nem uma guerra vista só de fora, como
cenário de tiro ou estratégia (os jogos da Guerra do Vietnã, *Expeditions: Conquistador*).

O escopo de cada coleção diz qual cultura e quais lugares contam. As coleções de mitologia
têm recorte de tempo: a nórdica vale para a Escandinávia da Era Viking ou antes (*Draugen*,
na Noruega dos anos 1920, ficou de fora), a grega para a Grécia antiga e a egípcia para o
Egito antigo (*Abo Hadeed*, no Egito de hoje, ficou de fora).

Um jogo pode estar em mais de uma coleção: os jogos Huni Kuin, *Tekoha* e *Yvy* estão no
Brasil e em Povos indígenas, e *Hellblade: Senua's Sacrifice* na nórdica e no mundo celta.

## Coleções iniciais (01/11/2026)

Primeira passada feita pelo assistente lendo o resumo de cada candidato no catálogo local
de 22.802 jogos; o autor revisou as listas completas e decidiu os casos de regra.

| Coleção | Situação | Aprovados | Recusados |
| --- | --- | --- | --- |
| Brasil | publicada | 29 | 24 |
| Japão | publicada | 131 | 137 |
| Mitologia nórdica | publicada | 85 | 53 |
| Mitologia grega | publicada | 37 | 31 |
| Folclore eslavo | publicada | 34 | 15 |
| México e Mesoamérica | publicada | 22 | 34 |
| Egito antigo | publicada | 22 | 38 |
| Mundo celta | publicada | 26 | 20 |
| China, Taiwan e Hong Kong | publicada | 64 | 23 |
| Sudeste Asiático | publicada | 30 | 15 |
| Povos indígenas | rascunho | 11 | 9 |

Decisões da revisão:

- **Brasil numa coleção só.** A regra era dividir com mais de 20 aprovados; o autor manteve
  uma, com o folclore, os povos originários, a história e o cotidiano juntos.
- **"China, Taiwan e Hong Kong"**, em vez de "China", porque a coleção inclui jogos de
  Taiwan (*Detention*) e de Hong Kong.
- **A série Touhou fica fora do Japão** (57 jogos), exceto *Touhou Mystia's Izakaya*:
  Gensokyo e seus youkais servem de cenário a tiro, luta ou ação, e os resumos não põem o
  folclore no centro. Aceitar todos faria a coleção ficar tomada pela série.
- **Povos indígenas fica em rascunho**: 11 aprovados, só um acima do mínimo.
- *Bolsomito* foi recusado: é propaganda eleitoral, retirada da Steam depois de uma
  investigação do Ministério Público, e não retrata a cultura brasileira.

África, Coreia e Índia foram sondadas e não chegaram a 10 candidatos.

## Fontes da sugestão e limitações

As regras de cada coleção ficam no próprio arquivo (`suggest`):

- **Palavras-chave da IGDB**, pelo slug exato. Trazem ruído: `made-in-brazil` marca o
  estúdio, `ninja`, `samurai` e `mummy` marcam mecânica ou monstro e ficaram de fora das
  regras.
- **Termos do resumo**, como palavra inteira e sem diferenciar maiúsculas. Os resumos da
  IGDB estão em inglês, e não há radicalização: "Brazil" não acha "Brazilian", que entra
  como outro termo.
- **Local da narrativa no Wikidata** (P840), cruzado pelo identificador da IGDB (P5794),
  contando o lugar ou o país dele (P17). Cobre poucos jogos (cerca de 4,3 mil em toda a
  base, medido no M0) e às vezes aponta um lugar secundário.

Jogos sem nenhuma dessas marcas não aparecem como candidatos, então a coleção depende da
curadoria para crescer. Na sondagem do catálogo local, o resumo trouxe mais candidatos que
as palavras-chave em 8 das 11 coleções.

## API

- `GET /api/collections`: coleções publicadas com pelo menos um jogo no catálogo, na ordem
  do arquivo, com quantos jogos do catálogo cada uma tem e até 4 capas dos mais populares.
- `GET /api/collections/:slug?page=&pageSize=`: a coleção e os jogos dela no catálogo, na
  ordem de popularidade do catálogo, com a mesma paginação de `GET /api/games`. Slug
  inexistente ou coleção sem jogo no catálogo respondem 404 com "Coleção não encontrada.".

O vínculo do jogo que sai do catálogo continua gravado, e as consultas filtram o catálogo.
