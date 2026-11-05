# Estilos: medição de uma camada curada sobre as palavras-chave (B-73)

Medição feita em 03/11/2026 no banco local, com o catálogo de 22.825 jogos (`inCatalog`). É só
medição: os estilos não foram implementados e a pontuação não mudou.

**Atualizado em 03/11/2026, depois da revisão do autor:**
- A taxonomia foi revista (seção 2, "Revisão do autor") e a medição rodou de novo. Os números deste documento são os da taxonomia revisada; os da primeira rodada ficam registrados onde mudaram.
- O autor aprovou o caminho só de exibição como **B-74**, antes do B-36, e o filtro do catálogo como **B-75**, um item P1. O caminho no vetor virou variante do B-37.
- **Implementado no B-74 (04/11/2026):** o rascunho virou `config/styles.json`, e uma palavra-chave passou a pertencer a um estilo só (`zombie-apocalypse` ficou em Zumbis e `surreal-comedy` em Humor ácido). O `styles:measure` lê esse arquivo e confere que a escolha de interesses da API dá o mesmo que o cenário F da seção 5. Os números da recomendação com estilos estão em `docs/recomendacao.md`.

## Por que medir

O B-71 mostrou que os gêneros e temas da IGDB são amplos demais para recomendações
específicas. Aventura (54% do catálogo) e o tema Ação (53%) cobriam bibliotecas inteiras e
precisaram sair da escolha dos interesses. No vetor, 507 jogos (2,2%) têm só esses dois
atributos.

A especificidade da IGDB está nas palavras-chave (roguelike, metroidvania, soulslike,
deckbuilding, cozy, terror psicológico, time loop). Hoje elas pesam 30% do vetor, mas ficam fora
do motivo e das prateleiras por três razões:
- não têm tradução;
- os sinônimos são palavras-chave separadas ("roguelike", "roguelite", "rogue-lite");
- muitas são raras.

A proposta em avaliação é uma camada curada de **estilos**: um arquivo versionado que agrupa
palavras-chave e termos exatos do resumo em 30 a 50 estilos, com nome em português. Eles
serviriam para prateleiras, motivo e talvez filtro do catálogo, com a mesma curadoria
transparente do critério indie e das coleções.

## Resumo

- **Cobertura:**
  - com palavras-chave e resumo, **53,5% do catálogo** tem ao menos um estilo (58,4% antes da revisão, que tirou as palavras e os termos de presença);
  - só com palavras-chave, 37,5%; só com o resumo, 35,5%. As duas fontes se completam.
- **Recortes de vetor pobre:**
  - as palavras-chave quase não ajudam: 0% dos jogos de vetor idêntico ao de 10 ou mais e 0% do grupo só com Aventura e Ação;
  - o resumo cobre de 30% a 32% desses jogos.
- **Perfis de teste:** dos 600 jogos com peso positivo nas bibliotecas dos 200 perfis da semente 71, 52,7% têm ao menos um estilo.
- **Precisão do resumo:**
  - na amostra da taxonomia revisada (20 jogos que recebem um estilo só pelo resumo), os 20 estão corretos, 2 com evidência fraca;
  - na primeira rodada, foram 17 corretos, 1 duvidoso e 2 incorretos ("farming" e "wasteland" sozinhos). Os dois termos saíram na revisão, com outros dez do mesmo tipo.
- **Desempate dos interesses:** em mais da metade das escolhas de interesse (de 55% a 67%, conforme o cenário), dois ou mais atributos empatam na cobertura. O desempate decide a maioria das escolhas, e trocar o desempate muda os interesses de cerca de metade dos perfis.
- **Critério de decisão:** cobertura acima de 50% e precisão aceitável, antes e depois da revisão. O autor aprovou a implementação pelo caminho só de exibição (B-74, seção 6).

## Método e reprodução

- **Rascunho:** `apps/api/config/styles.draft.json`, com 49 estilos depois da revisão. Cada estilo tem o slug, o nome em português, a categoria, as palavras-chave da IGDB (pelo slug, como nas coleções) e os termos do resumo. Desde o B-74, é `apps/api/config/styles.json`, lido pela API.
- **Regra de casamento:** em `apps/api/src/modules/styles/styles.ts` (era `styles-draft.ts` até o B-74).
  - A palavra-chave casa pelo slug.
  - O termo do resumo casa como palavra inteira, sem diferenciar maiúsculas. A busca e o recorte do trecho são as mesmas funções do `collections:suggest`.
- **Script:** `pnpm --filter api styles:measure > relatorio.md` (`apps/api/src/measure-styles.ts`). Só lê o banco. Serve à curadoria: depois de mudar o rascunho, rodar de novo mostra a cobertura, a frequência de cada estilo e uma amostra nova do resumo.
- **Perfis:** os mesmos do B-71. São 200, cada um com quatro jogos sorteados do catálogo em ordem de id, semente 71, notas 5, 5, 4 e 1. O script confere que a escolha de interesses dele dá o mesmo que `pickInterests` nos 200.
- **Amostra de precisão:** semente 73.
- **Recortes:** como no B-12, sobre o vetor depois do descarte do TF-IDF.
  - "Vetor idêntico ao de pelo menos 10 outros jogos" é o grupo de 11 ou mais jogos com o mesmo conjunto de atributos.
  - "Até 2 etiquetas" conta os atributos do vetor.
  - "Só Aventura e Ação" é o vetor exatamente igual a esses dois.

## 1. As 300 palavras-chave mais frequentes

Contadas nos jogos do catálogo, depois das exclusões de `config/recommendation.json` (lista e
padrões de metadados). São 3.910 palavras-chave distintas. A mais frequente, "casual", está em
5,0% dos jogos, e a 300ª em 0,3%.

