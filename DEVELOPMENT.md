# Desenvolvimento

O frontend usa React, Vite, JavaScript e Tailwind. O domínio fica em funções sem dependência de React. Contas, salas e torneios usam uma API e banco separados do frontend.

## Antes de começar

- Node.js 22.12 ou mais recente; Node 24 é a versão usada no desenvolvimento inicial.
- npm incluído com Node.
- Bun 1.4.3 para iniciar a API e aplicar migrações; o frontend continua usando Node/npm.

O catálogo é gerado uma vez a partir da revisão fixa da PokéAPI `6fd69dfe90465ba96534f6816fc817737d1f97f6`. O JSON final fica em `packages/data/generated/` e é ignorado pelo Git.

`npm run dev` e `npm run build` sincronizam o catálogo automaticamente. Para rodar `npm test` antes de iniciar o frontend ou gerar um build, rode primeiro `npm run data:sync`.

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

O modo rápido preserva capturas, mede overflow e erros de aplicação e verifica foco/teclado nas rotas selecionadas. IDs: `home`, `dex` (`pokedex`), `pokemon` (`detail`), `usage`, `builder`, `calculator`, `speed` (`speed-tiers`), `rooms`, `tournaments`. O modo completo continua obrigatório antes de concluir uma PR: `npm run visual:review`. Ele mantém os cenários de todas as telas em 1440, 390, 320 e 720 px, axe e fluxos comunitários com SQLite temporário quando `SPINDA_DB_PATH` está configurado. A versão rápida não é equivalente ao gate completo. Veja [docs/VISUAL_REVIEW.md](docs/VISUAL_REVIEW.md).

## API comunitária

Contas, salas e torneios usam Bun 1.4.3, Elysia 1.4.x e SQLite em arquivo. Não é necessário instalar PostgreSQL, Docker ou outro serviço de banco.

1. Copie o modelo local: `cp .env.example .env`. `SPINDA_DB_PATH` controla o caminho; seu valor padrão é `.local/spinda-stop.sqlite`, absoluto em relação à raiz do repositório. O exemplo não contém credenciais reais.
2. Gere o banco e aplique as migrações: `npm run api:migrate`.
3. Inicie a API com `npm run api:start` em um terminal e o frontend com `npm run dev` em outro. O proxy Vite encaminha `/api` para Bun + Elysia em `127.0.0.1:8787`.
4. Confira `http://127.0.0.1:5173/api/health` e `http://127.0.0.1:5173/api/auth/status`.
5. Login GitHub interativo é opcional. Se for usar, configure seu OAuth App de desenvolvimento com callback `http://127.0.0.1:5173/api/auth/github/callback`. Para testar códigos de amizade, gere uma chave local de 32 bytes com `node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'` e guarde-a somente em `.env`.

Para backup consistente do banco em uso, `npm run api:backup` usa `VACUUM INTO`; o arquivo padrão fica em `.local-backups/`. Para restaurar, sempre use um destino novo: `npm run api:restore -- .local-backups/arquivo.sqlite .local/restaurado.sqlite`. Pare a API e rode `npm run api:reset` para recriar somente o banco de desenvolvimento padrão. O reset recusa caminho customizado, execução em Vercel e sidecars ativos. Não copie apenas o `.sqlite` durante o uso do modo WAL. Veja [SQLite local](docs/SQLITE_LOCAL.md) para detalhes de integridade, recuperação e dados preservados.

O endpoint de sessão automatizado existe somente em `APP_ENV=test`; `VERCEL_ENV` prevalece sobre `APP_ENV`, e as rotas Vercel `/api/*` retornam `503 persistent_storage_required` antes de abrir um arquivo local. O filesystem de funções Vercel não é armazenamento persistente. Não configure o SQLite no `/tmp` ou no bundle. O frontend pode ser servido, mas equipes, salas e torneios não salvam nesse deployment. Nenhum banco hospedado ou deploy manual foi configurado; a integração do repositório cria Preview automaticamente ao abrir/atualizar uma PR, e esse Preview não representa um backend persistente.

Os testes de API usam bancos temporários com migrações reais; CI não depende de serviço externo de banco. `npm run api:runtime:smoke` exercita o listener HTTP real do Bun e as rotas de saúde/sessão/lista de equipes. O rate limit continua no processo e a limpeza depende de um processo local persistente; a hospedagem pública segue bloqueada até armazenamento persistente, rate limiting compartilhado e limpeza agendada confiável.

Sem OAuth, Pokédex, builder local, Usage e calculadora continuam funcionando; os recursos de conta ficam indisponíveis. Leia [Segurança](docs/SECURITY.md) e [Modelo comunitário](docs/COMMUNITY_MODEL.md) antes de abrir esses fluxos ao público.

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
