# Critério indie — regra, casos reais e levantamento (B-11, B-59 e B-60)

O critério fica versionado em `apps/api/config/indie-criteria.json` e é aplicado na
ingestão por `evaluateIndieCriteria` (`apps/api/src/modules/ingestion/criteria/indie-criteria.ts`; a leitura e a validação do arquivo ficam em `indie-criteria.config.ts`).
Os casos conferidos à mão rodam como teste de regressão, a partir das respostas reais
da IGDB salvas em `apps/api/test/fixtures/igdb/criteria-*.json`. As amostras e a
varredura do B-60 ficam registradas só neste documento.

## A regra

**Princípio:** o critério classifica a situação do estúdio na data de lançamento do jogo.

Um jogo entra no catálogo quando:

1. tem o gênero Indie na IGDB;
2. nenhuma desenvolvedora dele, na data de lançamento, é uma grande empresa (teste de
   entrada abaixo) nem um estúdio controlado por uma delas (controle integral ou
   majoritário). Publicar o jogo não exclui; participação minoritária e
   investimento também não;
3. não tem um tema excluído (hoje, só Erotic);
4. não foi cancelado;
5. tem ficha completa: capa, resumo com 40 caracteres ou mais e algum gênero além de
   Indie ou algum tema;
6. tem algum sinal de interesse: lançado antes de 2015 com avaliações; lançado desde
   2015 com avaliações ou `hypes`; por lançar com data marcada; ou anunciado sem data
   com `hypes`. O jogo que estava no catálogo na execução anterior e foi lançado há
   menos de 180 dias (`postLaunchGraceDays`) segue a regra de "por lançar": a carência
   protege a passagem de "por lançar" a lançado, porque as avaliações levam tempo para
   aparecer, mas não admite jogo que nunca entrou. O prazo é um valor inicial sem
   evidência e não decide se o jogo é indie, só adia a exigência de sinal (B-13).

Para jogo anunciado sem data, a data de referência do item 2 é a da ingestão. Na
coautoria, basta uma desenvolvedora controlada para excluir, e a data vale para cada
uma. Toda exclusão pelo item 2 registra qual desenvolvedora a causou e quem a controla.

**Grandes empresas: teste de entrada.** Entra a empresa que controla um canal pelo qual
jogos chegam ao jogador (hardware, loja, sistema operacional, plataforma de realidade
virtual ou serviço de assinatura de jogos) ou que controla, integral ou
majoritariamente, estúdio cujos títulos têm orçamento AAA publicamente documentado.
Porte, número de funcionários, volume de publicação e compra de estúdios pequenos não
contam, nem a autonomia declarada dos estúdios. A lista (53 entradas, contando as
variantes de nome que a IGDB registra para a mesma empresa) é o resultado desse teste
aplicado às empresas no topo das cadeias de empresa-mãe das desenvolvedoras do
catálogo; as empresas avaliadas e recusadas estão na seção do B-60.

Cada empresa registra no campo `via` o ramo pelo qual entra: `platform` (canal de
distribuição, 19 entradas), `aaa_budget` (estúdio com orçamento AAA documentado, com
fonte: nenhuma entrada) ou `conglomerate` (34 entradas). **O ramo do orçamento não foi
verificado.** As 34 entradas `conglomerate` (Electronic Arts, Ubisoft, Activision
Blizzard, Take-Two, Square Enix, Capcom, Konami, Bandai Namco, Sega, Embracer,
Krafton, NetEase, Kadokawa, NCSOFT, Disney, Warner e outras, com variantes de nome)
entram como conglomerados AAA notórios, sem fonte de orçamento anexada. O campo deixa
essa dependência visível.

**Estúdios controlados.** A lista tem 58 estúdios, cada um com dona, tipo de controle
(`wholly_owned`, `majority` ou `acquired`, quando o release diz "acquires" sem
percentual), data de aquisição, data de saída do grupo quando houver e fonte pública
(release de aquisição ou notícia da época). A empresa-mãe registrada na IGDB só sugere
candidatos: o levantamento abaixo mostra que ela erra nos dois sentidos.

**Qual data da IGDB.** A data de lançamento é o `first_release_date` da IGDB, que
aponta para o primeiro lançamento completo (situação "Full Release"): o acesso
antecipado e os portes posteriores não contam. *Wreckfest*, por exemplo, tem acesso
antecipado em 23/01/2014, versão 1.0 para PC em 14/06/2018 (a data usada) e consoles em
27/08/2019; com a data dos consoles, ele seria excluído, porque a Bugbear foi comprada
em novembro de 2018. Toda exclusão pelo item 2 registra a data usada e se ela veio do
lançamento ou, no jogo sem data, da avaliação.

**Listas de exceção** corrigem erro de classificação indie (itens 1 e 2). "Sempre
manter" vale para jogo desenvolvido por estúdios independentes na data de lançamento,
excluído por um crédito da IGDB que não corresponde a esse desenvolvimento: publisher,
estúdio de porte ou estúdio que assumiu o jogo depois do lançamento, creditados como
desenvolvedores. "Sempre excluir" vale para jogo com rótulo indie cujo orçamento ou
estrutura de produção AAA é documentado. Nunca sobrepõem o filtro de
conteúdo, a ficha completa nem o sinal de interesse. Cada entrada exige motivo, fonte
pública e data, e as duas listas somadas têm teto de 20 entradas: se passar disso, o
problema é a regra, não os casos.

## Como a regra chegou aqui

**B-11 (21/10/2026).** A primeira versão excluía jogos **publicados** por grandes
empresas. Ela acertou 17 de 22 casos conferidos à mão, mas a amostra só media o que era
aceito.

**B-59 (22/10/2026): medição dos falsos negativos.** O censo de todos os 130.378 jogos
indie da IGDB mostrou que a regra de publisher excluía 102 jogos, 94 deles **apenas**
por ela (sem a regra, passariam no resto do critério). Uma amostra de 10 desses 94,
sorteada com semente fixa e classificada à mão:

