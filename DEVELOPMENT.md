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
