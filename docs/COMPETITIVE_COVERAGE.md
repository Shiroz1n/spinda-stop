# Cobertura competitiva das fontes

Inventário conferido em 18/10/2026. O estado da interface acompanha os PRs #1 a #7, empilhados e ainda sem merge. Foram comparados os guias das duas APIs com respostas públicas reais consultadas nessa data. Os exemplos dos guias podem estar atrasados: o índice MetaRoll consultado, por exemplo, trazia 262 Pokémon, enquanto a documentação ainda cita 235.

## Campos vistos nas respostas reais

As listas abaixo registram o formato retornado nas capturas consultadas. A API pode mudar; campo ausente significa “não veio nesta resposta”, não que a fonte nunca o forneça. Quando o guia descreve mais do que foi inspecionado no JSON, isso fica marcado como “guia”.

### Pokémon Champions Battle Data

| Resposta consultada | Campos vistos |
|---|---|
| `/api` | `generatedAt`, `dataVersion`, `assetRoot`, `battleDataFolders`, `dailyDataFolders`, `seasons`, `defaultSeason`, `topicPages`, `pokemonPages`, `pokemon[]` |
| `/api`.pokemon[] | `name`, `battleName`, `slug`, `showdownId`, `showdownName`, `metadataCsv`, `battleDataCsvs`, `learnableMoveNames`, `summary` |
| `/api`.pokemon[].summary | `baseStatTotal`, `baseStats`, `types`, `battleSummary`; stats: `attack`, `defense`, `hp`, `sp_attack`, `sp_defense`, `speed` |
| `/api`.pokemon[].summary.battleSummary[season].Doubles | `position`, `statChanges`, `top`, `values`; resumo por categoria: `move`, `held_item`, `teammate`, `stat_alignment`, `stat_points`, `ability` |
| `/api/pokemon/garchomp?format=Doubles` | `battleDataCsv`, `battleDataCsvs`, `battleName`, `battleSummary`, `dailyBattleSummary`, `learnableMoveNames`, `metadataCsv`, `name`, `requestedFormat`, `requestedSeason`, `showdownId`, `showdownName`, `slug`, `summary` |
| `/api/battle/Doubles/garchomp` | `columns`, `date`, `format`, `pokemon`, `rows`, `season`, `showdownId`, `source` |
| `/api/battle/Doubles/garchomp`.rows[] | `attack_points`, `category`, `column_position`, `defense_points`, `hp_points`, `name`, `percentage`, `percentage_value`, `pokemon`, `rank`, `sp_atk_points`, `sp_def_points`, `speed_points`, `stat_down`, `stat_up` |
| `/api/battle/Doubles/garchomp?season=M7&days=3` | `daily`, `format`, `pokemon`, `requestedDays`, `season`, `showdownId`; each `daily[]`: `columns`, `date`, `rows`, `season`, `source` |
| `/api/metadata/garchomp` | `columns`, `pokemon`, `rows`, `source`; each `rows[]`: `abilities`, `atk`, `base_name`, `def`, `form`, `hp`, `image_path`, `saved_name`, `spa`, `spd`, `spe`, `title`, `total`, `types`, `weight` |

O guia também documenta `dailyBattleDataCsvs` no registro de Pokémon; a captura real consultada usou `battleDataCsvs` e `dailyBattleSummary`. O adaptador deve aceitar as variantes documentadas e reais sem assumir que estejam sempre presentes.

### MetaRoll

