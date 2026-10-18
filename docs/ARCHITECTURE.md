# Arquitetura

## Primeira entrega

| Área | Responsabilidade |
|---|---|
| `apps/web` | Rotas, telas, componentes e persistência local do rascunho. |
| `packages/domain` | Busca, estrutura de equipe e importação/exportação; funções puras. |
| `packages/data` | Importador versionado e metadados da PokéAPI. Dados gerados ficam fora do Git. |
| `apps/api` | API Node, OAuth do GitHub, autorização de equipe/sala, PostgreSQL e migrações SQL. |

O editor não depende de uma conta nem de servidor. Um rascunho fica no navegador. A UI não contém regras de formato: elas entram por um `Ruleset` versionado.

## Depois

Contas, salas, torneios e resultados usam API Node separada do Vite, PostgreSQL e transações. A API é a única camada que guarda segredos e acessa o banco. OAuth e código de amizade são configurados por ambiente; nenhum serviço de produção está conectado.

O fornecedor de dados competitivos fica atrás de uma interface `MetaProvider`. Isso permite desligar uma fonte ou mostrar cobertura parcial sem misturar dados de formatos e temporadas diferentes.

## Uso competitivo

O piloto de Usage fica em `apps/web/src/data/usage/providers/`. A tela depende do contrato do provedor (`loadIndex` e `loadPokemonUsage`), enquanto o adaptador Pokémon Champions Battle Data faz as chamadas e normaliza apenas os campos usados pela interface. Outra fonte pode implementar o mesmo contrato sem entrar nos componentes.

O navegador lê `/api` e, para a espécie selecionada, `/api/battle/Doubles/{showdownId}`. A resposta fica em cache somente na memória por cinco minutos, com até 16 entradas; o navegador não grava uma cópia HTTP. Não há endpoint próprio do Spinda Stop nem arquivo espelho. MetaRoll continua fora deste provedor.
