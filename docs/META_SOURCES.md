# APIs de dados competitivos

Revisão feita em 18/10/2026. O piloto de Usage usa Pokémon Champions Battle Data em Doubles; MetaRoll continua como alternativa separada. Percentuais ficam ligados à sua fonte: não somar, tirar média nem tratar respostas diferentes como uma única amostra.

Para o inventário campo a campo das respostas consultadas, o que já aparece no Spinda Stop e a sequência de PRs proposta, veja [Matriz de cobertura competitiva](COMPETITIVE_COVERAGE.md).

## Decisão

O primeiro piloto usa Pokémon Champions Battle Data porque a API responde às rotas públicas de Doubles e suas regras permitem projetos comunitários com atribuição. A tela mostra a origem e o período devolvido pela API. Os dados passam pelo navegador e por um adaptador que pode ser substituído.

MetaRoll permanece documentada como fonte alternativa. Seus dados não entram nesta tela e nunca serão combinados com Pokémon Champions Battle Data.

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

**Limites e termos.** As [regras de uso](https://championsbattledata.com/api-rules/) permitem projetos pessoais, comunitários, sem fins lucrativos e comerciais. Um projeto público precisa atribuir a fonte com link. Cache razoável é permitido, mas não pode virar espelho, arquivo ou substituto permanente. Também é proibido revender ou redistribuir as respostas como serviço, dump, API concorrente ou feed sem autorização escrita. Não há limite público fixo; a fonte pode limitar ou revogar o acesso se houver problemas de serviço. O app mantém até 16 respostas por cinco minutos na memória da página e usa `cache: no-store`; não grava nem publica as respostas.

**Limites da tela.** O índice usa o rótulo `Current`; a API não confirma que ele corresponda a um regulamento oficial. A resposta de Garchomp não incluiu data de snapshot. A tela não inventa período, amostra ou métrica ausente. Se uma rota falhar ou mudar, mostra erro e opção de nova tentativa; não substitui a resposta por dados armazenados localmente.

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

## O que falta para ampliar o piloto

- Confirmar a chamada CORS em uma prévia visual acessível, pois o navegador local deste ambiente não conseguiu alcançar o servidor Vite.
- Confirmar se a fonte passa a fornecer data, tamanho de amostra ou um vínculo verificável entre temporada e regulamento. Até lá, os campos seguem ausentes.
- Testar snapshots diários e temporadas encerradas em uma etapa separada, sem chamar os rótulos M1–M7 de regulamentos.
- Revisar atribuição e cache se os termos da API mudarem. Manter MetaRoll em uma fonte distinta caso seja integrada no futuro.