| # | Palavra-chave | Slug | Jogos | % |
| --- | --- | --- | --- | --- |
| 1 | casual | casual | 1139 | 5,0% |
| 2 | 2d | 2d | 1100 | 4,8% |
| 3 | exploration | exploration | 945 | 4,1% |
| 4 | female protagonist | female-protagonist | 918 | 4,0% |
| 5 | roguelike | roguelike | 844 | 3,7% |
| 6 | atmospheric | atmospheric | 833 | 3,6% |
| 7 | pixel graphics | pixel-graphics | 781 | 3,4% |
| 8 | cute | cute | 750 | 3,3% |
| 9 | 3d | 3d | 738 | 3,2% |
| 10 | pixel art | pixel-art | 726 | 3,2% |
| 11 | story rich | story-rich | 713 | 3,1% |
| 12 | roguelite | roguelite | 683 | 3,0% |
| 13 | retro | retro | 631 | 2,8% |
| 14 | anime | anime | 558 | 2,4% |
| 15 | relaxing | relaxing | 547 | 2,4% |
| 16 | action-adventure | action-adventure | 500 | 2,2% |
| 17 | single-player only | single-player-only | 487 | 2,1% |
| 18 | psychological horror | psychological-horror | 485 | 2,1% |
| 19 | colorful | colorful | 472 | 2,1% |
| 20 | cozy | cozy | 471 | 2,1% |
| 21 | management | management | 461 | 2,0% |
| 22 | crafting | crafting | 460 | 2,0% |
| 23 | metroidvania | metroidvania | 434 | 1,9% |
| 24 | multiple endings | multiple-endings | 416 | 1,8% |
| 25 | hand-drawn | hand-drawn | 395 | 1,7% |
| 26 | medieval | medieval | 384 | 1,7% |
| 27 | magic | magic | 376 | 1,6% |
| 28 | abstract | abstract | 354 | 1,6% |
| 29 | post-apocalyptic | post-apocalyptic | 349 | 1,5% |
| 30 | family friendly | family-friendly | 332 | 1,5% |
| 31 | procedural generation | procedural-generation | 329 | 1,4% |
| 32 | bullet hell | bullet-hell | 318 | 1,4% |
| 33 | difficult | difficult | 310 | 1,4% |
| 34 | free-to-play | free-to-play | 310 | 1,4% |
| 35 | funny | funny | 308 | 1,3% |
| 36 | robots | robots | 305 | 1,3% |
| 37 | cyberpunk | cyberpunk | 298 | 1,3% |
| 38 | building | building | 295 | 1,3% |
| 39 | turn-based | turn-based | 293 | 1,3% |
| 40 | shoot 'em up | shoot-em-up | 289 | 1,3% |
| 41 | dark | dark | 288 | 1,3% |
| 42 | space | space | 280 | 1,2% |
| 43 | male protagonist | male-protagonist | 276 | 1,2% |
| 44 | physics | physics | 272 | 1,2% |
| 45 | survival horror | survival-horror | 268 | 1,2% |
| 46 | stylized | stylized | 264 | 1,2% |
| 47 | ai-generated artwork | ai-generated-artwork | 263 | 1,2% |
| 48 | resource management | resource-management | 260 | 1,1% |
| 49 | tower defense | tower-defense | 255 | 1,1% |
| 50 | camera comfort | camera-comfort | 254 | 1,1% |
| 51 | surreal | surreal | 244 | 1,1% |
| 52 | voice acting | voice-acting | 241 | 1,1% |
| 53 | boss fight | boss-fight | 238 | 1,0% |
| 54 | dark fantasy | dark-fantasy | 237 | 1,0% |
| 55 | deliberately retro | deliberately-retro | 237 | 1,0% |
| 56 | gore | gore | 237 | 1,0% |
| 57 | walking simulator | walking-simulator | 237 | 1,0% |
| 58 | bloody | bloody | 235 | 1,0% |
| 59 | base building | base-building | 231 | 1,0% |
| 60 | polygonal 3d | polygonal-3d | 223 | 1,0% |
| 61 | action roguelike | action-roguelike | 220 | 1,0% |
| 62 | detective | detective | 220 | 1,0% |
| 63 | combat | combat | 216 | 0,9% |
| 64 | cat | cat | 214 | 0,9% |
| 65 | choices matter | choices-matter | 214 | 0,9% |
| 66 | side-scrolling | side-scrolling | 214 | 0,9% |
| 67 | zombies | zombies | 209 | 0,9% |
| 68 | online multiplayer | online-multiplayer | 207 | 0,9% |
| 69 | wholesome | wholesome | 207 | 0,9% |
| 70 | lgbtq+ | lgbtq | 205 | 0,9% |
| 71 | character customization | character-customization | 204 | 0,9% |
| 72 | nature | nature | 203 | 0,9% |
| 73 | city builder | city-builder | 201 | 0,9% |
| 74 | cartoony | cartoony | 199 | 0,9% |
| 75 | hidden object | hidden-object | 199 | 0,9% |
| 76 | explosion | explosion | 198 | 0,9% |
| 77 | online | online | 192 | 0,8% |
| 78 | aliens | aliens | 191 | 0,8% |
| 79 | dungeon crawler | dungeon-crawler | 191 | 0,8% |
| 80 | cooking | cooking | 185 | 0,8% |
| 81 | interactive fiction | interactive-fiction | 184 | 0,8% |
| 82 | adjustable difficulty | adjustable-difficulty | 181 | 0,8% |
| 83 | crime | crime | 179 | 0,8% |
| 84 | cats | cats | 178 | 0,8% |
| 85 | crowd funded | crowd-funded | 178 | 0,8% |
| 86 | fast paced | fast-paced | 176 | 0,8% |
| 87 | farming | farming | 171 | 0,7% |
| 88 | puzzle platformer | puzzle-platformer | 168 | 0,7% |
| 89 | death | death | 167 | 0,7% |
| 90 | turn-based combat | turn-based-combat | 167 | 0,7% |
| 91 | pvp | pvp | 166 | 0,7% |
| 92 | music and rhythm | music-and-rhythm | 164 | 0,7% |
| 93 | short | short | 161 | 0,7% |
| 94 | deck-building | deck-building | 160 | 0,7% |
| 95 | emotional | emotional | 160 | 0,7% |
| 96 | life simulation | life-simulation | 160 | 0,7% |
| 97 | bird | bird | 158 | 0,7% |
| 98 | roguelike deckbuilder | roguelike-deckbuilder | 158 | 0,7% |
| 99 | jrpg | jrpg | 156 | 0,7% |
| 100 | permadeath | permadeath | 156 | 0,7% |
| 101 | original soundtrack release | original-soundtrack-release | 153 | 0,7% |
| 102 | twin stick control | twin-stick-control | 152 | 0,7% |
| 103 | collectibles | collectibles | 149 | 0,7% |
| 104 | pop culture reference | pop-culture-reference | 149 | 0,7% |
| 105 | economy | economy | 148 | 0,6% |
| 106 | incremental | incremental | 148 | 0,6% |
| 107 | pre-release public testing | pre-release-public-testing | 148 | 0,6% |
| 108 | investigation | investigation | 143 | 0,6% |
| 109 | violent | violent | 143 | 0,6% |
| 110 | animals | animals | 141 | 0,6% |
| 111 | dystopian | dystopian | 140 | 0,6% |
| 112 | soulslike | soulslike | 138 | 0,6% |
| 113 | online co-op | online-co-op | 137 | 0,6% |
| 114 | 2d platformer | 2d-platformer | 136 | 0,6% |
| 115 | fishing | fishing | 135 | 0,6% |
| 116 | game reference | game-reference | 134 | 0,6% |
| 117 | farming simulator | farming-simulator | 132 | 0,6% |
| 118 | anthropomorphism | anthropomorphism | 131 | 0,6% |
| 119 | lovecraftian | lovecraftian | 131 | 0,6% |
| 120 | narrative | narrative | 131 | 0,6% |
| 121 | difficulty level | difficulty-level | 130 | 0,6% |
| 122 | steampunk | steampunk | 130 | 0,6% |
| 123 | level selection | level-selection | 129 | 0,6% |
| 124 | snow | snow | 129 | 0,6% |
| 125 | unlockables | unlockables | 128 | 0,6% |
| 126 | color alternatives | color-alternatives | 127 | 0,6% |
| 127 | darkness | darkness | 127 | 0,6% |
| 128 | multiple protagonists | multiple-protagonists | 127 | 0,6% |
| 129 | turn-based rpg | turn-based-rpg | 125 | 0,5% |
| 130 | collectathon | collectathon | 124 | 0,5% |
| 131 | high score | high-score | 124 | 0,5% |
| 132 | old school | old-school | 124 | 0,5% |
| 133 | online coop | online-coop | 124 | 0,5% |
| 134 | spaceship | spaceship | 124 | 0,5% |
| 135 | dark humor | dark-humor | 123 | 0,5% |
| 136 | precision platforming | precision-platforming | 122 | 0,5% |
| 137 | mining | mining | 121 | 0,5% |
| 138 | low-poly | low-poly | 120 | 0,5% |
| 139 | 2.5d | 2-5d | 119 | 0,5% |
| 140 | automation | automation | 119 | 0,5% |
| 141 | ghosts | ghosts | 118 | 0,5% |
| 142 | great soundtrack | great-soundtrack | 118 | 0,5% |
| 143 | logic puzzle | logic-puzzle | 118 | 0,5% |
| 144 | pve | pve | 118 | 0,5% |
| 145 | 3d platformer | 3d-platformer | 117 | 0,5% |
| 146 | supernatural | supernatural | 117 | 0,5% |
| 147 | human | human | 115 | 0,5% |
| 148 | platform exclusive | platform-exclusive | 115 | 0,5% |
| 149 | conversation | conversation | 113 | 0,5% |
| 150 | melee | melee | 109 | 0,5% |
| 151 | simulation | simulation | 109 | 0,5% |
| 152 | 4 player co-op | 4-player-co-op | 108 | 0,5% |
| 153 | clicker | clicker | 108 | 0,5% |
| 154 | forest | forest | 108 | 0,5% |
| 155 | level editor | level-editor | 108 | 0,5% |
| 156 | dog | dog | 107 | 0,5% |
| 157 | brawler | brawler | 106 | 0,5% |
| 158 | gamersgate | gamersgate | 106 | 0,5% |
| 159 | leveling up | leveling-up | 106 | 0,5% |
| 160 | resource gathering | resource-gathering | 106 | 0,5% |
| 161 | turn-based tactics | turn-based-tactics | 106 | 0,5% |
| 162 | wizards | wizards | 105 | 0,5% |
| 163 | inventory management | inventory-management | 102 | 0,4% |
| 164 | tactical turn-based combat | tactical-turn-based-combat | 102 | 0,4% |
| 165 | wasd movement | wasd-movement | 102 | 0,4% |
| 166 | pirates | pirates | 101 | 0,4% |
| 167 | story driven | story-driven | 101 | 0,4% |
| 168 | traps | traps | 101 | 0,4% |
| 169 | vampire | vampire | 101 | 0,4% |
| 170 | idler | idler | 100 | 0,4% |
| 171 | indie royale | indie-royale | 100 | 0,4% |
| 172 | minigames | minigames | 100 | 0,4% |
| 173 | upgradeable weapons | upgradeable-weapons | 100 | 0,4% |
| 174 | cinematic | cinematic | 98 | 0,4% |
| 175 | frog | frog | 98 | 0,4% |
| 176 | local multiplayer | local-multiplayer | 97 | 0,4% |
| 177 | non-player character | non-player-character | 97 | 0,4% |
| 178 | demons | demons | 96 | 0,4% |
| 179 | immersive | immersive | 96 | 0,4% |
| 180 | time management | time-management | 96 | 0,4% |
| 181 | nudity | nudity | 95 | 0,4% |
| 182 | 1990s | 1990s | 94 | 0,4% |
| 183 | fangame | fangame | 94 | 0,4% |
| 184 | immersive sim | immersive-sim | 94 | 0,4% |
| 185 | parody | parody | 94 | 0,4% |
| 186 | deckbuilder | deckbuilder | 93 | 0,4% |
| 187 | dinosaurs | dinosaurs | 93 | 0,4% |
| 188 | procedurally generated | procedurally-generated | 93 | 0,4% |
| 189 | shmup | shmup | 93 | 0,4% |
| 190 | bow and arrow | bow-and-arrow | 92 | 0,4% |
| 191 | non-humanoid protagonist | non-humanoid-protagonist | 92 | 0,4% |
| 192 | time travel | time-travel | 92 | 0,4% |
| 193 | futuristic | futuristic | 91 | 0,4% |
| 194 | teleportation | teleportation | 91 | 0,4% |
| 195 | retail games with steam activation | retail-games-with-steam-activation | 90 | 0,4% |
| 196 | voxel | voxel | 90 | 0,4% |
| 197 | breaking the fourth wall | breaking-the-fourth-wall | 89 | 0,4% |
| 198 | ai-generated marketing | ai-generated-marketing | 88 | 0,4% |
| 199 | parkour | parkour | 88 | 0,4% |
| 200 | treasure chest | treasure-chest | 88 | 0,4% |
| 201 | colony simulator | colony-simulator | 87 | 0,4% |
| 202 | day/night cycle | day-night-cycle | 87 | 0,4% |
| 203 | narration | narration | 87 | 0,4% |
| 204 | speedrun | speedrun | 87 | 0,4% |
| 205 | creature collector | creature-collector | 86 | 0,4% |
| 206 | driving | driving | 86 | 0,4% |
| 207 | flight | flight | 86 | 0,4% |
| 208 | minimalist | minimalist | 86 | 0,4% |
| 209 | shopping | shopping | 86 | 0,4% |
| 210 | freeware | freeware | 85 | 0,4% |
| 211 | touch controls | touch-controls | 85 | 0,4% |
| 212 | japan | japan | 84 | 0,4% |
| 213 | hacking | hacking | 83 | 0,4% |
| 214 | indie developer | indie-developer | 83 | 0,4% |
| 215 | underwater | underwater | 83 | 0,4% |
| 216 | 1980s | 1980s | 82 | 0,4% |
| 217 | adjustable text size | adjustable-text-size | 82 | 0,4% |
| 218 | mythology | mythology | 82 | 0,4% |
| 219 | dating simulation | dating-simulation | 80 | 0,4% |
| 220 | incremental game | incremental-game | 80 | 0,4% |
| 221 | monsters | monsters | 80 | 0,4% |
| 222 | noir | noir | 80 | 0,4% |
| 223 | realism | realism | 80 | 0,4% |
| 224 | ai-generated music | ai-generated-music | 79 | 0,3% |
| 225 | ai-generated translations | ai-generated-translations | 79 | 0,3% |
| 226 | cross-platform multiplayer | cross-platform-multiplayer | 79 | 0,3% |
| 227 | sequel | sequel | 79 | 0,3% |
| 228 | ai-generated voices | ai-generated-voices | 78 | 0,3% |
| 229 | vr only | vr-only | 78 | 0,3% |
| 230 | grid-based movement | grid-based-movement | 77 | 0,3% |
| 231 | mech | mech | 77 | 0,3% |
| 232 | top-down | top-down | 77 | 0,3% |
| 233 | war | war | 77 | 0,3% |
| 234 | idle | idle | 75 | 0,3% |
| 235 | martial arts | martial-arts | 75 | 0,3% |
| 236 | ninja | ninja | 74 | 0,3% |
| 237 | psychedelic | psychedelic | 74 | 0,3% |
| 238 | animal protagonist | animal-protagonist | 73 | 0,3% |
| 239 | real-time combat | real-time-combat | 73 | 0,3% |
| 240 | rpg elements | rpg-elements | 73 | 0,3% |
| 241 | time manipulation | time-manipulation | 73 | 0,3% |
| 242 | gothic | gothic | 72 | 0,3% |
| 243 | idle game | idle-game | 72 | 0,3% |
| 244 | time limit | time-limit | 72 | 0,3% |
| 245 | arena shooter | arena-shooter | 71 | 0,3% |
| 246 | artificial intelligence | artificial-intelligence | 71 | 0,3% |
| 247 | choose your own adventure | choose-your-own-adventure | 71 | 0,3% |
| 248 | countdown timer | countdown-timer | 71 | 0,3% |
| 249 | customization | customization | 71 | 0,3% |
| 250 | food | food | 71 | 0,3% |
| 251 | non-linear | non-linear | 71 | 0,3% |
| 252 | otome | otome | 71 | 0,3% |
| 253 | rabbit | rabbit | 71 | 0,3% |
| 254 | secret area | secret-area | 71 | 0,3% |
| 255 | dice | dice | 69 | 0,3% |
| 256 | casual game | casual-game | 68 | 0,3% |
| 257 | job simulator | job-simulator | 68 | 0,3% |
| 258 | experimental | experimental | 67 | 0,3% |
| 259 | fairy | fairy | 66 | 0,3% |
| 260 | narrative-driven | narrative-driven | 66 | 0,3% |
| 261 | spider | spider | 66 | 0,3% |
| 262 | capitalism | capitalism | 65 | 0,3% |
| 263 | modern military | modern-military | 65 | 0,3% |
| 264 | touhou project | touhou-project | 65 | 0,3% |
| 265 | upgrades | upgrades | 65 | 0,3% |
| 266 | dialogue trees | dialogue-trees | 64 | 0,3% |
| 267 | environmental puzzles | environmental-puzzles | 64 | 0,3% |
| 268 | modern warfare | modern-warfare | 64 | 0,3% |
| 269 | skeletons | skeletons | 64 | 0,3% |
| 270 | text adventure | text-adventure | 64 | 0,3% |
| 271 | vehicular combat | vehicular-combat | 64 | 0,3% |
| 272 | battle | battle | 63 | 0,3% |
| 273 | customizable characters | customizable-characters | 63 | 0,3% |
| 274 | organizing | organizing | 63 | 0,3% |
| 275 | doujin game | doujin-game | 62 | 0,3% |
| 276 | downloadable content | downloadable-content | 62 | 0,3% |
| 277 | bullet heaven | bullet-heaven | 61 | 0,3% |
| 278 | camera | camera | 61 | 0,3% |
| 279 | in-game map editor | in-game-map-editor | 61 | 0,3% |
| 280 | tycoon | tycoon | 61 | 0,3% |
| 281 | undead | undead | 61 | 0,3% |
| 282 | internet culture reference | internet-culture-reference | 60 | 0,3% |
| 283 | magical girl | magical-girl | 60 | 0,3% |
| 284 | psychological | psychological | 60 | 0,3% |
| 285 | realistic | realistic | 60 | 0,3% |
| 286 | sidescroller | sidescroller | 60 | 0,3% |
| 287 | skill tree | skill-tree | 60 | 0,3% |
| 288 | underwater gameplay | underwater-gameplay | 60 | 0,3% |
| 289 | abstract art style | abstract-art-style | 59 | 0,3% |
| 290 | boomer shooter | boomer-shooter | 59 | 0,3% |
| 291 | linear | linear | 59 | 0,3% |
| 292 | military | military | 59 | 0,3% |
| 293 | moral decisions | moral-decisions | 59 | 0,3% |
| 294 | survival mode | survival-mode | 59 | 0,3% |
| 295 | world war ii - ww2 | world-war-ii-ww2 | 59 | 0,3% |
| 296 | auto battler | auto-battler | 58 | 0,3% |
| 297 | checkpoints | checkpoints | 58 | 0,3% |
| 298 | games with gold | games-with-gold | 58 | 0,3% |
| 299 | loot gathering | loot-gathering | 58 | 0,3% |
| 300 | minimalism | minimalism | 58 | 0,3% |

