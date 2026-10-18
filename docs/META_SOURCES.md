# APIs de dados competitivos

Revisão feita em 18/10/2026. Nenhuma dessas APIs está integrada ao app. Os percentuais abaixo precisam continuar ligados à sua fonte; não somar, tirar média nem tratar respostas diferentes como uma única amostra.

## Decisão

MetaRoll é a opção mais clara para um piloto de Doubles: cada resposta identifica formato, temporada e hora da captura. Ainda assim, os percentuais de uso não vêm com o total de partidas ou jogadores que os gerou. Por isso, não vamos mostrá-los no app até decidir como explicar essa ausência e testar uma resposta real.

Pokémon Champions Battle Data pode complementar a pesquisa, pois publica dados atuais e snapshots diários de Singles e Doubles. A API não documenta o denominador das porcentagens nem associa cada linha a um regulamento oficial. O guia também declara os dados como sujeitos a mudanças e disponibilidade sem garantia. Antes de qualquer integração, precisamos confirmar acesso e a relação entre as temporadas exibidas e o regulamento do jogo.

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

**Amostra.** Os exemplos trazem porcentagens, mas o guia não informa total de partidas, jogadores ou aparições por porcentagem. Não chamar isso de taxa de vitórias nem comparar como se o tamanho da amostra fosse conhecido.

**Limites e termos.** Não há limite público fixo, mas o acesso pode ser limitado ou revogado se causar problemas ao serviço. Cache razoável é permitido; não usar o cache para manter um espelho permanente. É permitido uso pessoal, comunitário e comercial. Projetos públicos precisam atribuir os dados a Pokémon Champions Battle Data e incluir um link. É proibido revender ou redistribuir os dados como serviço, dump, API concorrente ou feed sem autorização escrita. A fonte é não oficial; o uso não concede direito sobre marcas ou conteúdo de Pokémon.

**Ponto a validar.** O guia informa CORS para apps no navegador. Em uma tentativa anterior de leitura direta, `/api/pokemon/pikachu` respondeu 403 e `/api/battle/Doubles/garchomp` expirou. Ainda não confirmamos uma resposta real acessível daqui.

## MetaRoll

Documentação: [Champions Usage API](https://metaroll.app/api/v1/docs) · base `https://metaroll.app/api/v1`

| Rota | O que entrega |
|---|---|
| `GET /index.json` | Formato, temporada, hora da captura, captura usada na comparação e temporadas arquivadas. |
| `GET /ranking.json` | Ranking das espécies de Doubles. |
| `GET /pokemon/{id}.json` | Dados de uma espécie, com histórico e distribuições publicados pelo jogo. O ID é o nome em minúsculas, com separadores convertidos em hífen. |
| `GET /all.json` | Todas as entradas de espécies em um arquivo. |
| `GET /seasons/{season}/…` | Cópia final de uma temporada encerrada. |
| `GET /ladder.json` | Até mil jogadores do ladder de Doubles; é dado de jogadores, não de uso de Pokémon. |
| `GET /singles/ladder.json` | Ladder de jogadores de Singles. Não há API de uso de Pokémon em Singles. |

**Formato e período.** A API de uso de Pokémon é apenas Doubles, vindo do ladder ranqueado do jogo. As respostas identificam temporada, `capturedAt` e `comparedTo`. As temporadas duram cerca de quatro semanas; o ranking recomeça a cada temporada. A captura é feita aproximadamente a cada hora e publicada quando há mudança. O exemplo da documentação para M-5 contém `count: 235`: são Pokémon ranqueados naquela captura, não partidas, jogadores nem denominador das porcentagens.

**Amostra e limites dos campos.** Os percentuais de golpes, itens, habilidades, nature, parceiros e spreads representam uma proporção das aparições daquele Pokémon. A API não informa quantas partidas ou aparições compõem esses percentuais. Os parceiros vêm com `percent: null`. Nature e Stat Point spread são distribuições separadas: não dá para afirmar qual nature acompanha qual spread. Stat Points não são EVs. Matchups podem incluir partidas ganhas ou perdidas por confronto, mas isso não equivale ao total de jogos; percentuais de golpes no matchup também não são taxa de vitória. `ladder.json` conta jogadores, então seus números nunca devem ser usados como amostra das distribuições de Pokémon.

**Limites e termos.** A documentação diz que não exige chave, cadastro ou quota e aceita uso gratuito em qualquer contexto. Respostas indicam cache público de 300 segundos; respeitar esse prazo e buscar `all.json` uma vez em vez de consultar as 235 espécies em sequência. A documentação pede que o projeto cite MetaRoll e inclua um link para `metaroll.app`, sem sugerir parceria ou endosso. Não há licença formal identificada na página; o crédito é descrito como pedido, não como condição técnica imposta. É um projeto independente e não oficial.

## Como o app deve guardar os dados

Cada observação futura deve carregar, no mínimo, `sourceId`, `sourceUrl`, formato, temporada, data de captura ou snapshot, métrica, valor e unidade. Guardar também tamanho da amostra e denominador quando a fonte os fornecer. Quando não fornecer, manter como desconhecido (`null`) e deixar isso visível. Nunca preencher lacunas com zero.

Uma tela pode comparar fontes lado a lado, com seus rótulos e períodos, mas não deve juntá-las num único percentual. Não associar nature e spread do MetaRoll, nem derivar uma taxa de vitória de percentuais de uso.

## O que falta antes de integrar

- Confirmar leitura dos endpoints a partir do app e verificar estrutura, CORS e estabilidade de uma captura real.
- Confirmar como cada temporada do Battle Data se relaciona com o regulamento do jogo.
- Decidir se a falta do denominador é aceitável para o produto e como será mostrada para quem consulta.
- Guardar a fonte e a captura na interface em cada estatística; preservar amostras e formatos separados.
- Revalidar atribuição, cache e termos no momento da integração. Não armazenar snapshots do Battle Data como arquivo permanente.