| Jogo | Estúdio → publisher grande | Classificação |
| --- | --- | --- |
| World of Goo (2008) | 2D Boy → Microsoft | Indie excluído por engano |
| Skullgirls (2012) | Lab Zero / Reverge Labs → Konami | Indie excluído por engano |
| PixelJunk: 4am (2012) | Q-Games → Sony | Indie excluído por engano |
| Goetia (2016) | Sushee → Square Enix (selo Collective) | Indie excluído por engano |
| Attractio (2014) | GameCoder Studios → Bandai Namco | Indie excluído por engano |
| Sea of Solitude (2019) | Jo-Mei Games → EA Originals | Indie excluído por engano |
| Tales of Kenzera: Zau (2024) | Surgent Studios → EA Originals | Indie excluído por engano |
| Dinkum (2025) | James Bendon (solo) → Krafton | Indie excluído por engano |
| Wakfu (2012) | Ankama → Square Enix | Discutível: empresa independente, mas de porte médio |
| Alter Ego (1986) | Activision → Activision | Exclusão correta: desenvolvido pela própria Activision, pela propriedade do estúdio, não por erro de rótulo |

Taxa: 8 indies legítimos excluídos, 1 discutível e 1 exclusão correta em 10. Os 94
incluíam *Limbo*, *Braid*, *PowerWash Simulator* e *Chroma Squad* (estúdio
brasileiro), o que confirma o que dois dos seis entrevistados na BGS 2026 disseram.
A regra media a distribuição, enquanto o princípio fala da propriedade do estúdio; ela
foi trocada pela regra de controle antes da carga real (B-14).

A amostra de 10 mediu a regra antiga. A regra de controle tende a errar no sentido
oposto, aceitando jogo de estúdio controlado que não está na lista; ela foi medida no
B-60 (seção seguinte).

**As duas regras sobre o mesmo retrato da IGDB** (22/10/2026, 130.389 jogos indie):

| | Jogos |
| --- | --- |
| Aceitos pela regra de publisher | 19.955 |
| Excluídos pela de publisher e aceitos pela de controle | +79 |
| Aceitos pela de publisher e excluídos pela de controle | −37 |
| Aceitos pela regra de controle | **19.997** |

Os 94 jogos excluídos apenas pela regra de publisher e os 54 excluídos apenas pela de
controle não somam de forma direta: 15 deles estão nos dois conjuntos (*Two Point
Campus*, *Alter Ego*, *OlliOlli World*…), e a IGDB, que é atualizada continuamente,
ganhou jogos entre as execuções. A contagem acima vem de uma única passada.

Entre os excluídos apenas pela regra de controle estão *Road 96* (DigixArt,
comprada pela Embracer 11 dias antes do lançamento), *We Happy Few* (Compulsion, 2
meses depois da compra pela Microsoft), *Warhammer 40,000: Darktide* (Fatshark,
Tencent), *Shadow Warrior 3* (Flying Wild Hog, Embracer), *OlliOlli World* (Roll7,
Take-Two) e *Two Point Campus* (Two Point, Sega). Continuam no catálogo os jogos
lançados antes da compra do estúdio: *Fall Guys*, *Hellblade*, *Two Point Hospital*,
*Little Nightmares*, *Wreckfest*, *Brawlhalla*, *Deep Rock Galactic*, *Maneater* e
*Teardown*.

## Medição da regra de controle (B-60)

**O resultado do B-60 são dois achados, não as amostras.** As amostras de 10 jogos
mostraram onde procurar; os achados vieram da varredura que elas motivaram.

Retrato da IGDB de 23/10/2026, com a lista final: 20.014 jogos aceitos e 57 excluídos
apenas pela regra de controle (sem ela, passariam no resto do critério).

### Amostra dos excluídos

10 dos 53 excluídos apenas pela regra de controle antes das cinco empresas novas,
sorteados com semente fixa:

| Jogo | Desenvolvedora → dona | Classificação |
| --- | --- | --- |
| Locomoto (2025) | Green Tile Digital → Embracer | Correta pela regra (estúdio pequeno comprado por conglomerado, ver Limitações) |
| A Storied Life: Tabitha (2026) | Lab42 → Sumo Group → Tencent | Correta (ver o par Lab42) |
| Counter-Strike Nexon (2014) | Valve, Nexon | Correta: coprodução da Valve |
| Chorus (2021) | Fishlabs → Embracer | Correta |
| Kerbal Space Program 2 (2023) | Intercept Games → Take-Two | Correta: estúdio criado pela Take-Two |
| Kill The Crows (2023) | 5minlab → Krafton | Correta |
| Hohokum (2014) | SCE Santa Monica, Honeyslug, Richard Hogg | Correta: coprodução da Sony |
| Neighbors: Suburban Warfare (2026) | Invisible Walls → Embracer | Correta pela regra (estúdio pequeno comprado por conglomerado) |
| Lightyear Frontier (2024) | Frame Break → Embracer | Correta pela regra (estúdio pequeno comprado por conglomerado) |
| The Tomorrow Children (2016) | SIE Japan Studio, Q-Games | Correta: coprodução da Sony |

Taxa: 10 exclusões corretas em 10. Três delas são da classe já registrada como
limitação: estúdio pequeno comprado por conglomerado.

### Amostra dos aceitos

10 dos 20.011 aceitos, sorteados com semente fixa:

| Jogo | Desenvolvedora (publisher) | Classificação |
| --- | --- | --- |
| The Vow: Vampire's Curse | Mimyr Games | Correta |
| Akane (2018) | Ludic Studios (Qubic Games, DX Gameworks) | Correta |
| Nuvoid | Targon Studios | Correta |
| Battalion Legacy (2019) | Bulkhead (Square Enix Collective, só publica) | Correta |
| Missing Translation (2015) | AlPixel Games (GamesBoosters) | Correta |
| Rogue State Revolution (2021) | LRDGames (Modern Wolf) | Correta |
| Gorescript (2017) | **nenhuma** | Sem desenvolvedora creditada |
| Duke Grabowski: Mighty Swashbuckler (2016) | **nenhuma** (Alliance Digital Media) | Sem desenvolvedora creditada |
| 100 Tokyo Cats | **nenhuma** | Sem desenvolvedora creditada |
| Escape Protocol: Online | **nenhuma** (Ultimate Games) | Sem desenvolvedora creditada |

