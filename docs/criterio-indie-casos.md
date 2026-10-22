# Critério indie — regra, casos reais e levantamento (B-11 e B-59)

O critério fica versionado em `apps/api/config/indie-criteria.json` e é aplicado na
ingestão por `evaluateIndieCriteria` (`apps/api/src/modules/ingestion/indie-criteria.ts`).
Todos os casos deste documento rodam como teste de regressão, a partir das respostas
reais da IGDB salvas em `apps/api/test/fixtures/igdb/criteria-*.json`.

## A regra

**Princípio:** o critério classifica a situação do estúdio na data de lançamento do jogo.

Um jogo entra no catálogo quando:

1. tem o gênero Indie na IGDB;
2. nenhuma desenvolvedora dele, na data de lançamento, é uma dona de plataforma ou
   grande conglomerado AAA, nem um estúdio controlado por uma delas (controle integral
   ou majoritário). Publicar o jogo não exclui; participação minoritária e
   investimento também não;
3. não tem um tema excluído (hoje, só Erotic);
4. não foi cancelado;
5. tem ficha completa: capa, resumo com 40 caracteres ou mais e algum gênero além de
   Indie ou algum tema;
6. tem algum sinal de interesse: lançado antes de 2015 com avaliações; lançado desde
   2015 com avaliações ou `hypes`; por lançar com data marcada; ou anunciado sem data
   com `hypes`.

Para jogo anunciado sem data, a data de referência do item 2 é a da ingestão. Na
coautoria, basta uma desenvolvedora controlada para excluir, e a data vale para cada
uma. Toda exclusão pelo item 2 registra qual desenvolvedora a causou e quem a controla.

**Estúdios controlados.** A lista tem 56 estúdios, cada um com dona, tipo de controle
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

**A regra nova ainda não foi medida por amostra.** A amostra de 10 mediu a regra
antiga. A regra de controle tende a errar no sentido oposto, aceitando jogo de estúdio
controlado que não está na lista. As próximas medições são duas amostras de cerca de
10 jogos: uma dos excluídos pela regra de controle e, mais importante, uma dos aceitos.

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

| Estúdio | O que a IGDB diz | O que as fontes mostram |
| --- | --- | --- |
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

| Estúdio | Participação |
| --- | --- |
| Kavalri Games | 40% da Amplifier (Embracer) em 2022 |
| Iron Gate Studios (*Valheim*) | 30% da Coffee Stain |
| Fatshark | 36% da Tencent em 2019 (a maioria só veio em 2021, e está na lista a partir daí) |

### Estúdios sem efeito atual

Estúdios sugeridos que não estão na lista porque todo o catálogo deles na IGDB é
anterior à compra, com folga de pelo menos dois anos. A data do jogo mais recente vem
da IGDB; o ano da compra é o conhecido no levantamento, sem fonte citada porque não
muda nenhum resultado. Se um desses estúdios lançar um jogo novo, a ingestão (B-13)
sinaliza o caso para verificação.

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
  caminho, como aconteceu com Two Point e Coffee Stain Studios.
- **Os créditos de desenvolvedora da IGDB incluem porte e publicação.** Os erros
  encontrados estão corrigidos por exceção; outros podem aparecer em jogos novos.
