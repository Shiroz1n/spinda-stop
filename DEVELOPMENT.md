# Desenvolvimento

O frontend usa React, Vite, JavaScript e Tailwind. O domínio fica em funções sem dependência de React. Contas, salas e torneios usam uma API e banco separados do frontend.

## Antes de começar

- Node.js 22.12 ou mais recente; Node 24 é a versão usada no desenvolvimento inicial.
- npm incluído com Node.

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

## API comunitária

Contas, salas e torneios usam Node.js, PostgreSQL 16 e OAuth do GitHub. Nenhum segredo ou banco de produção fica no repositório.

1. Copie `.env.example` para `.env` e preencha `DATABASE_URL`, `APP_ORIGIN`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` e `FRIEND_CODE_ENCRYPTION_KEY`.
2. Em um terminal, inicie o PostgreSQL local: `docker compose up -d db`.
3. Aplique as migrações com `npm run api:migrate`.
4. Em um terminal, rode `npm run api:start`; em outro, rode `npm run dev`.
5. Registre no OAuth App do GitHub o callback `http://127.0.0.1:5173/api/auth/github/callback`.

Gere a chave de 32 bytes para códigos de amizade com `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'`. Mantenha a chave fora do Git e faça backup seguro; perder a chave torna os códigos ainda cifrados ilegíveis. O fluxo de teste automatizado usa um endpoint de sessão disponível somente com `APP_ENV=test` e exige loopback.

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