## 2. Rascunho da taxonomia (para revisão)

São 49 estilos em três categorias, depois da revisão do autor (50 na primeira rodada). Ficaram de fora:
- **cultura e lugar**, que são das coleções;
- **estilos que repetiriam um gênero ou tema da IGDB:** Visual Novel, Music, Tactical, Comedy, Warfare, Stealth, Mystery, Romance, Survival, Sandbox.

A última coluna traz a frequência medida (seção 3). Nenhum estilo ficou abaixo de 3 jogos nem
acima do limite de 40% dos interesses.

### Estrutura e jogabilidade (26)

| Estilo | Palavras-chave da IGDB (slug) | Termos do resumo | Jogos: palavras-chave · resumo · as duas |
| --- | --- | --- | --- |
| **Roguelike** | roguelike, roguelite, action-roguelike, action-roguelite, traditional-roguelike, roguelike-platform, roguelike-horror | "roguelike", "roguelite", "rogue-like", "rogue-lite", "roguelikes" | 1381 (6,1%) · 1732 (7,6%) · 2181 (9,6%) |
| **Metroidvania** | metroidvania, metroid, cozy-metroidvania | "metroidvania", "metroidvanias", "metroid-like" | 435 (1,9%) · 270 (1,2%) · 523 (2,3%) |
| **Soulslike** | soulslike, souls | "soulslike", "souls-like", "soulslite", "souls-lite" | 140 (0,6%) · 72 (0,3%) · 181 (0,8%) |
| **Construção de baralho** | deck-building, roguelike-deckbuilder, deckbuilder, deckbuilding | "deckbuilder", "deck-builder", "deckbuilding", "deck-building", "deck building", "deck builder" | 324 (1,4%) · 326 (1,4%) · 444 (1,9%) |
| **Bullet hell e shoot 'em up** | bullet-hell, shoot-em-up, shmup, manic-shooter, retro-arcade-shooter, horizontal-shooter, bullet-grazing | "bullet hell", "bullet-hell", "shmup", "shoot 'em up", "shoot-'em-up", "shoot em up", "danmaku" | 557 (2,4%) · 230 (1,0%) · 646 (2,8%) |
| **Sobrevivência contra hordas** | bullet-heaven, horde-survival, auto-shooter, vampire-survivors | "bullet heaven", "survivors-like", "survivor-like", "survivorslike", "horde survival", "horde-survival" | 77 (0,3%) · 69 (0,3%) · 122 (0,5%) |
| **Tower defense** | tower-defense, tower-offense | "tower defense", "tower defence", "tower-defense" | 255 (1,1%) · 252 (1,1%) · 353 (1,5%) |
| **Construção de cidades e colônias** | city-builder, city-building, colony-simulator, colony-builder, colony-simulation, colony, god-game | "city builder", "city-builder", "city building", "city-building", "colony sim", "colony simulator", "colony builder", "colony management", "god game" | 285 (1,2%) · 179 (0,8%) · 370 (1,6%) |
| **Automação e fábricas** | automation, factory, factory-simulation, conveyor-belt | "conveyor belt", "conveyor belts", "production lines", "factory builder", "factory-building" | 158 (0,7%) · 51 (0,2%) · 191 (0,8%) |
| **Gestão de negócios** | tycoon, business-simulation, management-sim, store-management, shop-management, shop-keeper, sports-manager | "tycoon", "business sim", "business simulation", "management sim", "shopkeeper", "run your own shop" | 160 (0,7%) · 168 (0,7%) · 289 (1,3%) |
| **Fazenda e vida no campo** | farming, farming-simulator, farm, agriculture, life-simulation, life-sim | "farm sim", "farming sim", "farming simulator", "life sim", "life simulation", "life simulator", "grow crops", "harvest crops", "farm life", "farming game" | 405 (1,8%) · 152 (0,7%) · 486 (2,1%) |
| **Coleta e construção** | base-building, open-world-survival-craft, crafting-survival | "survival crafting", "survival-crafting", "crafting survival", "survival craft", "base building", "base-building" | 266 (1,2%) · 100 (0,4%) · 338 (1,5%) |
| **Incremental e idle** | idler, idle, idle-game, incremental, incremental-game, clicker, clicker-game, semi-active-idle | "idle game", "incremental game", "clicker game", "idle clicker", "idler" | 331 (1,5%) · 174 (0,8%) · 388 (1,7%) |
| **Plataforma de precisão** | precision-platforming, precision-platformer | "precision platformer", "precision platforming", "precision-platformer" | 133 (0,6%) · 54 (0,2%) · 166 (0,7%) |
| **Lógica e sokoban** | logic-puzzle, sokoban, sokoban-like, grid-based-puzzles, block-puzzle, sliding-puzzle, picture-based-logic-puzzle | "sokoban", "logic puzzle", "logic puzzles", "nonogram", "nonograms", "picross", "block-pushing", "box-pushing" | 183 (0,8%) · 68 (0,3%) · 221 (1,0%) |
| **Objetos escondidos e salas de fuga** | hidden-object, escape-room | "hidden object", "hidden-object", "hidden objects", "escape room", "escape-room" | 251 (1,1%) · 139 (0,6%) · 314 (1,4%) |
| **Investigação e detetive** | detective, private-detective, detective-mystery, detective-investigation, investigation, investigations, crime-solving, murder-mystery | "detective", "murder mystery", "whodunit", "solve the case", "crime scene" | 352 (1,5%) · 269 (1,2%) · 505 (2,2%) |
| **Simulador de caminhada** | walking-simulator | "walking simulator", "walking sim" | 237 (1,0%) · 30 (0,1%) · 255 (1,1%) |
| **Narrativa com escolhas** | choices-matter, meaningful-choices, choice-matters, choice-and-consequence, branching-storyline, branching-narrative, multiple-endings, moral-decisions, interactive-fiction, choose-your-own-adventure, text-adventure, text-based-adventure | "multiple endings", "choices matter", "branching story", "branching storyline", "branching narrative", "interactive fiction", "text adventure", "choose your own adventure", "choose-your-own-adventure" | 856 (3,8%) · 138 (0,6%) · 948 (4,2%) |
| **Immersive sim** | immersive-sim | "immersive sim", "immersive-sim" | 94 (0,4%) · 26 (0,1%) · 106 (0,5%) |
| **Exploração de masmorras** | dungeon-crawler, dungeon-crawling, randomly-generated-dungeons, mystery-dungeon | "dungeon crawler", "dungeon-crawler", "dungeon crawling", "dungeon-crawling", "dungeon crawl" | 254 (1,1%) · 235 (1,0%) · 400 (1,8%) |
| **Coleta de criaturas** | creature-collector, creature-collection, monster-tamer, monster-catching, creature-compendium | "monster tamer", "monster-taming", "monster taming", "creature collector", "creature-collecting", "creature collecting" | 125 (0,5%) · 40 (0,2%) · 145 (0,6%) |
| **Tiro retrô em primeira pessoa** | boomer-shooter, movement-shooter | "boomer shooter", "retro fps", "retro shooter", "old-school fps" | 70 (0,3%) · 54 (0,2%) · 105 (0,5%) |
| **Simulador de namoro e otome** | dating-simulation, dating, dating-sim, otome | "dating sim", "dating simulator", "otome" | 171 (0,7%) · 80 (0,4%) · 206 (0,9%) |
| **Culinária** | cooking-simulation, restaurant-management | "cooking game", "cooking sim", "cooking simulator", "restaurant sim", "restaurant management", "run your own restaurant" | 31 (0,1%) · 54 (0,2%) · 77 (0,3%) |
| **Loops e viagem no tempo** | time-loop, time-travel, time-manipulation | "time loop", "time-loop", "time travel", "time-travel", "rewind time", "time manipulation" | 165 (0,7%) · 93 (0,4%) · 223 (1,0%) |