| Resposta consultada | Campos vistos |
|---|---|
| `/api/v1/index.json` | `version`, `game`, `source`, `format`, `season`, `capturedAt`, `comparedTo`, `count`, `endpoints`, `pastSeasons`, `attribution` (`required`, `name`, `url`, `text`, `terms`) |
| `/api/v1/ranking.json` | `attribution`, `capturedAt`, `comparedTo`, `count`, `entries`, `format`, `game`, `pastSeasons`, `season`, `source`, `version`, `weekOf`; `entries[]`: `forme`, `id`, `name`, `nat`, `previousRank`, `rank`, `spe`, `weekRank` |
| `/api/v1/pokemon/tauros-paldea-aqua.json` | Cabeçalho de captura e `entry`; `entry`: `abilities`, `confidence`, `id`, `items`, `matchups`, `moves`, `name`, `natures`, `previousRank`, `rank`, `rankHistory`, `spreads`, `teammates`, `usageHistory` |
| Distribuições da ficha | `abilities[]`, `items[]`, `moves[]`, `natures[]`, `teammates[]`; cada linha tem `name`, `percent`; em `teammates`, o valor real consultado foi `null` |
| `entry.rankHistory[]` | `d`, `r` |
| `entry.usageHistory[]` | `d`, mapas `m`, `i`, `a` |
| `entry.spreads[]` | `statPoints` (`atk`, `def`, `hp`, `spa`, `spd`, `spe`) e `percent` |
| `entry.matchups` | `beatenBy[]` (`name`, `percent`), `beats[]` (nomes), `beatsGames[]` (contagens), `beatsWith[]` (`name`, `percent`), `losesTo[]` (nomes), `losesToGames[]` (contagens) |
| `/api/v1/ladder.json` | `version`, `game`, `source`, `format`, `ranks`, `season`, `capturedAt`, `comparedTo`, `count`, `ratingHistory`, `entries` |
| `ladder.entries[]` | `avatar`, `battles`, `country`, `draws`, `id`, `language`, `losses`, `name`, `rank`, `rating`, `winRate`, `wins`; `country` e `language`: `code`, `flag`, `iso`, `name` |
| `ladder.ratingHistory[]` | `at`, `avg`, `n`, `ranks`; as chaves de `ranks` vistas foram `1`, `100`, `300`, `500`, `1000` |
| `/api/v1/megas.json` | O índice anunciava esta rota; a resposta observada continha `entries[]` com `forme`, `id`, `name`, `percent`, `rank`, `stone` |
| `/api/v1/ladder-cutoffs.json` | O índice anunciava esta rota; a resposta observada continha `cutoffs` e `ranks` |

`all.json` e o conteúdo completo de snapshots arquivados são descritos no guia. O arquivo de 1,3 MB não foi enumerado nesta conferência; a tela MetaRoll usa o contrato documentado e o adaptador valida a lista antes de renderizar. O guia diz que `all.json` omite os históricos diários individuais, por isso a tela busca o endpoint de cada Pokémon ao abrir a ficha.

## Pokémon Champions Battle Data

