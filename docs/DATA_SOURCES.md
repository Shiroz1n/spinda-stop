# Fontes de dados

Revisão inicial: 18/10/2026. Cada conjunto precisa guardar fonte, versão ou período e data de atualização. Sem dado não significa zero.

| Fonte | Uso previsto | Situação |
|---|---|---|
| [PokéAPI v2](https://pokeapi.co/docs/v2) | Nomes, espécies, formas, relações/métodos/condições de evolução, tipos, habilidades, golpes, stats gerais, total base e aprendibilidade por forma, método e grupo de versões para o Dex. | O importador fixa a revisão `6fd69dfe90465ba96534f6816fc817737d1f97f6` do repositório. A ficha carrega aprendibilidade por ID exato da forma, jogo/versão e método; a evolução agrega condições e grupos de versão da mesma revisão. Isso verifica dado geral/jogo consultado, não coexistência dos quatro golpes, presença em Champions ou legalidade de regulamento. Veja o [inventário](PRODUCT_OPPORTUNITY_INVENTORY.md). |
| [Pokémon Champions Battle Data API](https://championsbattledata.com/api_guide) | Piloto de Usage para Doubles com índice, busca por espécie e categorias. | Integrada no navegador atrás de um adaptador. A tela atribui a fonte e mostra o período retornado. Denominador e regulamento oficial não são informados; os dados não são espelhados nem expostos por uma API do Spinda Stop. Veja a [avaliação das APIs](META_SOURCES.md). |
| [MetaRoll](https://metaroll.app/api/v1/docs) | Fonte separada de Usage, temporadas e ladder de Doubles. | Integrada pelo adaptador do navegador, com crédito, temporada/captura e valores ausentes preservados. Não informa o tamanho da amostra das porcentagens; pede link de crédito e cache de 300 s e não indica licença formal. Veja a [avaliação das APIs](META_SOURCES.md). |
| [Silph Scope](https://silph-scope.com/) | Referência de categorias: Ladder, Usage, Builder, Matchups, Calc, Rentals e Players. | Navegação e captura fornecidas foram observadas. Não foi encontrado contrato público de API ou autorização de reutilização. Sem scraping nem endpoint interno. |
| [Site oficial do Pokémon Champions](https://champions.pokemon.com/pt-br/gameplay/) | Modos e formatos publicados oficialmente. | A página descreve Ranqueada, Casual e Privada, com Individual e Dupla. Regulamentos e disponibilidade devem ser conferidos por temporada. |
| [Smogon Damage Calculator](https://github.com/smogon/damage-calc) | Catálogo e motor de dano `Champions` da calculadora; carta geral de multiplicadores na ficha do Dex. | O app usa `@smogon/calc` `0.12.0`, licença MIT; mecânicas e limites estão na [matriz de validação](CALC_VALIDATION.md). A carta de tipos não valida golpes, disponibilidade no jogo nem elegibilidade em regulamento. |

## Imagens e marcas

Nenhum sprite ou artwork é incluído nesta entrega. O projeto exibe atribuição à PokéAPI e informa que a marca e os elementos de Pokémon pertencem aos seus titulares. A licença MIT do código original não licencia imagens, personagens ou marcas da franquia.

O título usa Press Start 2P pela distribuição Fontsource (`@fontsource/press-start-2p`, SIL OFL 1.1). O corpo da interface usa fontes do sistema.