### Tom e atmosfera (8)

| Estilo | Palavras-chave da IGDB (slug) | Termos do resumo | Jogos: palavras-chave · resumo · as duas |
| --- | --- | --- | --- |
| **Aconchegante** | cozy, cozy-adventure, wholesome, relaxing, relaxed | "cozy", "cosy", "wholesome" | 841 (3,7%) · 624 (2,7%) · 1179 (5,2%) |
| **Terror psicológico** | psychological-horror, psychological-thriller, psychological, psychological-trauma | "psychological horror", "psychological thriller" | 542 (2,4%) · 322 (1,4%) · 735 (3,2%) |
| **Terror de sobrevivência** | survival-horror, first-person-horror, asymmetrical-survival-horror, jump-scare-moment | "survival horror", "survival-horror" | 340 (1,5%) · 365 (1,6%) · 594 (2,6%) |
| **Terror cósmico** | lovecraftian, h-p-lovecraft, cosmic-horror, eldritch-horror | "lovecraftian", "lovecraft", "eldritch horror", "eldritch horrors", "cosmic horror" | 169 (0,7%) · 117 (0,5%) · 230 (1,0%) |
| **Terror analógico e liminar** | analog-horror, liminal-space, vhs, found-footage, creepypasta, mascot-horror | "analog horror", "liminal space", "liminal spaces", "found footage", "backrooms", "creepypasta" | 106 (0,5%) · 80 (0,4%) · 166 (0,7%) |
| **Surreal e psicodélico** | surreal, surrealism, surreal-horror, surreal-comedy, psychedelic, dreams | "surreal", "surrealist", "psychedelic", "dreamlike", "dream-like" | 370 (1,6%) · 296 (1,3%) · 589 (2,6%) |
| **Emotivo** | emotional, emotional-narrative, emotional-story | "heartfelt story", "heartfelt narrative", "heartwarming", "heart-warming", "emotional", "touching story", "bittersweet" | 162 (0,7%) · 151 (0,7%) · 295 (1,3%) |
| **Humor ácido e paródia** | dark-humor, dark-comedy, parody, satire, absurdist-comedy, surreal-comedy, self-referential-humor, absurd | "dark humor", "dark humour", "dark comedy", "satire", "satirical", "parody", "absurdist" | 333 (1,5%) · 94 (0,4%) · 395 (1,7%) |

