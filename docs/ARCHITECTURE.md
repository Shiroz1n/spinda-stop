# Arquitetura

## Primeira entrega

| Área | Responsabilidade |
|---|---|
| `apps/web` | Rotas, telas, componentes e persistência local do rascunho. |
| `packages/domain` | Busca, estrutura de equipe e importação/exportação; funções puras. |
| `packages/data` | Importador versionado e metadados da PokéAPI. Dados gerados ficam fora do Git. |

O editor não depende de uma conta nem de servidor. Um rascunho fica no navegador. A UI não contém regras de formato: elas entram por um `Ruleset` versionado.

## Depois

Contas, eventos, pareamentos e resultados precisam de API, autorização por recurso e transações. A escolha entre Fastify, PostgreSQL, OAuth e hospedagem fica para essa etapa. O frontend não guarda segredos nem acessa banco diretamente.

O fornecedor de dados competitivos fica atrás de uma interface `MetaProvider`. Isso permite desligar uma fonte ou mostrar cobertura parcial sem misturar dados de formatos e temporadas diferentes.
