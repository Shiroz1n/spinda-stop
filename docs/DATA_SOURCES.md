# Fontes de dados

Revisão inicial: 18/10/2026. Cada conjunto precisa guardar fonte, versão ou período e data de atualização. Sem dado não significa zero.

| Fonte | Uso previsto | Situação |
|---|---|---|
| [PokéAPI v2](https://pokeapi.co/docs/v2) | Nomes, espécies, formas, tipos, habilidades, golpes e stats gerais para o Dex. | A documentação permite uso aberto e pede cache local. O importador fixa a revisão `6fd69dfe90465ba96534f6816fc817737d1f97f6` do repositório. Isso não prova disponibilidade ou legalidade no Champions. |
| [Pokémon Champions Battle Data API](https://championsbattledata.com/api_guide) | Piloto de Usage para Doubles com índice, busca por espécie e categorias. | Integrada no navegador atrás de um adaptador. A tela atribui a fonte e mostra o período retornado. Denominador e regulamento oficial não são informados; os dados não são espelhados nem expostos por uma API do Spinda Stop. Veja a [avaliação das APIs](META_SOURCES.md). |
| [MetaRoll](https://metaroll.app/api/v1/docs) | Candidato para ranking e distribuições do ladder de Doubles. | Não integrada. Informa temporada e hora da captura, mas não o tamanho da amostra das porcentagens. Pede crédito com link e cache de 300 s; não indica licença formal. Veja a [avaliação das APIs](META_SOURCES.md). |
| [Silph Scope](https://silph-scope.com/) | Referência de categorias: Ladder, Usage, Builder, Matchups, Calc, Rentals e Players. | Navegação e captura fornecidas foram observadas. Não foi encontrado contrato público de API ou autorização de reutilização. Sem scraping nem endpoint interno. |
| [Site oficial do Pokémon Champions](https://champions.pokemon.com/pt-br/gameplay/) | Modos e formatos publicados oficialmente. | A página descreve Ranqueada, Casual e Privada, com Individual e Dupla. Regulamentos e disponibilidade devem ser conferidos por temporada. |
| [Smogon Damage Calculator](https://github.com/smogon/damage-calc) | Candidato a motor de dano para a fase da calculadora. | O pacote `@smogon/calc` `0.12.0` tem licença MIT e inclui mecânica Champions (`calc/src/mechanics/champions.ts`). Ainda não foi instalado nem comparado com casos do jogo; não declarar precisão antes da matriz de validação. |

## Imagens e marcas

Nenhum sprite ou artwork é incluído nesta entrega. O projeto exibe atribuição à PokéAPI e informa que a marca e os elementos de Pokémon pertencem aos seus titulares. A licença MIT do código original não licencia imagens, personagens ou marcas da franquia.

O título usa Press Start 2P pela distribuição Fontsource (`@fontsource/press-start-2p`, SIL OFL 1.1). O corpo da interface usa fontes do sistema.