### Ambientação (15)

| Estilo | Palavras-chave da IGDB (slug) | Termos do resumo | Jogos: palavras-chave · resumo · as duas |
| --- | --- | --- | --- |
| **Pós-apocalíptico** | post-apocalyptic, apocalypse, apocalyptic, postapocalyptic, zombie-apocalypse | "post-apocalyptic", "postapocalyptic", "post apocalyptic" | 379 (1,7%) · 229 (1,0%) · 517 (2,3%) |
| **Zumbis** | zombies, zombie, zombie-shooter, zombie-survival, zombie-apocalypse, zombie-virus, nazi-zombies | "zombie", "zombies" | 228 (1,0%) · 268 (1,2%) · 389 (1,7%) |
| **Cyberpunk** | cyberpunk, cyberpunk-rpg, cybernetics, cyberspace, tech-noir | "cyberpunk", "cyber-punk" | 310 (1,4%) · 171 (0,7%) · 379 (1,7%) |
| **Steampunk** | steampunk | "steampunk", "dieselpunk" | 130 (0,6%) · 76 (0,3%) · 172 (0,8%) |
| **Distopia** | dystopian, dystopian-future | "dystopian", "dystopia", "totalitarian" | 145 (0,6%) · 142 (0,6%) · 253 (1,1%) |
| **Espaço e naves** | spaceship, spaceships, space-ship, space-ships, starship, space-simulation, space-combat, space-battle, space-exploration, space-mining, space-strategy, spaceship-customization, space-adventure, space-shooter, space-station, space-travel, astronaut | "spaceship", "spaceships", "starship", "starships", "space station", "outer space", "space exploration", "space travel", "astronaut", "astronauts" | 284 (1,2%) · 370 (1,6%) · 581 (2,5%) |
| **Medieval** | medieval, medieval-fantasy | "medieval" | 389 (1,7%) · 270 (1,2%) · 556 (2,4%) |
| **Fantasia sombria e gótico** | dark-fantasy, dark-fantasy-adventure, gothic, gothic-horror, gothic-adventure, gothic-mystery | "dark fantasy", "gothic", "grimdark" | 287 (1,3%) · 199 (0,9%) · 412 (1,8%) |
| **Magia e bruxaria** | witches, witch, witch-hunter, wizards, wizardry, spellcaster, spell-caster, spells, magic-school, necromancy, sword-sorcery, battle-mage, mages | "witchcraft", "witch", "witches", "wizard", "wizards", "sorcery", "sorcerer", "sorceress", "spellcasting", "spellcaster", "necromancer", "necromancy", "warlock" | 223 (1,0%) · 367 (1,6%) · 537 (2,4%) |
| **Sobrenatural: fantasmas, demônios e vampiros** | supernatural, ghosts, ghost, ghost-hunting, ghost-hunter, ghostbusting, demons, demon, demon-hunter, vampire, vampires, vampire-hunter, dracula, occult, cult | "haunted house", "haunted mansion", "paranormal", "occult", "ghosts", "vampires", "dracula" | 468 (2,1%) · 308 (1,3%) · 711 (3,1%) |
| **Robôs e mechas** | robot-protagonist, robot-combat, mech, mecha, mechs | "mech", "mechs", "mecha", "giant robot", "giant robots", "play as a robot" | 149 (0,7%) · 140 (0,6%) · 231 (1,0%) |
| **Alienígenas** | aliens, alien, alien-invasion, alien-world, alien-protagonist, alien-abduction, ufo | "aliens", "alien invasion", "extraterrestrial", "extraterrestrials", "ufo" | 243 (1,1%) · 195 (0,9%) · 390 (1,7%) |
| **Piratas** | pirates, pirate, undead-pirates | "pirate", "pirates" | 107 (0,5%) · 165 (0,7%) · 211 (0,9%) |
| **Crime e noir** | organized-crime, mafia, heist, noir, film-noir, neo-noir | "noir", "heist", "mafia", "gangster", "gangsters" | 121 (0,5%) · 154 (0,7%) · 235 (1,0%) |
| **Fundo do mar** | underwater, ocean-exploration, deep-sea, sea-monster | "underwater world", "underwater exploration", "deep sea", "ocean floor", "ocean depths" | 92 (0,4%) · 28 (0,1%) · 113 (0,5%) |

### Revisão do autor (03/11/2026)

Decisões do autor:
- **Palavras-chave de presença não valem como evidência sozinhas.** "cat", "dog", "magic" e "space" dizem que o elemento aparece, não que o jogo é sobre ele.
- **"Protagonista animal" saiu:** dependia quase só de "cat" e "dog".
- **"Magia e bruxaria" e "Espaço e naves" ficam só com palavras-chave e termos específicos.**
  - Magia: witches, witch, witch-hunter, wizards, wizardry, spellcaster, spell-caster, spells, magic-school, necromancy, sword-sorcery, battle-mage e mages; no resumo, witchcraft, witch, witches, wizard, wizards, sorcery, sorcerer, sorceress, spellcasting, spellcaster, necromancer, necromancy e warlock. Saíram magic, magician e alchemy.
  - Espaço: as palavras-chave de naves, estação, viagem e exploração espacial, e astronaut; no resumo, spaceship(s), starship(s), space station, outer space, space exploration, space travel e astronaut(s). Saiu space.
