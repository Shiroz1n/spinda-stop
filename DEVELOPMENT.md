# Desenvolvimento

O frontend usa React, Vite, JavaScript e Tailwind. O domínio fica em funções sem dependência de React. A fase comunitária só adiciona API e banco quando contas, torneios e salas entrarem no escopo.

## Antes de começar

- Node.js 22.12 ou mais recente; Node 24 é a versão usada no desenvolvimento inicial.
- npm incluído com Node.

Os comandos de execução serão documentados junto da primeira entrega funcional. A sincronização do catálogo usa uma revisão fixa da PokéAPI e gera arquivos locais ignorados pelo Git.

## Fluxo de trabalho

Use uma branch por mudança. Rode `npm ci` a partir do lockfile; depois lint, testes e build. Se mudar interface, confira uma largura mobile e uma desktop, navegação por teclado, foco visível e zoom. Não publique o site nem conecte serviços externos sem uma decisão registrada.
