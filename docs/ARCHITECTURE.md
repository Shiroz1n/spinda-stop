# Arquitetura

## Primeira entrega

| Área | Responsabilidade |
|---|---|
| `apps/web` | Rotas, telas, componentes e persistência local do rascunho. |
| `packages/domain` | Busca, estrutura de equipe e importação/exportação; funções puras. |
| `packages/data` | Importador versionado da PokéAPI, índice compacto da Dex, ficha e blocos de aprendibilidade/evolução. Dados gerados ficam fora do Git. |
| `apps/api` | API Bun + Elysia, OAuth do GitHub, autorização de equipe/sala, SQLite em arquivo e migrações SQL. |

O editor não depende de uma conta nem de servidor. Um rascunho fica no navegador. A UI não contém regras de formato: elas entram por um `Ruleset` versionado.

## Depois

Contas, salas, torneios e resultados usam API Bun + Elysia separada do Vite e um arquivo SQLite local. A API é a única camada que guarda segredos e acessa esse arquivo. As rotas mantêm os contratos Fetch/Response; os IDs, validação, autorização e transações vivem no backend. A transação usa `BEGIN IMMEDIATE` e a conexão serializa as queries assíncronas de cada processo, preservando as seções críticas sem sintaxe PostgreSQL `FOR UPDATE`. O armazenamento local não suporta escrita entre várias instâncias da aplicação.

O comando local e o smoke test do CI rodam no Bun 1.4.3. As funções Vercel em `api/` exportam a aplicação Elysia para `/api` e subcaminhos, mas respondem `503 persistent_storage_required` antes de abrir SQLite: seu filesystem de função é efêmero e não compartilhado. O frontend pode servir páginas, sem oferecer salvamento comunitário nessa hospedagem. `vercel.json` seleciona `bunVersion: "1.x"`. Localmente, `APP_ORIGIN` configura OAuth/cookies; `VERCEL_ENV` continua prevalecendo sobre `APP_ENV` e impede a rota de sessão de teste em deployment. O rate limit permanece por processo e a limpeza horária só é confiável enquanto a API local está ativa; a versão serverless não está habilitada para escrita.

`apps/api/src/db.js` resolve `SPINDA_DB_PATH` em relação à raiz do repositório; sem a variável usa `.local/spinda-stop.sqlite`. A conexão liga e verifica foreign keys, define `busy_timeout=5000`, WAL e `synchronous=FULL`, e aplica permissão de arquivo `0600`. Migrações versionadas com SHA ficam em `apps/api/migrations/`; alterações de schema são um comando explícito, nunca executadas em requisição. SQLite não tem papéis por tabela: o processo Bun local tem acesso de leitura, escrita e DDL ao arquivo. O boundary de DDL é o usuário/permissão do arquivo e o comando separado de migração, não uma credencial de runtime restrita.

Os testes da API criam bancos SQLite temporários e apagam seus diretórios; CI não requer PostgreSQL, serviço de banco nem Docker. Rotinas de backup usam `VACUUM INTO` para não separar os sidecars WAL do snapshot. Instruções completas e semântica de conversão ficam em [SQLite local](SQLITE_LOCAL.md). Nenhuma base Postgres externa foi consultada, alterada ou removida; não foi possível confirmar se há dados em outra conta ou serviço.

O fornecedor de dados competitivos fica atrás de uma interface `MetaProvider`. Isso permite desligar uma fonte ou mostrar cobertura parcial sem misturar dados de formatos e temporadas diferentes.

## Uso competitivo

O piloto de Usage fica em `apps/web/src/data/usage/providers/`. A tela depende do contrato do provedor (`loadIndex` e `loadPokemonUsage`), enquanto o adaptador Pokémon Champions Battle Data faz as chamadas e normaliza apenas os campos usados pela interface. Outra fonte pode implementar o mesmo contrato sem entrar nos componentes.

O navegador lê `/api` e, para a espécie selecionada, `/api/battle/Doubles/{showdownId}`. A resposta fica em cache somente na memória por cinco minutos, com até 16 entradas; o navegador não grava uma cópia HTTP. Não há endpoint próprio do Spinda Stop nem arquivo espelho. MetaRoll continua fora deste provedor.

O índice compacto preserva o número de ordem da fonte, total dos seis stats-base e relação direta de espécie. `pokemon_evolution.csv` agrega método, condições nomeadas e grupos de versão quando os campos coincidem; aprendibilidade permanece em blocos por ID exato de forma. Nenhum desses campos declara elegibilidade em Champions. As imagens usam `apps/web/src/components/PokemonSprite.jsx` e `data/pokemonSprites.js`. A PokéAPI fornece um ID de sprite separado do número nacional; formas alternativas usam o ID próprio de Pokémon, com fallback explícito quando o asset não existe. Sprites de listas carregam sob demanda. A revisão da coleção e os créditos estão em `docs/THIRD_PARTY_LICENSES.md`.