Os quatro sem desenvolvedora não são "inconclusivos": são uma observação do achado 2.
Na amostra, 4 em 10 (40%) não têm desenvolvedora; no catálogo, 23,15%.

### Achado 1: lacuna na lista de grandes

*Oxenfree II* (2023) era aceito, mas a Night School Studio é da Netflix desde
28/09/2021. A Netflix não estava na lista porque ela era acumulada caso a caso. A
varredura de todas as cadeias de empresa-mãe (seção "Varredura das empresas-mãe")
acrescentou Netflix, Kadokawa, Meta, NCSOFT e Amazon:

| Empresa | Ramo do teste (`via`) | Efeito atual |
| --- | --- | --- |
| Netflix | Canal: serviço de assinatura de jogos no Netflix | *Oxenfree II* (Night School, comprada em 28/09/2021) sai; *Oxenfree* (2016) e *Afterparty* (2019) ficam |
| Kadokawa | Conglomerado: controla a FromSoftware. A Sony tem cerca de 10% da Kadokawa desde janeiro de 2025: é participação minoritária e não muda nada pela regra | *All in Abyss* (2025) e *Black Finger Jet* (sem data) saem (ACQUIRE, 100% desde 08/02/2024); *Steel Sword Story* (2019) sai pelo crédito da própria Kadokawa (ver abaixo) |
| Meta | Canal: plataforma de realidade virtual (Quest) | Nenhum: Beat Games, Armature e Twisted Pixel só têm jogos anteriores à compra |
| NCSOFT | Conglomerado: estúdios de MMO de grande produção | Nenhum: *Clickr* (2010), da Ntreev, é anterior aos 76% de 15/02/2012 |
| Amazon | Canal: loja e serviço de jogos (Appstore, Luna) | Nenhum: *Wik & the Fable of Souls* (2004), da Reflexive, é anterior à compra |

**A redação do teste foi ampliada depois de identificadas as empresas.** A primeira
versão do critério falava em "donas de plataforma" sem definir plataforma. Dois casos
revelaram a lacuna: a Netflix, que distribui jogos pelo próprio serviço de assinatura,
sem console nem loja, e a Meta, cuja plataforma é de realidade virtual. A cláusula foi
reescrita a partir do princípio (controlar um canal pelo qual jogos chegam ao
jogador), e as duas passam a decorrer dele em vez de serem casos nomeados. A ordem
fica registrada porque a redação veio depois da conclusão.

A regra é por empresa, não por efeito: três das cinco não mudam nenhum resultado
hoje, e entram assim mesmo.

### Achado 2: jogos aceitos sem desenvolvedora creditada

Um jogo sem desenvolvedora creditada nunca é excluído pela regra de controle: a regra
não tem o que avaliar. Ponderada pela visibilidade, a fração é pequena:

- **ponderada pelas avaliações: 1,54%** das avaliações do catálogo são de jogos sem
  desenvolvedora;
- **bruta: 23,15%** dos jogos aceitos (4.634 de 20.014).

| Recorte dos aceitos | Jogos | Sem desenvolvedora | Fração |
| --- | --- | --- | --- |
| Todos | 20.014 | 4.634 | 23,15% |
| Lançados | 14.057 | 2.318 | 16,49% |
| Com ao menos 1 avaliação | 9.392 | 1.111 | 11,83% |
| Com 5 ou mais avaliações | 4.554 | 141 | 3,10% |
| Com 20 ou mais avaliações | 1.529 | 14 | 0,92% |

**Auditoria do subconjunto visível.** Os 14 jogos com 20 ou mais avaliações foram
lidos um a um, e nenhum é de estúdio controlado por grande empresa: *Battle for
Wesnoth* e *Cataclysm: Dark Days Ahead* (projetos de código aberto), *Clone Hero*
(projeto comunitário), *Moon Hunters* (Kitfox Games), *Little Fighter 2* (Marti Wong
e Starsky Wong), *The Uncertain: Last Quiet Day* (ComonGames), *Charlie Murder* (Ska
Studios), *Tick Tock: A Tale for Two* (Other Tales Interactive), *Gunman Clive*
(Bertil Hörberg), *She Sees Red* (Rhinotales), *Electronic Super Joy* (Michael Todd
Games), *Ratty Catty* e *Eufloria* (estúdios pequenos) e *Idate: Online Interactive
Dating* (desenvolvedora não identificada; a publisher creditada é a GameClub). Os 141
com 5 ou mais avaliações foram revisados pelo nome e pela publisher creditada, sem
fonte jogo a jogo: nenhum tem publisher da lista de grandes, e 84 não têm publisher
nenhuma.

Decisão: a falta de desenvolvedora é registrada como limitação e escalada ao M0 (seção
8.10 do relatório), **sem regra de reserva**. Excluir pela publisher quando falta a
desenvolvedora traria de volta a regra derrubada no B-59.

### O par Lab42

O mesmo estúdio, com resultados opostos, e os dois certos. A Lab42 é da Sumo Group
desde 15/05/2020, e a Sumo Group é da Tencent desde 18/01/2022.

| Jogo | Crédito da IGDB | Resultado | Por quê |
| --- | --- | --- | --- |
| Chained Together (2024) | Anegar Games e Lab42 | Aceito por exceção | A Anegar Games desenvolveu e publicou o jogo no PC; a Lab42 entrou pelo porte para consoles. O crédito de porte não corresponde ao desenvolvimento |
| A Storied Life: Tabitha (14/04/2026) | Lab42 | Excluído pela regra | Primeiro jogo original da Lab42, desenvolvido por ela quando já pertencia à Tencent |

### A assimetria do defeito de crédito

Os créditos de desenvolvedora da IGDB falham de dois jeitos, com consequências
diferentes:

- **Crédito ausente** leva a aceitar por padrão: a regra falha abrindo. O erro aparece
  no catálogo e pode ser encontrado olhando os jogos aceitos (achado 2).
- **Crédito presente mas errado** pode falhar nos dois sentidos. Um porte ou uma
  publisher creditados como desenvolvedora excluem um indie (*Chained Together*,
  *Ilomilo*, *Growtopia*); uma desenvolvedora errada pode também aceitar o jogo de um
  estúdio controlado. **Esse é o caso perigoso:** a exclusão errada parece um
  resultado correto e só aparece com verificação manual, jogo a jogo.

*Tabitha* e *Chained Together* são os dois lados do mesmo defeito de dado: o mesmo
crédito à Lab42 está certo em um jogo e errado no outro, e só a fonte de cada jogo
distingue os dois.

**Steel Sword Story (2019) — decidido: excluído.** Passou a ser excluído com a entrada
da Kadokawa, porque a IGDB credita a própria Kadokawa Corporation como
codesenvolvedora, ao lado da 8bits fanatics. A hipótese era de publisher ocupando o
campo de desenvolvedora, e as fontes não a sustentam:

- a Famitsu, no lançamento (21/06/2019), credita as duas: "開発元: 8bits fanatics,
  KADOKAWA CORPORATION", com copyright da Kadokawa
  (https://www.famitsu.com/news/201906/21178429.html);
- o jogo nasceu como amostra do Pixel Game Maker MV, ferramenta da Kadokawa, e foi
  publicado pela Playism
  (https://playism.com/news/2018/1130/introducing-steel-sword-story-featured-on-nhk-world/);
- a 4Gamer, em 2024, credita só a 8bits fanatics
  (https://www.4gamer.net/games/466/G046694/20240604022/).

Isso descreve obra encomendada pelo conglomerado e de propriedade dele, uma relação
que a regra captura, como nas coproduções da Sony. O jogo não cumpre a regra de
admissão do "sempre manter", porque o crédito corresponde ao desenvolvimento. Admiti-lo
exigiria uma subcláusula criada para um jogo só ("a dona da ferramenta não conta como
coprodução"), sem evidência além dele.

A divergência aqui é **entre fontes**, não entre a IGDB e a realidade: a IGDB copiou
fielmente o crédito de lançamento.

### Créditos errados que a lista de estúdios não corrige

Dois estúdios ligados à Kadokawa aparecem como desenvolvedores em jogos que não
desenvolveram. Eles ficam fora da lista de estúdios controlados, e os jogos continuam
aceitos:

| Jogo | Crédito da IGDB | Fonte |
| --- | --- | --- |
| Raging Loop (2015) | DWANGO e Kemco | Desenvolvido pela Kemco em cooperação com a Dwango (https://en.wikipedia.org/wiki/Raging_Loop) |
| Yume Nikki: Dream Diary (2018) | Kadokawa Games e Active Gaming Media | Desenvolvido pela Active Gaming Media (https://en.wikipedia.org/wiki/Yume_Nikki:_Dream_Diary) |

### Varredura das empresas-mãe

Das 11.972 desenvolvedoras do conjunto candidato, 249 têm empresa-mãe na IGDB. No topo
dessas cadeias há 134 empresas: 28 estão na lista de grandes e 106 não. Todas as 106
foram avaliadas pelo teste de entrada.

#### Limítrofes avaliadas e recusadas

As 10 empresas fora da lista com argumento para entrar. O efeito atual é o que
mudaria se a empresa entrasse, com a data de compra de cada estúdio.

O alerta da ingestão (B-13) só cobre jogo novo no catálogo. Por isso, **esta tabela é
o único registro dos jogos hoje aceitos que mudariam de lado se uma recusa fosse
revertida**: *Graft*, *Windjammers 2*, *Absolum*, *Rogue Lords*, *Dragons and Titans*,
*Where the Seeds Fall* e, se o controle se confirmar, *The Midnight Walkers* e
*Quiet*.

| Empresa | Estúdios no catálogo | Efeito atual | Motivo da recusa |
| --- | --- | --- | --- |
| Behaviour Interactive | Red Hook Studios (24/09/2024), The Fun Pimps (março de 2026) | Nenhum: *Darkest Dungeon* (2016), *Darkest Dungeon II* (2023) e *7 Days to Die* (1.0 em 2024) são anteriores às compras | Não controla canal de distribuição e não controla estúdio AAA: é um desenvolvedor grande (de 1.200 a 1.600 pessoas) que faz trabalho por encomenda e opera *Dead by Daylight*. É o caso da Amplifier um nível acima, um consolidador de porte médio comprando estúdios pequenos. As compras foram integrais e o teste é controle: a Behaviour fica fora por não ser grande pelo teste, não pela autonomia da Red Hook |
| Paradox Interactive | Harebrained Schemes (07/06/2018), Haemimont Games, Iceflake Studios | *Graft* (Harebrained, sem data) sairia pela data da avaliação | Removida no B-11 por decisão documentada (caso *Prison Architect*); readicioná-la reverteria essa decisão sem evidência nova |
| Focus Entertainment | DotEmu (77,5% em 30/09/2021), Deck13, Streum On | *Windjammers 2* (2022) e *Absolum* (2025) sairiam | Publisher de porte médio, sem canal de distribuição e sem estúdio AAA |
| Nacon | Cyanide (100% em maio de 2018), Big Ant, EKO Software | *Rogue Lords* (2021) sairia | Publisher de porte médio, sem canal de distribuição e sem estúdio AAA |
| Enad Global 7 | Daybreak Game Company | Nenhum: *DC Universe Online* já sai pela Sony Online Entertainment | Publisher de porte médio, sem canal de distribuição e sem estúdio AAA |
| Kabam | Wild Shadow Studios | Nenhum: *Realm of the Mad God* (2011) é anterior à compra do jogo | Publisher de porte médio, sem canal de distribuição e sem estúdio AAA |
| Hasbro | Backflip Studios (70% em 08/07/2013) | *Dragons and Titans* (2014) sairia | **Argumento a favor:** controla a Wizards of the Coast, dona da Archetype Entertainment, estúdio de *Exodus*. **Recusa:** não controla canal de distribuição, e nenhum título lançado de estúdio que ela controla tem orçamento AAA publicamente documentado (*Exodus* não foi lançado). Um jogo novo da Wizards ou da Archetype com rótulo indie seria sinalizado pelo alerta do B-13 |
| CyberAgent | Cygames (criada pela CyberAgent em 2011, controle majoritário) | *Where the Seeds Fall* (2026-11-05) sairia | **Argumento a favor:** a Cygames é uma desenvolvedora grande (*Granblue Fantasy: Relink*). **Recusa, decidida em 23/10/2026:** a CyberAgent não controla canal pelo qual jogos chegam ao jogador. O jogo já está no catálogo e sai em 05/11/2026; esta linha é a decisão para quando ele aparecer em revisão |
| Wemade | Oneway Ticket Studio (via Madngine) | *The Midnight Walkers* (2026-09-30), se o controle se confirmar | Não controla canal pelo qual jogos chegam ao jogador |
| LINE Corporation | LINE Games | *Quiet* (2026-12-31), se o controle se confirmar | Não controla canal de distribuição de jogos |

Fontes das datas: Red Hook
(https://www.gematsu.com/2024/09/behaviour-interactive-acquires-red-hook-studios), The
Fun Pimps (https://www.gematsu.com/2026/03/behaviour-interactive-acquires-the-fun-pimps),
Harebrained
(https://www.paradoxinteractive.com/media/press-releases/press-release/paradox-interactive-to-acquire-seattle-based-harebrained-schemes),
DotEmu (https://www.gematsu.com/2021/08/focus-home-interactive-acquires-dotemu), Cyanide
(https://gematsu.com/2018/05/bigben-interactive-acquires-cyanide-studio), Backflip
(https://investor.hasbro.com/news-releases/news-release-details/hasbro-strengthens-mobile-gaming-expertise-purchase-majority)
e Cygames (https://en.wikipedia.org/wiki/Cygames).

**Questão em aberto: o ramo do orçamento AAA.** A recusa pelo canal não fecha o
segundo ramo do teste. Como está escrito, com "ou", a CyberAgent passa no teste no dia
em que o orçamento de um título da Cygames for publicado. **A CyberAgent é o caso que
vai cobrar a resposta.** Restringir o ramo a conglomerados não resolve, porque o
esvazia: conglomerado já entra sozinho, e o ramo não faria trabalho nenhum. Hoje ele
tem zero entradas e nenhuma fonte. As duas saídas, a decidir fora do B-60:

- o ramo sai, e o teste passa a ser canal de distribuição ou conglomerado AAA, o que já
  descreve as 53 entradas;
- o ramo ganha um limiar de orçamento e uma fonte por empresa.

#### As outras 96

Ficam fora sem argumento para entrar, por não terem plataforma nem estúdio AAA:

- **Publishers e grupos de porte médio ou dedicados a indies (57):** Coffee Stain
  Studios, PlayWay (duas entradas), Maximum Entertainment, tinyBuild, Thunderful (duas
  entradas), THQ (extinta), Saber Interactive, Two Tribes Publishing, Marvelous,
  Forever Entertainment, Devolver Digital, Atari SA, CreativeForge Games, Big Fish
  Games, Alliance Media Holdings, Asterizm, 11 bit studios, Asmik Ace, Adult Swim
  Games, Other Ocean Group, Jellyvision, Illusion Softworks, Animoca Brands, Wahoo
  Studios, Kalypso Media, Nippon Ichi Software, SOEDESCO, Room 8 Group, Curve Games,
  Curve Digital, Stillfront Group, Don't Nod, Keywords Studios, Fulqrum Publishing,
  COLOPL, Team17, Remote Control Productions, Wildlife Studios, Reel FX, Bloober Team,
  Awaken Realms, Source Technology, Zordix, CerebralFix, Gamedust, Wangyuan Shengtang,
  Bithell Games, Pocketpair, Weta Workshop, Joey Drew Studios, Crytivo, GCL Asia, Cryo
  Networks (extinta), Experimental Gameplay Group e Millendream.
- **Estúdios pequenos, pessoas físicas e uma universidade (30):** JumpButton Studio,
  Zonitron Productions, LakeFeperd, Z-Software, Gionathan Pesaresi, Bandello, Mythos
  Makers, Waddling Technology, ONE-UP, TNgineers, Vibedy, padSoft, Ryan Pocock,
  RainyGames, 67 Games, Animita Project, Spatial Quotient Interactive, Sven, btf, 100
  Cozy Games, AnimatronX, The Iterative Collective, Clever Trickster Productions,
  Terletski Comics, Aterdux Entertainment, Connor Warrington, Batuhan Gündüz, 2 Wedges
  Studio, ACSoftware e Breda University of Applied Sciences.
- **Vínculos que não são empresa (9):** a entrada "Independent", que a IGDB usa como
  empresa-mãe de 10 estúdios, e 8 cadeias em que a empresa é mãe de uma entrada com o
  mesmo nome (Cultic Games, Kodobur, Hero Concept, Desert Beagle, NEARstudios, Nebula
  Nova Games, NimbleGames e Enthariel Games).

## Coautoria

A cláusula "basta uma desenvolvedora controlada" exclui 8 jogos que têm também uma
desenvolvedora não controlada. Todos foram lidos:

| Jogo | Desenvolvedoras | Leitura |
| --- | --- | --- |
| DC Universe Online (2011) | Sony Online Entertainment, Daybreak | Correta: Daybreak é o mesmo estúdio, renomeado depois da venda em 2015 |
| Noby Noby Boy (2009) | Namco Bandai Games, Keita Takahashi | Correta: produção interna da Namco |
| The Tomorrow Children (2016) | SIE Japan Studio, Q-Games | Correta: coprodução da Sony |
| Hohokum (2014) | SCE Santa Monica, Honeyslug, Richard Hogg | Correta: coprodução da Sony |
| Counter-Strike Nexon (2014) | Valve, Nexon | Correta |
| Transference (2018) | Ubisoft Montreal, SpectreVision | Correta: desenvolvido pela Ubisoft |
| GetsuFumaDen: Undying Moon (2021) | Konami Digital Entertainment, GuruGuru | Correta: IP e coprodução da Konami |
| Chained Together (2024) | Anegar Games, Lab42 | **Errada**: a Lab42 (Sumo/Tencent) entrou pelo porte para consoles; corrigida por exceção |

O mesmo erro de crédito aparece fora da coautoria e também foi corrigido por exceção:
*Growtopia* (a Ubisoft Abu Dhabi assumiu o jogo depois da compra pela Ubisoft em 2017)
e *Ilomilo* (a Microsoft, publisher, creditada também como desenvolvedora). Já em
*Rollers of the Realm* a IGDB credita só a Atlus USA, braço de publicação da Sega; por
isso a Atlus USA não entra na lista de estúdios controlados.

## Exceções em vigor

| Lista | Jogo | Motivo | Fonte |
| --- | --- | --- | --- |
| Sempre manter | Growtopia (26352) | Criado pelos independentes Robinson Technologies e Hamumu; a Ubisoft comprou o jogo em 28/02/2017 e a Ubisoft Abu Dhabi assumiu depois | https://www.pocketgamer.biz/ubisoft-acquires-sandbox-title-growtopia |
| Sempre manter | Ilomilo (7086) | Desenvolvido pela SouthEnd Interactive; a Microsoft foi a publisher | https://giantbomb.com/wiki/Games/ilomilo |
| Sempre manter | Chained Together (265111) | Desenvolvido e publicado pela Anegar Games no PC; a Lab42 entrou pelo porte | https://en.wikipedia.org/wiki/Chained_Together |
| Sempre excluir | Squadron 42 (19128) | Marcado como indie na IGDB, mas financiado junto com Star Citizen, que passou de US$ 1 bilhão em financiamento coletivo e vendas antecipadas | https://en.wikipedia.org/wiki/Squadron_42 |

A exceção de *Journey* (B-11) foi removida: a Thatgamecompany não pertence à Sony, e o
jogo passa pela regra de controle.

## Casos conferidos no B-11

14 casos notáveis e 8 sorteados do catálogo, reavaliados com a regra de controle.

| Jogo | Estúdio → publisher | Resultado |
| --- | --- | --- |
| Hotline Miami | Dennaton → Devolver Digital | Aceito |
| Outer Wilds | Mobius Digital → Annapurna, Limited Run | Aceito |
| Prison Architect | Introversion → Paradox | Aceito |
| Stardew Valley | ConcernedApe → Chucklefish, 505 Games | Aceito |
| Papers, Please | Lucas Pope → 3909 | Aceito |
| Celeste | Extremely OK Games → Maddy Makes Games | Aceito |
| Journey | Thatgamecompany → Sony, Annapurna | Aceito (antes, só por exceção) |
| Fall Guys | Mediatonic → Epic Games, Devolver | Aceito: lançado em agosto de 2020, antes da compra da Mediatonic pela Epic (março de 2021) |
| Two Point Campus | Two Point Studios → Sega | Excluído: estúdio da Sega desde maio de 2019 |
| HuniePop | HuniePot | Excluído (tema Erotic) |
| Katawa Shoujo | Four Leaf Studios | Excluído (tema Erotic): o rótulo de conteúdo está correto |
| Ori and the Blind Forest | Moon Studios → Microsoft | Fora do conjunto: a IGDB não o marca como indie |
| Unravel | ColdWood → Electronic Arts | Fora do conjunto: a IGDB não o marca como indie |
| Squadron 42 | Cloud Imperium | Excluído por exceção |
| Feed It, Forest 3, Mushroom 11, Dark Anarchy, Metal Drift, Lunark, Resistor, Aurora: The Lost Medallion *(sorteados)* | estúdios pequenos ou publishers indie | Aceitos |

## Levantamento dos estúdios controlados

A IGDB sugeriu 100 desenvolvedoras ligadas a grandes empresas, primeiro pelo id da
empresa-mãe e depois pelo nome de toda a cadeia de empresas-mãe (grupos como Tencent,
Sony e Microsoft têm várias entradas na IGDB). Cada uma foi verificada em fonte
pública, com prioridade para os casos em que o jogo mais recente do estúdio está a
menos de dois anos da compra. Esse guarda-corpo corrigiu três datas que a memória
dava como certas: HandyGames (2018, não 2017), Tripwire e Tuxedo Labs (2022, não 2020
e 2021).

### Erros da IGDB encontrados

Das 249 desenvolvedoras do conjunto candidato com empresa-mãe na IGDB (varredura do
B-60), **77 foram conferidas em fonte: 66 vínculos corretos e 11 errados (14%)**. A
conferência priorizou os vínculos suspeitos e os que mudariam algum resultado, então
**14% é limite superior** da taxa de erro do campo. Outros 154 não foram conferidos,
porque não mudam nenhum resultado sozinhos.

**18 vínculos não indicam propriedade:** 10 estúdios têm como empresa-mãe a entrada
"Independent", e 8 cadeias têm a empresa como mãe de uma entrada com o mesmo nome. O
campo de empresa-mãe também é usado como marcador de não propriedade, mais um motivo
para ele só sugerir candidatos.

**O erro pode estar a montante da IGDB.** O campo de desenvolvedora costuma ser cópia
fiel do crédito da época. Em *Steel Sword Story*, a IGDB reproduz o crédito de
lançamento (Kadokawa como codesenvolvedora), e quem diverge são as fontes entre si
(Famitsu 2019 contra 4Gamer 2024). Conferir a IGDB contra uma única fonte não basta.

Os 11 errados: os 9 da tabela abaixo, mais Kavalri Games e Iron Gate Studios, que a
IGDB põe sob a Amplifier e a Coffee Stain, das quais só têm participação minoritária.
Two Point Studios e Coffee Stain Studios erram no sentido oposto (controladas, sem
empresa-mãe na IGDB) e ficam fora da conta dos 249.

| Estúdio | O que a IGDB diz | O que as fontes mostram |
| --- | --- | --- |
| Digital Eclipse | Pertence à Atari, que pertence à Warner | É da Atari SA desde 2023; a Warner foi dona da Atari original de 1976 a 1984, e a IGDB mistura as duas na mesma entrada |
| Jo-Mei Games | Pertence à Electronic Arts | Estúdio independente de Berlim; a EA só publicou *Sea of Solitude* |
| Neon Giant | Pertence à Embracer | Comprada pela Krafton em 2022 |
| Echtra Games | Pertence à Embracer | Era da Perfect World (fora da lista) e foi vendida à Zynga em 2021 |
| Runic Games | Pertence à Embracer | Era da Perfect World e fechou em 2017 |
| GungHo America, Gravity | Pertencem à NetEase | Pertencem à GungHo, fora da lista |
| Grove Street Games | Pertence à Rockstar | Nenhuma fonte de compra |
| SparklingBit | Pertence à THQ Nordic | Desenvolve *Sacred* sob licença |
| Two Point Studios | Sem empresa-mãe | Subsidiária integral da Sega desde 09/05/2019 |
| Coffee Stain Studios | Sem empresa-mãe | Da THQ Nordic/Embracer de 2018 até a separação do Coffee Stain Group em 2025 |

### Participação minoritária (não excluem)

| Empresa | Participação |
| --- | --- |
| Kavalri Games | 40% da Amplifier (Embracer) em 2022 |
| Iron Gate Studios (*Valheim*) | 30% da Coffee Stain |
| Fatshark | 36% da Tencent em 2019 (a maioria só veio em 2021, e está na lista a partir daí) |
| Kadokawa | Cerca de 10% da Sony desde janeiro de 2025 (https://80.lv/articles/sony-is-not-buying-kadokawa-but-becomes-its-largest-shareholder/); a Kadokawa entra na lista de grandes por controlar a FromSoftware |

### Estúdios sem efeito atual

Estúdios sugeridos que não estão na lista porque todo o catálogo deles na IGDB é
anterior à compra, com folga de pelo menos dois anos. A data do jogo mais recente vem
da IGDB; o ano da compra é o conhecido no levantamento, sem fonte citada porque não
muda nenhum resultado. A lista legível por máquina está em `reviewedCompanies` no
`indie-criteria.json` (decisão `no_current_effect`, com grupo e ano da compra): a
ingestão (B-13) gera o alerta `NO_EFFECT_STUDIO` quando um jogo do catálogo desses
estúdios é do ano da compra em diante (ou, sem data, quando a execução é).

| Estúdio | Jogo mais recente no catálogo | Grupo e ano da compra |
| --- | --- | --- |
| Asmodee Digital | 2019-11 (Munchkin: Quacked Quest) | Embracer, 2022 (o grupo Asmodee saiu da Embracer em 2025) |
| Days of Wonder | 2008-06 (Ticket to Ride) | Embracer, 2022 (via Asmodee) |
| Deca Games | 2011-06 (Realm of the Mad God) | Embracer, 2020 |
| Demiurge Studios | 2012-03 (Shoot Many Robots) | Embracer (Saber), 2021 |
| Firesprite | 2018-06 (The Persistence) | Sony, 2021 |
| Grasshopper Manufacture | 2012-03 (Sine Mora) | NetEase, 2021 |
| Gunfire Games | 2016-03 (Chronos) | Embracer (THQ Nordic), 2019 |
| Housemarque | 2017-06 (Nex Machina) | Sony, 2021 |
| id Software | 1991 (Keen Dreams) | ZeniMax, 2009 |
| Insomniac Games | 2015-04 (Slow Down, Bull) | Sony, 2019 |
| Miniclip | 2009-01 (Monster Trucks Nitro) | Tencent, 2015 |
| New World Interactive | 2017-03 (Day of Infamy) | Embracer (Saber), 2020 |
| Obsidian Entertainment | 2015-03 (Pillars of Eternity) | Microsoft, 2018 |
| Playdots | 2014-05 (Two Dots) | Take-Two, 2020 |
| Psyonix | 2015-07 (Rocket League) | Epic Games, 2019 |
| Sierra | 1995 (Shivers) | Activision, 2008 |
| Snapshot Games | 2015-10 (Chaos Reborn) | Embracer, 2020 |
| Tarsier Studios | 2017-04 (Little Nightmares) | Embracer, 2019 |
| Three Rings Design | 2006-12 (Bang! Howdy) | Sega, 2011 |
| Toys for Bob | 1992-11 (Star Control II) | Activision, 2005 (independente de novo em 2024) |
| Unknown Worlds | 2012-10 (Natural Selection 2) | Krafton, 2021 |
| Vertigo Games | 2016-12 (Arizona Sunshine) | Embracer (Koch Media), 2020 |
| Sanzaru Games | 2008-03 (Ninja Reflex) | Meta (Oculus), 2020 |
| LucasArts | 2009-10 (Lucidity) | Disney, 2012 |
| Avalanche Studios, Expansive Worlds | 2015-03 (TheHunter: Primal) | Nordisk Film, 2018 |
| Reflexive Entertainment | 2004-09 (Wik & the Fable of Souls) | Amazon, 2008 |

Os estúdios das cinco grandes acrescentadas no B-60 com menos de dois anos de folga, ou
com a data conferida na varredura, têm fonte:

| Estúdio | Jogo mais recente no catálogo | Grupo e data da compra | Fonte |
| --- | --- | --- | --- |
| Beat Games | 2018-05 (Beat Saber) | Facebook (Meta), 26/11/2019 | https://gematsu.com/2019/11/facebook-acquires-beat-saber-developer-beat-games |
| Armature Studio | 2021-07 (Where the Heart Leads) | Meta, 11/10/2022 | https://gematsu.com/2022/10/meta-acquires-armature-studio-camouflaj-and-twisted-pixel |
| Twisted Pixel | 2011-07 (Ms. Splosion Man) | Meta, 11/10/2022 | https://gematsu.com/2022/10/meta-acquires-armature-studio-camouflaj-and-twisted-pixel |
| Ntreev Soft | 2010-12 (Clickr) | NCSOFT, 76% em 15/02/2012 | https://en.wikipedia.org/wiki/Ntreev_Soft |
| The Molasses Flood | 2020-08 (Drake Hollow) | CD Projekt, 60% em 22/10/2021 | https://www.gematsu.com/2021/10/cd-projekt-acquires-the-molasses-flood |
| CCP | 2017-08 (Sparc) | Pearl Abyss, 2018 (venda à gestão anunciada em 2026) | https://www.rpgsite.net/news/7702-pearl-abyss-acquires-ccp-games-makers-of-eve-online |

Outros estúdios verificados com fonte também não mudam nenhum resultado hoje, mas
ficam na lista para os próximos lançamentos: Ninja Theory, Mediatonic, Bugbear,
Blue Mammoth, inXile, Black Forest Games, Pieces Interactive, Massive Miniteam,
Metalhead Software, Neon Giant, Skybox Labs, Tripwire, Tuxedo Labs, Amplitude,
34BigThings, Ghost Ship Games, Easy Trigger, Lavapotion e HandyGames.

### Pendentes

Fora da lista até haver fonte suficiente. Os jogos deles seguem no catálogo e são os
falsos positivos possíveis já identificados.

| Estúdio | O que falta | Jogos aceitos que dependem disso |
| --- | --- | --- |
| Goose Byte | Fonte primária da venda pela Amplifier em agosto de 2023 (só há fonte secundária) | *Sponge Break* (2026-07-30), *The Signal: Stranded on Sirenis* (sem data) |
| PinCool | Data em que a NetEase deixou o controle (entrou a Initiate Games) | *Pritto Prisoner* (2025-12-24) |
| Flyway Games | Data e tipo de controle da Krafton | *Commander Quest* (2025-04-04) |
| Mirage Game Studios | Se a THQ Nordic tem controle societário | *Little Big Workshop* (2019-10-17) |
| Slipgate Ironworks | Se saiu da Embracer junto com a Saber em 28/03/2024 | *Phantom Fury* (2024-04-23), *Combustion* (sem data) |
| Black Rock Studios | Se *Kyoryu* (sem data) é da Black Rock da Disney, que fechou em 2011 | *Kyoryu* (sem data) |

### Conferência dos estúdios sem efeito

Uma passada pelo catálogo conferiu, para cada estúdio da tabela "sem efeito atual" e
da lista de controlados, se algum jogo aceito foi lançado no ano da compra ou depois.
Nenhum estúdio sem efeito tem jogo nessa situação. Entre os controlados, os quatro jogos
do mesmo ano da compra saíram antes da data exata (*Wreckfest* em junho, Bugbear
comprada em novembro de 2018; *Teardown* em abril, Tuxedo Labs em agosto de 2022;
*Devolverland Expo* em julho, Flying Wild Hog em novembro de 2020) ou estão corrigidos
por exceção (*Growtopia*, *Chained Together*). *Wreckfest 2* não está no conjunto
candidato: a IGDB o classifica como Racing e Simulator, sem Indie.

## Limitações

- **Estúdios comprados por conglomerados ficam fora a partir da compra.** DESTINYbit,
  Frame Break, Green Tile Digital, Silent Games, Invisible Walls e Bitwave Games são
  estúdios de 4 a 15 pessoas, comprados integralmente pela Embracer. O critério exclui
  os jogos lançados depois da compra (*Dice Legacy*, *Lightyear Frontier*, *Locomoto*,
  *Empyreal*, *Gimmick! 2*) por causa da estrutura societária do dono, mesmo com o
  estúdio operando de forma autônoma. O mesmo vale para jogos conhecidos lançados
  pouco depois da compra do estúdio: *Road 96* (DigixArt, 11 dias depois da compra
  pela Embracer) e *We Happy Few* (Compulsion Games, 2 meses depois da compra pela
  Microsoft). Autonomia não é verificável em base de dados nenhuma; propriedade é.
- **A data de referência é a do primeiro lançamento completo.** Jogos com acesso
  antecipado longo são avaliados pela data da versão 1.0, não pela do acesso
  antecipado.
- **O conjunto candidato depende do rótulo Indie da IGDB.** *Ori and the Blind Forest*
  e *Unravel* não são avaliados porque a IGDB não os marca como indie.
- **A lista de estúdios controlados depende do levantamento.** Um estúdio controlado
  que a IGDB não liga a nenhuma grande empresa só entra quando é encontrado por outro
  caminho, como aconteceu com Two Point e Coffee Stain Studios. Para os jogos novos, a
  ingestão (B-13) sinaliza para verificação o jogo cuja desenvolvedora tem empresa-mãe
  na IGDB fora da lista de grandes, ou na lista mas fora dos estúdios controlados, e o
  jogo de estúdio "sem efeito atual".
- **O jogo sem data é avaliado pela data da ingestão.** Quando ele ganha data de
  lançamento, a regra da data passa a ter o que comparar. Essa transição é frequente,
  porque o catálogo inclui pré-lançamentos de propósito (quatro dos seis jogos das
  entrevistas da BGS estavam sem lançamento). A ingestão (B-13) reavalia todo jogo
  gravado a cada execução e gera o alerta `RELEASE_DATE_ASSIGNED` nessa transição.
- **Jogos sem desenvolvedora creditada são aceitos.** São 1,54% das avaliações do
  catálogo e 23,15% dos jogos aceitos (achado 2 do B-60). Não há regra de reserva; a
  limitação foi escalada ao M0.
- **Os créditos de desenvolvedora da IGDB incluem porte e publicação.** Os
  erros encontrados estão corrigidos por exceção; outros podem aparecer em jogos novos.
  O crédito errado que exclui um indie só aparece com verificação manual (ver a
  assimetria no B-60).
