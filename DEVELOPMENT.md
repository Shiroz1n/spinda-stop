# Desenvolvimento

O frontend usa React, Vite, JavaScript e Tailwind. O domínio fica em funções sem dependência de React. Contas, salas e torneios usam uma API e banco separados do frontend.

## Antes de começar

- Node.js 22.12 ou mais recente; Node 24 é a versão usada no desenvolvimento inicial.
- npm incluído com Node.
- Bun 1.4.3 para iniciar a API e aplicar migrações; o frontend continua usando Node/npm.

O catálogo é gerado uma vez a partir da revisão fixa da PokéAPI `6fd69dfe90465ba96534f6816fc817737d1f97f6`. O JSON final fica em `packages/data/generated/` e é ignorado pelo Git.

## Fluxo de trabalho

```sh
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Use uma branch por mudança. Se mudar interface, confira uma largura mobile e uma desktop, navegação por teclado, foco visível e zoom. O primeiro `dev` ou `build` baixa os CSVs fixados em `packages/data/scripts/sync-pokedex.mjs`. Não publique o site nem conecte serviços externos sem uma decisão registrada.

## Revisão visual

Durante o desenvolvimento, rode somente as rotas afetadas nas larguras 1440 e 390 px:

```sh
npm run visual:review:fast -- --pages=calculator,builder
# ou VISUAL_REVIEW_PAGES=calculator,builder npm run visual:review:fast
```

O modo rápido preserva screenshots, mede overflow e erros de aplicação, e verifica foco/teclado nas rotas selecionadas. IDs: `home`, `dex` (`pokedex`), `pokemon` (`detail`), `usage`, `builder`, `calculator`, `speed` (`speed-tiers`), `rooms`, `tournaments`. O modo completo continua obrigatório antes de concluir uma PR: `npm run visual:review`. Ele mantém os cenários de todas as telas em 1440, 390, 320 e 720 px, axe e fluxos comunitários com PostgreSQL quando `DATABASE_URL` está configurada. A versão rápida não é equivalente ao gate completo. Veja [docs/VISUAL_REVIEW.md](docs/VISUAL_REVIEW.md).

## API comunitária

Contas, salas e torneios usam Bun 1.4.3, Elysia 1.4.x, PostgreSQL 16 e OAuth do GitHub. Nenhum segredo ou banco de produção fica no repositório.

1. Copie `.env.example` para `.env`. `DATABASE_URL` é a conta limitada de runtime; `DATABASE_MIGRATION_URL` é a conta local de migrações. Mantenha `POSTGRES_PASSWORD` alinhada com a URL de migração. Preencha `APP_ORIGIN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` e, se quiser testar códigos de amizade, `FRIEND_CODE_ENCRYPTION_KEY`.
2. Em um terminal, inicie o PostgreSQL local: `docker compose up -d db`.
3. Aplique as migrações com `npm run api:migrate` e prepare o usuário de runtime local com `npm run api:db:prepare`. Esse comando só aceita `localhost`, loopback ou o serviço local `postgres`, e recusa execução em Vercel.
4. Em um terminal, rode `npm run api:start`; em outro, rode `npm run dev`.
5. Registre no OAuth App do GitHub o callback `http://127.0.0.1:5173/api/auth/github/callback`.

Gere a chave de 32 bytes para códigos de amizade com `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'`. Mantenha a chave fora do Git e faça backup seguro; perder a chave torna os códigos ainda cifrados ilegíveis. O fluxo de teste automatizado usa um endpoint de sessão disponível somente com `APP_ENV=test` em execução local; `VERCEL_ENV` prevalece no deployment para impedir que ele seja habilitado em Preview ou Production.

O servidor Bun atende `/api` por Elysia. A função `npm run api:runtime:smoke` exercita o listener HTTP real em Bun; `npm test` verifica os mesmos contratos de rota pelo Fetch do Elysia. No Vercel, `/api` e seus subcaminhos entram nas funções definidas em `api/`, usando `bunVersion` do `vercel.json`. Preview sem `DATABASE_URL` responde `503` com uma mensagem de serviço não configurado. Use um PostgreSQL separado para Preview; não aponte testes de PR ao banco de produção. OAuth em Preview exige credenciais e callback compatíveis com a origem daquele ambiente.

Em CI, `DATABASE_URL` aponta para um papel de runtime limitado e `DATABASE_MIGRATION_URL` para a instância PostgreSQL efêmera da migração. A suíte usa a URL de migração apenas para montar e limpar fixtures; a aplicação de teste conecta com a URL de runtime. Em Vercel, configure somente `DATABASE_URL` com um login sem DDL; não configure a URL de migração nem execute `api:db:prepare`. Provisionar o papel limitado em um banco remoto é uma operação do administrador do banco e não foi feita nesta revisão.

A mudança para Elysia não conclui a preparação para abrir a API publicamente. O limite de tentativas continua local a cada instância e a limpeza horária do servidor persistente não é executada de forma confiável em funções serverless. Revise [Segurança](docs/SECURITY.md) e [Modelo comunitário](docs/COMMUNITY_MODEL.md) antes de habilitar esses fluxos em produção.

Sem credenciais OAuth, Pokédex, builder local, Usage e calculadora continuam funcionando; contas ficam indisponíveis. Não configure a API de produção a partir deste guia sem revisar `docs/SECURITY.md` e `docs/COMMUNITY_MODEL.md`.

## Oráculo opcional da calculadora

`npm run validate:damage-oracle` compara os cálculos com o simulador de Pokémon Showdown no commit fixado em `docs/CALC_VALIDATION.md`. Esse clone de desenvolvimento não é dependência do app nem faz parte de `npm test`:

```sh
git clone https://github.com/smogon/pokemon-showdown.git /tmp/pokemon-showdown
git -C /tmp/pokemon-showdown checkout f0e61e58ad297885578231746036438e1b42f40a
npm ci --prefix /tmp/pokemon-showdown
npm run build --prefix /tmp/pokemon-showdown
POKEMON_SHOWDOWN_ROOT=/tmp/pokemon-showdown npm run validate:damage-oracle
```

Use Node 22.18 ou mais recente para compilar esse commit do simulador. O comando confere 16 rolls por caso e rejeita qualquer SHA diferente.