- **"Sobrenatural" fica junto por enquanto.** A separação em fantasmas, demônios e vampiros será revista depois do teste de usabilidade (B-44).
- **"Emocionante" virou "Emotivo":** o estilo vem de "emotional", e "emocionante" quer dizer empolgante.
- **Os termos que erraram na amostra saíram:** "farming" e "wasteland".

Pelo mesmo critério, foram conferidos todos os termos do resumo. Para cada termo, contei quantos jogos ele marca sem a palavra-chave e li três trechos sorteados.

**Palavras-chave de presença** que saíram também de outros estilos:

| Estilo | Saiu | Por quê |
| --- | --- | --- |
| Robôs e mechas | robots, robot | presença; ficaram robot-protagonist, robot-combat, mech, mecha e mechs |
| Crime e noir | crime | presença |
| Culinária | cooking, restaurant | presença: cozinhar é atividade em jogos de sobrevivência; ficaram cooking-simulation e restaurant-management |
| Coleta e construção | crafting, resource-gathering | presença em quase todo RPG; ficaram base-building e as de sobrevivência com construção |
| Medieval | knights | presença |
| Fundo do mar | underwater-gameplay, ocean | presença de uma fase subaquática |
| Tiro retrô em primeira pessoa | arena-shooter | inclui shooters em visão de cima |

**Termos do resumo** que saíram ou ficaram mais exatos:

| Termo | Exemplo do problema | Ficou |
| --- | --- | --- |
| apocalypse | "prevent the apocalypse" em fantasia | só post-apocalyptic e variantes |
| incremental | "incremental power curve" num roguelite | incremental game |
| automate, automation | "increasing automation" num jogo de cartas | conveyor belt(s), production lines, factory builder |
| relaxing | "may seem relaxing... in fact danger" | cozy, cosy, wholesome |
| haunted | "haunted by rent" | haunted house, haunted mansion |
| supernatural | "supernatural abilities" num jogo de ação | paranormal, occult, ghosts |
| demonic | "demonic monsters" como inimigos | — |
| vampire | "inspired by Vampire Survivors" | vampires, dracula |
| heartfelt | "heartfelt tribute to the racing games" | heartfelt story, heartfelt narrative |
| liminal | "this liminal world" num minigame | liminal space(s), backrooms |
| eldritch | "the eldritch cutie" num jogo de namoro | eldritch horror(s), lovecraftian |
| arena shooter | "twin stick arena shooter" | boomer shooter, retro fps |
| robot, robots | "fly your DiscPod robot" | mech(s), mecha, giant robot(s) |
| cooking, crafting, gather resources | "farming, hunting, cooking, crafting" numa lista de atividades | cooking game, survival crafting, base building |

Ficaram, por serem quase sempre o assunto do jogo quando aparecem no resumo: witch, wizard, aliens, zombie(s), pirate(s), ghosts, cozy e emotional. Erros isolados continuam possíveis, como "Choose witch end", erro de digitação de "which".

**Pontos que continuam para o B-74 e depois:**
- **Junções a observar:** "Objetos escondidos e salas de fuga", "Fazenda e vida no campo" e "Robôs e mechas" juntam públicos próximos, mas não iguais.
- **Culinária ficou pequena:** 77 jogos (0,3%), mas acima do mínimo de 3.
- **Estilos maiores:** Roguelike (9,6%), Aconchegante (5,2%) e Narrativa com escolhas (4,2%), todos longe do limite de 40%.

### Palavras-chave frequentes que ficaram de fora

| Motivo | Palavras-chave (jogos) |
| --- | --- |
| Estilo visual, não tipo de jogo (poderia virar uma quarta categoria, "visual") | 2d (1.100), pixel graphics (781), 3d (738), pixel art (726), retro (631), anime (558), colorful (472), hand-drawn (395), abstract (354), stylized (264), deliberately retro (237), polygonal 3d (223), cartoony (199), low-poly (120), 2.5d (119), voxel (90), minimalist (86) |
| Genéricas demais: aparecem em quase todo tipo de jogo | casual (1.139), exploration (945), atmospheric (833), story rich (713), cute (750), difficult (310), combat (216), boss fight (238), physics (272), dark (288), funny (308), building (295), management (461), turn-based (293) |
| Modo de jogo e controle, que o B-62 trata | single-player only (487), online multiplayer (207), pvp (166), online co-op (137), 4 player co-op (108), local multiplayer (97), twin stick control (152), camera comfort (254), touch controls (85) |
| Representação e protagonista, que pode ser filtro, mas não é estilo | female protagonist (918), male protagonist (276), lgbtq+ (205), multiple protagonists (127), young protagonist (47) |
| Metadados de distribuição, produção e IA (candidatas à lista de exclusões do TF-IDF) | free-to-play (310), ai-generated artwork (263), crowd funded (178), original soundtrack release (153), pre-release public testing (148), platform exclusive (115), gamersgate (106), indie royale (100), retail games with steam activation (90), ai-generated marketing (88), freeware (85), ai-generated music (79), sequel (79), fangame (94), touhou project (65), doujin game (62), games with gold (58) |
| Repetem um gênero ou tema da IGDB | action-adventure (500), music and rhythm (164), turn-based tactics (106), simulation (109), puzzle platformer (168), 2d platformer (136), 3d platformer (117), jrpg (156) |
| Cultura, lugar e história (são das coleções, ou dos temas Historical e Warfare) | japan (84), mythology (82, e as variantes grega, nórdica, egípcia), western (57), world war ii (59), cold war (33), folklore (32), 1990s (94), 1980s (82) |
| Descritores de conteúdo, da classificação etária | gore (237), bloody (235), violent (143), nudity (95), extreme violence (43), sexual content (47) |
| Animais e objetos avulsos, que não dizem o tipo de jogo | bird (158), frog (98), rabbit (71), food (71), snow (129), forest (108), explosion (198), death (167) |
| Pequenas, com cerca de 100 jogos, que podem entrar se o autor quiser | auto battler (58 + autobattler 44), fishing (135), dinosaurs (93), mythology (82), procedural generation (329, técnica), permadeath (156, aparece em roguelikes e em jogos de sobrevivência) |

## 3. Cobertura

### No catálogo

| Versão | Jogos com ao menos um estilo | Mediana de estilos por jogo | Mediana entre os cobertos |
| --- | --- | --- | --- |
| Só palavras-chave | 8559 (37,5%) | 0 | 1 |
| Só resumo | 8094 (35,5%) | 0 | 1 |
| As duas | 12200 (53,5%) | 1 | 1 |

A mediana de estilos por jogo é 1 com as duas fontes. Entre os jogos cobertos, a mediana também
é 1: o estilo é um rótulo, não uma descrição completa.

### Nos recortes de vetor pobre

| Recorte | Jogos | Só palavras-chave | Só resumo | As duas |
| --- | --- | --- | --- | --- |
| Vetor idêntico ao de pelo menos 10 outros jogos | 4844 (21,2%) | 0 (0,0%) | 1530 (31,6%) | 1530 (31,6%) |
| Até 2 etiquetas no vetor | 3942 (17,3%) | 58 (1,5%) | 1177 (29,9%) | 1201 (30,5%) |
| Só Aventura e Ação no vetor | 507 (2,2%) | 0 (0,0%) | 152 (30,0%) | 152 (30,0%) |

As palavras-chave não ajudam nesses recortes: um jogo com vetor idêntico ao de muitos outros
quase nunca tem palavra-chave. É o resumo que alcança cerca de 30% deles. Para os jogos que a
recomendação por conteúdo hoje não distingue, a única fonte nova de especificidade é o texto.

### Nos perfis de teste (semente 71)

| Versão | Com ao menos um estilo |
| --- | --- |
| Só palavras-chave | 223 (37,2%) |
| Só resumo | 207 (34,5%) |
| As duas | 316 (52,7%) |

## 4. Precisão dos termos do resumo

