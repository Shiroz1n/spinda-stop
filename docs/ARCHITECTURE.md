# Arquitetura

## Primeira entrega

| Área | Responsabilidade |
|---|---|
| `apps/web` | Rotas, telas, componentes e persistência local do rascunho. |
| `packages/domain` | Busca, estrutura de equipe e importação/exportação; funções puras. |
| `packages/data` | Importador versionado da PokéAPI, índice compacto da Dex, ficha e blocos de aprendibilidade/evolução. Dados gerados ficam fora do Git. |
| `apps/api` | API Bun + Elysia, OAuth do GitHub, autorização de equipe/sala, MySQL e migrações SQL. |

O editor não depende de uma conta nem de servidor. Um rascunho fica no navegador. A UI não contém regras de formato: elas entram por um `Ruleset` versionado.

## Depois

Contas, salas, torneios e resultados usam API Bun + Elysia separada do Vite, MySQL/InnoDB e transações. A API é a única camada que guarda segredos e acessa o banco. As rotas mantêm seus contratos por um adaptador Fetch/Response; UUIDs gerados na aplicação substituem `RETURNING`, `?` parametriza valores e `ON DUPLICATE KEY UPDATE` substitui upserts PostgreSQL. Horários são UTC em `DATETIME(3)`; JSON fica em colunas `JSON`; IDs UUID usam `CHAR(36) ascii_general_ci` para manter a comparação sem distinção de caixa do tipo UUID no PostgreSQL, enquanto tokens/hash usam collation binária. Transições anteriormente acionadas por triggers foram movidas para operações explícitas na mesma transação da API. OAuth e código de amizade são configurados por ambiente. O banco MySQL remoto de Preview ainda não foi criado.

O comando local e o smoke test do CI rodam no Bun 1.4.3. As funções Vercel em `api/` exportam a mesma aplicação Elysia para `/api` e seus subcaminhos; `vercel.json` seleciona `bunVersion: "1.x"`. Quando `APP_ORIGIN` não foi informado, Preview e Production derivam a origem dos hosts Vercel correspondentes. `VERCEL_ENV` prevalece sobre `APP_ENV`, mantendo rotas de sessão de teste fora de Preview/Production. O limite de tentativas grava apenas o HMAC-SHA-256 da rota/endereço em `api_rate_limits` e usa upsert atômico para compartilhar contadores entre funções; `RATE_LIMIT_HASH_SECRET` é obrigatório em Vercel. `GET /api/cron/cleanup`, protegido por `CRON_SECRET`, substitui o timer local na operação Vercel; o cron diário executa apenas em Production. Exportação/exclusão de conta, retenção e resposta a incidentes ainda precisam de decisão antes de abrir os fluxos ao público.

O pool de runtime usa `mysql2/promise`, lê `DATABASE_URL`, exige TLS para conexões remotas, limita a dois sockets por instância Vercel e define UTC em cada sessão reutilizada. Migrações leem `DATABASE_MIGRATION_URL` (com fallback apenas para compatibilidade local) e usam lock nomeado, checksums e DDL idempotente; cada DDL pode fazer commit implícito, portanto uma migração incompleta é retomável, não uma transação reversível. CI usa MySQL 8.4 efêmero, migra com credencial administrativa e prepara um usuário de runtime sem DDL, grant option ou acesso à auditoria. `npm run api:db:prepare` é restrito a desenvolvimento/teste local; a URL de migração não deve ficar nas variáveis da função Vercel.

O fornecedor de dados competitivos fica atrás de uma interface `MetaProvider`. Isso permite desligar uma fonte ou mostrar cobertura parcial sem misturar dados de formatos e temporadas diferentes.

## Uso competitivo

O piloto de Usage fica em `apps/web/src/data/usage/providers/`. A tela depende do contrato do provedor (`loadIndex` e `loadPokemonUsage`), enquanto o adaptador Pokémon Champions Battle Data faz as chamadas e normaliza apenas os campos usados pela interface. Outra fonte pode implementar o mesmo contrato sem entrar nos componentes.

O navegador lê `/api` e, para a espécie selecionada, `/api/battle/Doubles/{showdownId}`. A resposta fica em cache somente na memória por cinco minutos, com até 16 entradas; o navegador não grava uma cópia HTTP. Não há endpoint próprio do Spinda Stop nem arquivo espelho. MetaRoll continua fora deste provedor.

O índice compacto preserva o número de ordem da fonte, total dos seis stats-base e relação direta de espécie. `pokemon_evolution.csv` agrega método, condições nomeadas e grupos de versão quando os campos coincidem; aprendibilidade permanece em blocos por ID exato de forma. Nenhum desses campos declara elegibilidade em Champions. As imagens usam `apps/web/src/components/PokemonSprite.jsx` e `data/pokemonSprites.js`. A PokéAPI fornece um ID de sprite separado do número nacional; formas alternativas usam o ID próprio de Pokémon, com fallback explícito quando o asset não existe. Sprites de listas carregam sob demanda. A revisão da coleção e os créditos estão em `docs/THIRD_PARTY_LICENSES.md`.
