# Desenvolvimento

O frontend usa React, Vite, JavaScript e Tailwind. O domínio fica em funções sem dependência de React. A fase comunitária só adiciona API e banco quando contas, torneios e salas entrarem no escopo.

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