Com a taxonomia revisada, 5.029 jogos recebem ao menos um estilo só pelo resumo, sem a
palavra-chave correspondente. Foram sorteados 20 (semente 73). A classificação é preliminar,
para revisão do autor.

| # | Jogo | Estilo | Termo | Trecho | Classificação preliminar |
| --- | --- | --- | --- | --- | --- |
| 1 | Pirate Pillage and Plunder | Roguelike | roguelike | …d of card game and auto battler, wrapped together in a neat roguelike package. Choose your faction, amass an army from thousands… | Correto: "neat roguelike package" |
| 2 | Imscared | Surreal e psicodélico | surreal | …game that protagonizes the player, putting him or her in a surreal first-person experience. Find keys, open doors and search f… | Correto: "surreal first-person experience" |
| 3 | Deliverance | Terror de sobrevivência | survival horror | Deliverance is a first-person survival horror game in which you are put into the captivity of a deranged… | Correto: terror de sobrevivência em primeira pessoa |
| 4 | Super Star Path | Alienígenas | aliens | …Hop into your spaceship, open a path through huge waves of aliens and other hazards, and face intense boss battles! | Correto: nave contra ondas de alienígenas |
| 5 | Himbo Harem Homicide | Investigação e detetive | whodunit | A classic whodunit—but with a harem of himbos! Determine which of your hunky h… | Correto: "a classic whodunit" |
| 6 | Princess.Loot.Pixel.Again | Roguelike | rogue-lite | …a combo system and special strikes, there is also a bit of rogue-lite genre. The principal aim is to get through all floors of th… | Correto, fraco: "a bit of rogue-lite genre": o elemento é secundário |
| 7 | Star Crafter | Coleta e construção | survival crafting | A space survival crafting mining base building and star system building game. Craft r… | Correto: "space survival crafting" |
| 8 | Mousebusters | Sobrenatural: fantasmas, demônios e vampiros | ghosts | …themselves having to join the Mousebusters to take out the ghosts haunting every resident of the building. | Correto: caçar os fantasmas do prédio |
| 9 | Ignite the Depths | Exploração de masmorras | dungeon crawler | Ignite the Depths is a cooperative hack-and-slash dungeon crawler set across three hand-crafted dimensions. Venture into the… | Correto: "hack-and-slash dungeon crawler" |
| 10 | Blackwind | Alienígenas | alien invasion | …ager trapped inside a prototype battle armor suit during an alien invasion. Face off against enemies, cut through their ranks, and fig… | Correto: passa-se durante uma invasão alienígena |
| 11 | There Are No Orcs | Roguelike | roguelike | An RTS-Roguelike hybrid with auto-battling troops. Master building placement… | Correto: "RTS-Roguelike hybrid" |
| 12 | Ib | Terror psicológico | psychological horror | Ib is a freeware adventure video game with elements of psychological horror released in 2012 for Microsoft Windows by the Japanese arti… | Correto: "elements of psychological horror" |
| 13 | Mr. Grin's Final Act | Terror de sobrevivência | survival horror | …Now you're back... and so is Mr. Grin. In this first-person survival horror, scavenge badges, rewire circuits, crack safes. Stay out of… | Correto: "first-person survival horror" |
| 14 | Hell is Other Demons | Bullet hell e shoot 'em up | bullet hell | …is Other Demons is a frantic, highscore driven, four-color, Bullet Hell Platformer with pixel art. | Correto: "Bullet Hell Platformer" |
| 15 | This Strange Realm of Mine | Terror psicológico | psychological horror | …alm Of Mine is a First Person Shooter mixed with poetry and psychological horror. Graphic style is 3D mixed with pixel art. | Correto: "poetry and psychological horror" |
| 16 | Wilderings: The Lost Spring | Metroidvania | metroidvania | …an open-world action roguelite with creature collection and metroidvania-like progression that tells an emotionally impactful story… | Correto: "metroidvania-like progression" |
| 17 | Kadomon: Hyper Auto Battlers | Roguelike | roguelike | Collect and battle over 180 unique creatures in this roguelike auto-battler. Level-up and evolve your Kādomon as you assem… | Correto: "roguelike auto-battler" |
| 18 | Savior Syndrome: The Crimson Sun | Sobrenatural: fantasmas, demônios e vampiros | occult | …d RPG set in a world where genetic experiments coexist with occult practices. | Correto, fraco: "occult practices" num mundo de ficção científica |
| 19 | Remote Life 2: Fearless | Alienígenas | aliens | …a sci-fi an action packed platformer. Combat against scary aliens and escape from the monster Hive. After the success of the… | Correto: combate contra alienígenas |
| 20 | The Citadel Project | Fantasia sombria e gótico | dark fantasy | …-horror elements, inspired by the Thief series and set in a dark fantasy world. Use your tools and surroundings wisely, stay hidden… | Correto: "set in a dark fantasy world" |

**Resultado:** 20 corretos, 2 com evidência fraca (um "pouco" de roguelite; práticas ocultas
num mundo de ficção científica).

**Primeira rodada**, antes da revisão (5.932 jogos, mesma semente): 17 corretos, 1 duvidoso e 2
incorretos, de 85% a 90%.
- Os erros foram CryoFall ("farming", plantar como uma atividade entre várias) e Pyre ("wasteland", um lugar ermo num mundo de fantasia).
- O duvidoso foi DiscPods ("robot", o veículo de uma arena).
- Os três termos saíram na revisão.

A amostra cobre só o resumo. Na curadoria, vale amostrar também as palavras-chave de presença
(seção 2, "Pontos para revisar").

## 5. Estilos na escolha dos interesses e o desempate

### Como os estilos entrariam

Os estilos seriam candidatos a interesse ao lado dos gêneros e temas, com a mesma escolha
gulosa do B-71:
- **Itens a cobrir:** os jogos de peso positivo da biblioteca e as preferências. Cada jogo contém os atributos do vetor e os estilos dele.
- **Candidatura:** um estilo concorre se a soma dos pesos dos jogos da biblioteca que o têm, inclusive os de nota baixa, for positiva, o equivalente ao `u_k > 0` dos gêneros e temas. Vale também o limite de 40% do catálogo, sobre a frequência do estilo.
- **Prateleira e chave:** a prateleira seria "Porque você curte `<estilo>`", com a chave `style:<slug>`.

### O desempate decide a maior parte das escolhas

Hoje o empate na cobertura é resolvido pelo maior `u_k`. Isso favorece os gêneros, pela fatia de
40% do vetor contra 30% dos temas. No caso da conferência do B-71, Quebra-cabeça (17,8% do
catálogo) venceu Terror (13,5%) para cobrir Amnesia, o único jogo de terror que o RPG não
cobria.

Além do desempate por `u_k`, foram medidos dois outros desempates nos 200 perfis, com e sem
estilos:
- **pelo menos frequente no catálogo** (o mais específico), depois pelo `u_k`;
- **pelo peso na biblioteca:** a soma dos pesos dos jogos de peso positivo que têm o atributo, inclusive os já cobertos; depois, pelo menos frequente.

| Cenário | Perfis com 0 / 1 / 2 / 3 / 4 interesses | Interesses | Escolhas com empate na cobertura | Interesses que são estilos | Jogos com peso positivo cobertos |
| --- | --- | --- | --- | --- | --- |
| A. Gêneros e temas, desempate por u_k (atual) | 0 / 22 / 129 / 49 / 0 | 427 | 256 | 0 | 556 (92,7%) |
| B. Gêneros e temas, pelo menos frequente | 0 / 22 / 129 / 49 / 0 | 427 | 237 | 0 | 556 (92,7%) |
| E. Gêneros e temas, pelo peso na biblioteca | 0 / 22 / 129 / 49 / 0 | 427 | 237 | 0 | 556 (92,7%) |
| C. Com estilos, desempate por u_k | 0 / 19 / 129 / 52 / 0 | 433 | 289 | 27 | 567 (94,5%) |
| D. Com estilos, pelo menos frequente | 0 / 19 / 129 / 52 / 0 | 433 | 280 | 159 | 567 (94,5%) |
| F. Com estilos, pelo peso na biblioteca | 0 / 19 / 129 / 52 / 0 | 433 | 280 | 143 | 567 (94,5%) |

