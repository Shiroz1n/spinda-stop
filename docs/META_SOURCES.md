# APIs de dados competitivos

Revisão feita em 18/10/2026. Usage começa em Doubles e permite consultar Battle Data ou MetaRoll, uma fonte por vez. Percentuais ficam ligados à sua captura: não somar, tirar média nem tratar respostas diferentes como uma única amostra.

Para o inventário campo a campo das respostas consultadas, o que já aparece no Spinda Stop e a sequência de PRs proposta, veja [Matriz de cobertura competitiva](COMPETITIVE_COVERAGE.md).

## Decisão

Pokémon Champions Battle Data e MetaRoll têm adaptadores separados. A tela de Usage deixa escolher uma fonte; cada ficha conserva a captura, temporada e atribuição daquela fonte. Nada passa por uma API pública do Spinda Stop.

## Pokémon Champions Battle Data

Documentação: [guia da API](https://championsbattledata.com/api_guide) · [regras de uso](https://championsbattledata.com/api-rules/)

| Rota | O que entrega |
|---|---|
| `GET /api` (também `/api/index` e `/data/pokemon-index.json`) | Índice de espécies, IDs Showdown, formatos e caminhos de dados disponíveis. |
| `GET /api/pokemon/{id}?format=Doubles&season=M4&days=7` | Registro de uma espécie, resumo e caminhos dos CSVs atuais ou diários. |
| `GET /api/battle/{format}/{id}?season=M4&days=7` | Linhas de golpes, itens, parceiros, natures, spreads e habilidades. `{format}` é `Doubles` ou `Singles`; `days` aceita de 1 a 31. |
| `GET /api/metadata/{name}` | Formas, tipos, habilidades e stats base. |
| `/pokemon_champions_assets/battle_data/{format}/{Pokemon}.csv` | CSV atual, além de arquivos estáticos de metadados e imagens. CSVs de temporadas encerradas podem não estar mais hospedados; os snapshots JSON continuam disponíveis. |

**Formato e período.** A API distingue Singles de Doubles. A pasta atual aponta para os dados mais recentes; snapshots datados aparecem por temporada e dia, no formato `DD_MM_YYYY`. A página do projeto diz que a coleta é refeita diariamente. O endpoint permite buscar até 31 dias e consultar temporadas arquivadas. O guia usa identificadores como `M4` e `M5`, mas não explica a correspondência de cada um com um regulamento oficial. O endpoint não documenta um campo de regulamento.

**Teste real.** Em 18/10/2026, `GET /api` respondeu com o índice, `generatedAt: 2026-10-17T15:27:09.479Z`, 263 entradas e o rótulo `defaultSeason: Current`. `GET /api/battle/Doubles/garchomp` respondeu com `format: Doubles`, `season: Current`, `date: null`, o caminho de origem do CSV e linhas de golpes, itens, parceiros, naturezas, Stat Points e habilidades. A resposta não trouxe tamanho de amostra ou regulamento. A documentação declara CORS para apps em outros domínios; esta execução confirmou as rotas públicas, mas não a chamada dentro de uma prévia local do app.

**Amostra.** As linhas trazem percentuais, mas a API não informa o total de partidas, jogadores ou aparições que os gerou. A interface mantém o valor como publicado e deixa essa lacuna visível. Não chama isso de taxa de vitórias nem de porcentagem de partidas.

**Limites e termos.** As [regras de uso](https://championsbattledata.com/api-rules/) permitem projetos pessoais, comunitários, sem fins lucrativos e comerciais. Um projeto público precisa atribuir a fonte com link. Cache razoável é permitido, mas não pode virar espelho, arquivo ou substituto permanente. Também é proibido revender ou redistribuir as respostas como serviço, dump, API concorrente ou feed sem autorização escrita. Não há limite público fixo; a fonte pode limitar ou revogar o acesso se houver problemas de serviço. O app mantém até 16 respostas por cinco minutos na memória da página, usa `cache: no-store` e encerra cada requisição se ela passar de 25 segundos, incluindo a leitura do JSON. Não grava nem publica as respostas.

**Limites da tela.** O índice usa o rótulo `Current`; a API não confirma que ele corresponda a um regulamento oficial. A resposta de Garchomp não incluiu data de snapshot. A tela não inventa período, amostra ou métrica ausente. Se uma rota falhar ou mudar, mostra erro e opção de nova tentativa; não substitui a resposta por dados armazenados localmente.

## MetaRoll

Documentação: [Champions Usage API](https://metaroll.app/api/v1/docs) · base `https://metaroll.app/api/v1`

| Rota | O que entrega |
|---|---|
| `GET /index.json` | Formato, temporada, hora da captura, captura usada na comparação e temporadas arquivadas. |
| `GET /ranking.json` | Ranking das espécies de Doubles. |
| `GET /pokemon/{id}.json` | Dados de uma espécie, com histórico e distribuições publicados pelo jogo. O ID é o nome em minúsculas, com separadores convertidos em hífen. |
| `GET /all.json` | Todas as entradas de espécies em um arquivo. |
| `GET /megas.json` | Formas Mega e pedra associada por Pokémon; anunciado no campo `endpoints` do índice ao vivo, mas sem seção própria no guia. |
| `GET /ladder-cutoffs.json` | Valores ligados a posições do ladder de jogadores; anunciado no índice ao vivo, mas sem seção própria no guia. |
| `GET /seasons/{season}/…` | Cópia final de uma temporada encerrada. |
| `GET /ladder.json` | Até mil jogadores do ladder de Doubles; é dado de jogadores, não de uso de Pokémon. |
| `GET /singles/ladder.json` | Ladder de jogadores de Singles. Não há API de uso de Pokémon em Singles. |

O Spinda Stop consulta `all.json` para espécies e fichas e `ladder.json` só na seção “Ladder de jogadores”. Busca, filtros por país e idioma, ordenação e paginação usam campos presentes nas respostas. Cada captura da ladder conserva seus próprios cabeçalho, período e atribuição.

**Formato e período.** A API de uso de Pokémon é apenas Doubles, vindo do ladder ranqueado do jogo. As respostas identificam temporada, `capturedAt` e `comparedTo`. As temporadas duram cerca de quatro semanas; o ranking recomeça a cada temporada. A captura é feita aproximadamente a cada hora e publicada quando há mudança. O exemplo da documentação para M-5 contém `count: 235`: são Pokémon ranqueados naquela captura, não partidas, jogadores nem denominador das porcentagens.

**Resposta real de `all.json`.** Consultada em 18/10/2026 às 09:46:20 UTC: `season: M-7`, `format: doubles`, `count: 262`, `comparedTo: 2026-10-17T09:46:15Z` e 262 entradas em um arquivo de 1.562.938 bytes. As entradas observadas tinham `id`, `name`, `rank`, `previousRank`, `abilities`, `items`, `moves`, `natures`, `teammates`, `spreads`, `matchups` e `confidence`; nenhuma tinha `rankHistory` ou `usageHistory`. Esses históricos só vieram em `pokemon/{id}.json`. A contagem é de entradas ranqueadas, não de partidas nem de uma amostra estatística.

**Amostra e limites dos campos.** Os percentuais de golpes, itens, habilidades, nature, parceiros e spreads representam uma proporção das aparições daquele Pokémon. A API não informa quantas partidas ou aparições compõem esses percentuais. Os parceiros vêm com `percent: null`. Nature e Stat Point spread são distribuições separadas: não dá para afirmar qual nature acompanha qual spread. Stat Points não são EVs. A tela de matchups mostra apenas as listas que a fonte publica: nomes associados a vitórias/derrotas e contagens alinhadas quando presentes. Isso não equivale ao total de jogos do confronto; percentuais de golpes no matchup também não são taxa de vitória. `ladder.json` conta jogadores, então seus números nunca devem ser usados como amostra das distribuições de Pokémon.

**Histórico de rating da ladder.** O campo `ratingHistory[]` vem dentro de `ladder.json`, não de uma rota separada. Na captura real de 18/10/2026 às 09:46:20 UTC havia 104 pontos entre 14/10 e 18/10; cada ponto trazia `at`, `avg`, `n` e `ranks`, com `n: 1000` e chaves de posição 1, 100, 300, 500 e 1000. No ponto atual, `avg` coincide com a média dos ratings das mil entradas arredondada a três casas e cada valor em `ranks` coincide com a entrada da mesma posição. A interface mostra os valores publicados e conserva `n` como contagem do ladder; não chama isso de amostra de partidas. A regra histórica de cálculo não está formalizada no guia.

**Formas Mega e posições do ladder.** O índice ao vivo anunciou `megas` e `ladderCutoffs`, e ambos responderam na mesma captura M-7 de 18/10/2026 às 09:46:20 UTC. `megas.json` tinha 81 linhas; em todas, `rank` coincidiu com a posição do Pokémon em `all.json` e `percent` com o percentual do mesmo item em `items[]`. O cruzamento repetiu-se nas 82 linhas de M-6, captura final de 07/10/2026 às 03:16:12 UTC. `forme` e `stone` relacionam a forma e o item. O PR #21 mostra esse uso do item junto à ficha, com a captura própria e sem tratá-lo como chance de Mega Evolução ou distribuição independente. `ladder-cutoffs.json` trouxe valores nas posições 10, 100, 300, 500 e 1000; todos coincidiram com os ratings da ladder e com `ratingHistory` na captura atual. O campo não define um limite de elegibilidade futuro, então a interface não o chama de “rating mínimo” nem o duplica como corte separado.

**Limites e termos.** O guia informa uso gratuito em projetos pessoais, comunitários e comerciais, sem chave, cadastro, quota ou limite de requisições; pede crédito e link para MetaRoll, sem sugerir parceria ou endosso. O índice ao vivo marca `attribution.required: true`. O servidor publica `Cache-Control: public, max-age=300`; respeitamos cinco minutos e lemos `all.json` em uma requisição. O guia não apresenta uma licença formal separada: a autorização e as condições de uso são as publicadas na própria documentação. MetaRoll é um projeto independente e não oficial.

## Como o app deve guardar os dados

Cada observação futura deve carregar, no mínimo, `sourceId`, `sourceUrl`, formato, temporada, data de captura ou snapshot, métrica, valor e unidade. Guardar também tamanho da amostra e denominador quando a fonte os fornecer. Quando não fornecer, manter como desconhecido (`null`) e deixar isso visível. Nunca preencher lacunas com zero.

Uma tela pode comparar fontes lado a lado, com seus rótulos e períodos, mas não deve juntá-las num único percentual. Não associar nature e spread do MetaRoll, nem derivar uma taxa de vitória de percentuais de uso.

## O que falta

- Conferir todas as telas em viewport mobile real e repetir a inspeção na cadeia atualizada. A prévia desktop existe; o navegador disponível ainda não oferece controle de viewport e o Chromium local não está instalado.
- O guia formal ainda não especifica o contrato de `ratingHistory` ou `megas`; os campos usados nas telas foram cruzados com a ladder atual. `ladder-cutoffs` fica registrado sem UI até o guia esclarecer se o valor é apenas o rating atual em cada posição ou outra espécie de corte.
- Não há tamanho de amostra nem ligação verificada entre temporada e regulamento em nenhuma das fontes. Esses campos ficam ausentes.
- Rever atribuição e cache se os termos publicados mudarem.