Guia: [API Guide](https://championsbattledata.com/api_guide) · [regras de uso](https://championsbattledata.com/api-rules/)

### `GET /api`

| Campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `generatedAt`, `dataVersion` | Hora e versão do índice | `generatedAt` aparece na nota do índice | `dataVersion` ainda não aparece |
| `assetRoot`, `battleDataFolders`, `dailyDataFolders` | Raiz e pastas atuais/diárias | Não | Precisam alimentar a navegação histórica sem guardar cópias |
| `seasons`, `defaultSeason` | Temporadas listadas e temporada padrão; a captura trouxe `Current` | `defaultSeason` aparece como rótulo da fonte | A fonte não vincula esses nomes a um regulamento oficial |
| `topicPages`, `pokemonPages` | Páginas auxiliares da fonte | Não | Fora da tela de Usage |
| `pokemon[]` | Entradas do índice | A lista e a contagem aparecem | A contagem é do índice, não de partidas |
| `pokemon[].name`, `battleName`, `slug` | Nome exibido e identificadores de site | `name` ou fallback é exibido | `slug` ainda não é usado |
| `pokemon[].showdownId`, `showdownName` | ID de rota e nome padronizado | `showdownId` é usado na busca da API | Nome Showdown ainda não aparece como dado separado |
| `metadataCsv`, `battleDataCsvs` | Caminhos de origem atuais e diários | Não | Caminhos servem para rastrear disponibilidade; CSV arquivado pode não existir |
| `learnableMoveNames` | Golpes aprendíveis no jogo | Não | Não é uma lista de golpes usados no competitivo; não usar como estatística |
| `summary.baseStatTotal`, `baseStats` | Total e stats base | Não | Dados de Pokédex, não estatísticas de uso |
| `summary.types` | Tipos | Sim, como chips e filtro | Tipos vêm do índice da fonte nesta tela |
| `summary.battleSummary[season][format].position` | Posição publicada para uma espécie | Sim, rótulo “posição na fonte” | Não renomear para ranking de jogadores nem inferir o critério além do guia |
| `statChanges`, `top`, `values` | Resumo por formato e categoria | Sim, `top`/`values` alimentam filtros de golpe, item e habilidade | A forma das listas varia por categoria; os filtros só aceitam nomes realmente presentes |

### `GET /api/pokemon/{id}?format=Doubles&season={season}&days={days}`

| Campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `name`, `showdownId`, `showdownName`, `battleName`, `slug` | Identidade da espécie/form | O índice identifica a espécie; o registro ainda não é consultado | O registro ajuda a descobrir históricos disponíveis |
| `requestedFormat`, `requestedSeason` | Formato e temporada solicitados | Não | Exibir exatamente o rótulo devolvido |
| `battleDataCsv`, `battleDataCsvs`, `dailyBattleDataCsvs`, `metadataCsv` | Arquivos de origem atuais e históricos | Não | Caminhos não provam que um CSV arquivado esteja hospedado |
| `summary`, `battleSummary` | Stats e resumo competitivo da espécie | Não, fora dos dados básicos do índice | Usar só os campos realmente devolvidos |
| `learnableMoveNames` | Lista de golpes aprendíveis | Não | Não equivale aos golpes usados |
| `dailyBattleSummary[]` | Resumo de snapshots diários com temporada, data, arquivo e `summary` | Não | A captura observada variou conforme disponibilidade; estado ausente não significa “sem uso” |

### `GET /api/battle/Doubles/{showdownId}` e snapshots com `?season=M4&days=7`

| Campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `pokemon`, `showdownId`, `format` | Espécie/form e formato | `format` e `pokemon` aparecem | A tela fixa Doubles neste piloto |
| `season`, `date`, `source` | Rótulo de temporada, data quando existe e caminho de origem | Temporada, data e origem aparecem quando disponíveis | `date: null` permanece “não informada”; `Current` não é tratado como regulamento |
| `columns` | Colunas publicadas | Não | Metadado útil para acompanhar mudanças de esquema |
| `rows[]` | Linhas por espécie e categoria | Sim, uma categoria por vez | Ainda não há perfil compacto com todas as categorias |
| `rows[].pokemon`, `column_position`, `category`, `rank`, `name` | Espécie, posição da coluna, categoria, ordem e rótulo | Categoria, ordem e nome aparecem | `column_position` e `pokemon` não aparecem |
| `rows[].percentage`, `percentage_value` | Valor e número percentual publicados | Sim | Sem amostra ou denominador; não chamar de percentual de partidas ou taxa de vitória |
| `rows[].stat_up`, `stat_down` | Aumento/redução de stat da natureza/alinhamento | Sim, quando a categoria é stat alignment | Manter a denominação da fonte; não juntar natureza e spread |
| `rows[].hp_points`, `attack_points`, `defense_points`, `sp_atk_points`, `sp_def_points`, `speed_points` | Distribuição de Stat Points | Sim | São Stat Points, não EVs |
| `daily[]` | Snapshots recentes, mais novos primeiro, cada qual com `season`, `date`, `source`, `columns` e `rows` | Sim, seleção por temporada da pasta, janela e data devolvida | `days` aceita 1–31; temporada e data são os rótulos da pasta |
| categorias `move`, `held_item`, `ability`, `teammate`, `stat_alignment`, `stat_points` | Golpes, itens, habilidades, parceiros, nature/alinhamento e spread | Sim, ficha completa e abas por categoria | A resposta de parceiro pode não trazer percentual; manter ausente |

### `GET /api/metadata/{name}`

| Campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `pokemon`, `source`, `columns` | Nome base, arquivo e colunas | Não | A fonte pode retornar várias formas por nome base |
| `rows[].title`, `base_name`, `saved_name`, `form` | Nome, grupo e forma | Não | Importante para não fundir formas distintas |
| `rows[].types`, `abilities`, `image_path` | Tipos, habilidades possíveis e caminho de imagem | Tipos vêm do índice; demais não | Habilidades possíveis não são frequência de uso |
| `rows[].hp`, `atk`, `def`, `spa`, `spd`, `spe`, `total`, `weight` | Stats e peso de cada forma | Não | Dados descritivos, sem amostra competitiva |

**A fonte não fornece** ladder de jogadores, registros de vitórias/derrotas por jogador, matchups, tamanho de amostra, denominador dos percentuais ou identificador de regulamento oficial.

## MetaRoll

Docs: [Champions Usage API](https://metaroll.app/api/v1/docs) · base `https://metaroll.app/api/v1`

### Índice, ranking e histórico

| Rota/campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `index.json`: `version`, `game`, `source`, `format`, `season` | Contrato, jogo, origem, formato e temporada | Exibidos na tela MetaRoll | O formato é Doubles; temporada é o nome do jogo, não um regulamento oficial |
| `capturedAt`, `comparedTo` | Hora desta captura e captura usada na comparação | Captura atual exibida; comparação fica disponível no adaptador | Cada número segue ligado à sua própria captura |
| `count`, `pastSeasons`, `endpoints` | Entradas na captura, temporadas arquivadas e rotas anunciadas | Contagem e temporadas usadas na tela | `count` mede Pokémon ranqueados, não partidas |
| `attribution` | `required`, nome, URL, texto e termos publicados no índice atual | Crédito e link MetaRoll aparecem na tela | Não sugerir parceria ou endosso |
| `ranking.json`: `entries[]` | Ranking de espécies | Posição vem do mesmo campo `rank` incluído em `all.json` | `forme`, `nat`, `spe` e `weekRank` observados no ranking não têm semântica documentada |
| `pokemon/{id}.json`: `entry.rank`, `previousRank` | Posição atual e anterior da espécie | Sim | `null` significa que não constava na captura anterior; ausência significa que não havia captura anterior |
| `rankHistory[]: d, r` | Posição diária na temporada, em UTC | Sim, lista diária | Só no arquivo individual; dias não ranqueados não aparecem |
| `usageHistory[]: d, m, i, a` | Histórico diário de golpes, itens e habilidades | Sim, com seletor de dia | Guarda apenas 8 golpes, 6 itens e 3 habilidades por dia; nature e spread não têm histórico |
| `all.json` | Todas as fichas atuais num arquivo | Usado para lista, filtros e ranking | O guia diz que omite `rankHistory` e `usageHistory`; a UI busca a ficha individual ao selecionar espécie |
| `/seasons/{season}/…` | Cópia final de uma temporada encerrada | Temporadas arquivadas têm seletor próprio | Capturas de temporadas diferentes não são tratadas como a mesma amostra |

### Ficha por Pokémon

| Campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `id`, `name`, `rank`, `previousRank` | Identidade e posição de uso | Sim | Formas alternativas têm IDs próprios |
| `abilities[]`, `items[]`, `moves[]`, `natures[]` | Distribuições ordenadas com `name` e `percent` | Sim | Percentual é parcela das aparições daquele Pokémon, não das partidas |
| `teammates[]: name, percent` | Parceiros frequentes | Sim | `percent` é sempre `null`; interface mostra apenas ordem/nome |
| `spreads[]: statPoints, percent` | Distribuição de Stat Points | Sim | `hp`, `atk`, `def`, `spa`, `spd`, `spe`; não são EVs e não vêm pareados com natureza |
| `confidence.formGuessed`, `identifiedByElimination` | Sinalizadores de confiança | Sim, sem tratar como métrica competitiva | As leituras atuais do jogo trazem `false` |

### Matchups

| Campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `matchups.beats[]`, `losesTo[]` | Espécies associadas a vitórias/derrotas, em ordem de frequência | Sim, listas separadas e identificadas como parciais | Não é uma tabela completa de tipos ou todos os confrontos |
| `beatsGames[]`, `losesToGames[]` | Jogos ganhos/perdidos alinhados às listas | Sim, junto à espécie correspondente | São contagens da relação, não total de partidas; algumas posições podem ser `null` |
| `beatsWith[]`, `beatenBy[]` | Golpes próprios em vitórias e golpes adversários em derrotas | Sim, em listas distintas | `percent` é dentro de vitórias/derrotas, não win rate |

### Ladder de jogadores

| Campo | O que a fonte entrega | No Spinda Stop | Lacuna ou cuidado |
|---|---|---|---|
| `/ladder.json`: `format`, `ranks`, `capturedAt`, `comparedTo`, `count` | Captura separada do ladder Doubles | Sim, período e entradas da resposta visíveis | `count` mede jogadores listados, não amostra de Pokémon; a publicação documenta até 1.000 jogadores |
| `entries[].rank`, `previousRank`, `id`, `name`, `rating` | Posição atual/anterior, ID, nome e rating | Sim | `id` identifica jogador; nomes podem repetir; ausência e `null` em `previousRank` têm significados diferentes |
| `wins`, `losses`, `draws`, `battles`, `winRate` | Registro e taxa de vitórias | Sim | A documentação define `battles` e `winRate` como derivados; `winRate = wins / battles` |
| `country`, `language` | Objetos com `code`, `name`, `flag` e, quando disponível, `iso` | Sim, filtros por país e idioma e nomes/flags | `country.code` não é ISO de país; agrupamento e filtro usam nome, nunca o código interno |
| `avatar` | Índice de avatar do jogo | Sim, exibido como número | A API não fornece a imagem desse avatar |
| `ratingHistory` | Campo observado na resposta real, com `at`, `avg`, `n`, `ranks` | Não | Campo não descrito no guia; não exibir até a fonte esclarecer a semântica |

### Campos anunciados mas ainda sem semântica suficiente

O `index.json` consultado anunciava `megas` e `ladderCutoffs`, ausentes da lista formal de rotas dos docs. As respostas observadas tinham, respectivamente, entradas `{ forme, id, name, percent, rank, stone }` e dados `cutoffs`/`ranks`. A semântica de `percent`, dos cortes e das posições não está documentada. Não exibir até confirmar com a fonte.

**A fonte não fornece** tamanho/denominador da amostra das distribuições, vínculo verificável com regulamento oficial ou ladder completo de todos os jogadores. O ladder publicado cobre o top 1000.

## Lacunas em relação ao Silph Scope

| Recurso da referência | O que temos nas fontes | Estado do Spinda Stop |
|---|---|---|
| Busca por Pokémon e filtro por tipo | Battle Data e MetaRoll identificam espécies; Battle Data informa tipos | Busca e tipo já existem |
| Filtro por golpe, item e habilidade | Há distribuições por espécie; o índice Battle Data e o arquivo `all.json` MetaRoll publicam esses valores | PR #4 e PR #5 usam apenas valores presentes na fonte selecionada |
| Parceiros, nature e spreads | As duas fontes fornecem parte ou todos esses campos, com definições diferentes | PR #4 e PR #5 mostram cada fonte em separado |
| Histórico por temporada/data | Ambas têm snapshots, cada qual com calendário e rótulos próprios | PR #4 e PR #5 mantêm períodos separados |
| Matchups | MetaRoll publica listas parciais e contagens; Battle Data não publica esse campo | PR #6, separado, rotulado e com os limites ao lado dos números |
| Ladder de jogadores | MetaRoll publica até 1000 entradas; Battle Data não | PR #6, tela e filtros próprios; `count` não é usado como estatística de Pokémon |
| Tendências a partir do builder | As fichas por espécie estão disponíveis nas duas fontes | PR #7 abre Usage para o integrante escolhido e permite trocar de fonte; não altera o set |
| Aluguel de times/rentals | Nenhuma das duas APIs avaliadas fornece times de aluguel | Sem fonte; fora do escopo competitivo desta integração |
| Contas, salas e pareamento | Nenhuma das APIs oferece identidade ou salas do Spinda Stop | Etapa comunitária própria |
| Calculadora de dano | Nenhuma API substitui regras oficiais e um modelo de dano validado | Etapa própria; fontes de uso não serão usadas como fórmula |

## Decisões de produto

- Cada tela mostra nome/link da fonte, formato e período ou captura junto dos números.
- As fontes ficam em adaptadores separados. Um percentual de uma API nunca entra no cálculo de outra.
- Datas, temporada, ranking, denominador e tamanho de amostra só aparecem quando a fonte devolve esses campos.
- Stat Points não são EVs. Nature e spread não serão associados quando a fonte os publica como listas independentes.
- BCD pode ser exibida num projeto público com atribuição. O cache fica limitado a cinco minutos em memória; o Spinda Stop não armazena nem serve as respostas brutas.
- MetaRoll pede crédito/link e cache de 300 segundos. A atribuição identifica projeto independente, sem sugerir endosso.

## PRs propostos

| PR | Escopo | Fonte e limite |
|---|---|---|
| #3 — Matriz de cobertura competitiva | Este inventário de campos, decisão e lacunas do Silph Scope | Documentação; sem dados novos na interface |
| #4 — Perfil e histórico Battle Data | Facetas de tipo/golpe/item/habilidade, ficha completa por Pokémon, consultas por temporada e snapshots diários | Battle Data; Doubles; dados limitados às respostas disponíveis |
| #5 — MetaRoll: fichas e histórico | Adaptador próprio; perfil, ranking de espécies, histórico diário e temporadas arquivadas | Captura e atribuição próprias; sem tipo no arquivo |
| #6 — MetaRoll: matchups e ladder | Matchups publicados, top de jogadores e filtros por país/idioma/posição/rating/partidas/taxa | Separados da distribuição de Pokémon; sem ladder de jogadores na Battle Data |
| #7 — Tendências a partir do time | Link de cada integrante para a ficha correspondente, com busca contextual e troca de fonte | Navegação contextual para a fonte ativa e seu período; nenhum campo do set é alterado |
| #8 — Fechar lacunas de contrato | Confirmar com as fontes se `ratingHistory`, `megas` e `ladder-cutoffs` têm semântica útil e validar o arquivo grande | Só integrar campos documentados ou confirmados; `all.json` segue baseado no contrato público |
| #9 — Calculadora completa | Regras, fórmulas e casos de dano verificados | Não depende de percentuais de usage |
| #10 — Contas e salas | Identidade, salas, inscrição, pareamento e resultados | Exige decisões de hospedagem, privacidade e moderação |