- A → B: 106 perfis mudam, 172 escolhas mudam de atributo ou de posição.
- A → E: 98 perfis mudam, 164 escolhas mudam de atributo ou de posição.
- C → D: 147 perfis mudam, 232 escolhas mudam de atributo ou de posição.
- C → F: 132 perfis mudam, 216 escolhas mudam de atributo ou de posição.
- Estilos mais escolhidos em D: Roguelike (11), Incremental e idle (7), Alienígenas (7), Narrativa com escolhas (6), Pós-apocalíptico (6), Aconchegante (6), Metroidvania (6), Exploração de masmorras (6), Terror psicológico (6), Soulslike (6).
- Estilos mais escolhidos em F: Roguelike (9), Aconchegante (7), Incremental e idle (7), Alienígenas (7), Narrativa com escolhas (6), Soulslike (6), Pós-apocalíptico (5), Metroidvania (5), Exploração de masmorras (5), Terror psicológico (5).

- **Os empates são a regra.** Uma biblioteca de três jogos bem avaliados tem muitos atributos nos mesmos jogos. De 55% a 67% das escolhas tiveram empate na cobertura, e qualquer troca de desempate muda os interesses de cerca de metade dos perfis.
- **Pelo menos frequente:** favorece o atributo mais específico, mas pode escolher um detalhe do jogo. No caso Amnesia, venceria Furtividade (2,0% do catálogo), que só esse jogo tem, e não Terror, que está em três dos oito jogos.
- **Pelo peso na biblioteca:** escolhe o atributo que mais aparece nos jogos de que o jogador gostou, e só depois o mais específico. No caso Amnesia, venceria Terror. É o que mais se aproxima do que a prateleira promete ("Porque você curte Terror"). **Recomendado** para acompanhar os estilos.
- **Com estilos:**
  - os perfis com um interesse só caem de 22 para 19;
  - a cobertura dos jogos com peso positivo sobe de 92,7% para 94,5%;
  - com o desempate pelo peso na biblioteca, 143 dos 433 interesses (33%) passam a ser estilos. Os mais escolhidos são Roguelike, Aconchegante, Incremental e idle e Alienígenas.
  - Com o desempate por `u_k`, só 27 são estilos. O `u_k` de um estilo soma só as palavras-chave dele no vetor, e um estilo que veio do resumo tem `u_k` zero.
  - Na primeira rodada, antes da revisão, eram 148 de 434 e 94,7%.

## 6. Estimativa de implementação

### a) Estilos só como camada de exibição (o vetor não muda)

- **Curadoria:** o rascunho vira `config/styles.json`, revisado pelo autor, com o schema e a regra de casamento de `modules/styles` (já escritos para a medição).
- **Dados:**
  - Uma tabela `GameStyle`, com migration, preenchida por um passo da ingestão a partir das palavras-chave e do resumo já gravados.
  - Não exige nova chamada à IGDB nem muda o IDF. Basta rodar a ingestão, ou o passo dos estilos, uma vez em produção.
  - A alternativa sem tabela seria calcular os estilos na carga do índice, mas o filtro do catálogo precisaria deles no banco.
- **Índice (`content-index.repository.ts`, `content-index.ts`):** os estilos de cada jogo e a frequência de cada estilo.
- **Interesses e listas (`scoring/interests.ts`, `scoring/lists.ts`):**
  - estilos como candidatos (seção 5);
  - prateleira de estilo como recorte dos candidatos;
  - desempate pelo peso na biblioteca, que também vale sem estilos.
- **Motivo (`scoring/explain.ts`):**
  - Hoje o motivo vem da contribuição de cada atributo no cosseno, e os estilos não estão no vetor.
  - A regra nova seria: os estilos do jogo recomendado que também estão nos jogos de peso positivo da biblioteca, pelo peso, ao lado dos gêneros e temas.
  - O contrato do motivo passa a dizer o tipo de cada atributo.
- **Contrato e interface:** `feature.type` ganha `STYLE`, e a chave das prateleiras ganha `style:<slug>`. O B-72 monta os títulos e a rota `estilo-<slug>`.
- **Filtro do catálogo (opcional):** `GET /api/games?style=`, os estilos em `GET /api/features` e o filtro na página do catálogo.
- **Testes:**
  - os de interesses, listas, motivo, caso de uso, contrato e o e2e de recomendação ganham casos com estilos;
  - os que existem continuam valendo, porque o vetor não muda;
  - nenhum número do B-12, do B-32 ou do B-71 precisa ser refeito.
- **Esforço:** M para interesses, prateleiras e motivo. O filtro do catálogo soma um P na API e um P na interface.

### b) Estilos também no vetor, no lugar das palavras-chave agrupadas

- **Dados:**
  - Os estilos viram atributos do vetor: um tipo novo de atributo (migration no enum) ou uma troca das palavras-chave agrupadas por um atributo por estilo.
  - Juntar sinônimos muda a frequência e o IDF, e o IDF vem da ingestão. Exige rodar a ingestão de novo (sem a IGDB, mas recalculando o IDF) e recarregar o índice. Os pesos já são refeitos na API desde o B-31.
- **TF-IDF (`tfidf.ts`, `config/recommendation.json`):**
  - uma fatia nova ou uma redivisão da fatia das palavras-chave;
  - as exclusões passam a valer antes do agrupamento;
  - os termos do resumo entram no vetor pela primeira vez, como na evolução do B-63.
- **Índice e repositório:** a consulta da carga muda, para incluir os estilos.
- **Motivo:** os estilos podem virar motivo pela contribuição no cosseno, sem regra nova.
- **Testes e medições:**
  - mudam os testes do TF-IDF, do índice e dos fixtures de pontuação, que dependem dos vetores;
  - as medições do B-12, do B-32 e do B-71 ficam desatualizadas;
  - a fatia nova precisa de calibração.
- **Esforço:** G, e mexe no que o B-37 vai calibrar.

### Recomendação

**Caminho a, antes do B-37.**
- O problema que o B-71 encontrou está na exibição: interesses, prateleiras e motivo presos a gêneros genéricos. O caminho a resolve isso sem mexer no vetor que o B-37 vai calibrar.
- O B-37 calibra uma representação estável e pode testar o caminho b como variante offline: palavras-chave agrupadas por estilo no vetor, comparadas pelo acerto@10. O b só entra se melhorar o acerto, como já foi decidido para os blocos do B-62 e do B-63.
- Feito o a, a curadoria dos estilos fica pronta e testada na interface antes de qualquer mudança no vetor.

## 7. Critério de decisão

Registrado antes da medição:
- **Se a cobertura com palavras-chave e resumo passar de 50% do catálogo e a precisão da amostra for aceitável:** propor um item de implementação antes do B-37, com o caminho recomendado e o esforço.
- **Se não passar:** registrar a especificidade como limitação dos dados, com os números.

**Resultado:**
- **Primeira rodada:** cobertura de 58,4% e precisão de 85% a 90% na amostra.
- **Com a taxonomia revisada:** 53,5% e 20 de 20.

O critério foi atendido nas duas.

**Decisão do autor (03/11/2026):**
- **B-74 (M, E5), na S9, antes do B-36:** estilos como camada de exibição.
  - **Atribuição:** na carga do índice, a partir de `config/styles.json`, sem consulta nova por requisição e sem nova ingestão. A tabela `GameStyle` proposta na seção 6 não é necessária para isso.
  - **Interesses:** os estilos concorrem ao lado de gêneros e temas, com o limite de 40%.
  - **Desempate:** pelo peso na biblioteca e depois pelo menos frequente, para todos os atributos.
  - **Prateleiras:** "Porque você curte `<estilo>`".
  - **Motivo:** o estilo entra só pela contribuição das palavras-chave dele (seção 12 da proposta técnica).
- **B-75 (M, E3), P1:** filtro de estilo no catálogo, fora do núcleo da tese. Se entrar, a página "Como funciona" (B-25) passa a listar os estilos e as palavras-chave de cada um.
- **B-37:** testa o caminho b como variante, com o mesmo critério de acerto@10.
