# Spinda Stop

Uma oficina independente para explorar Pokémon, montar times e, mais adiante, organizar torneios comunitários de Pokémon Champions. Doubles é o primeiro formato. O projeto não tem vínculo com The Pokémon Company, Nintendo, Creatures ou GAME FREAK.

## O que já funciona

- Buscar espécies e formas, filtrar por tipo ou geração e abrir uma ficha de dados gerais.
- Montar seis posições com habilidade, item, nature, golpes e campos de Stat Points.
- Salvar o rascunho neste navegador e importar ou exportar o formato JSON do projeto.
- Explorar Usage de Doubles por espécie, tipo e categoria, com dados da API Pokémon Champions Battle Data.

A PokéAPI fornece dados gerais; disponibilidade e legalidade no Champions seguem como desconhecidas até confirmação por formato e regulamento. Cada equipe aparece como rascunho.

Usage mostra a fonte e o período que a API informa. “Current” é o rótulo da fonte; não confirma um regulamento oficial. Os percentuais não vêm com denominador conhecido e não são tratados como porcentagem de partidas. MetaRoll segue documentada como alternativa separada, sem mistura de números.

## Próximas partes

- Análise de tipos e legalidade por regulamento.
- Mais fontes competitivas, quando seus campos, cobertura e condições estiverem confirmados.
- Matchups e calculadora de dano com casos de referência.
- Eventos comunitários com inscrição, pareamento e confirmação de resultados.

As partidas continuam acontecendo dentro do jogo. O site organiza equipes e eventos; não cria partidas ou serviços oficiais do Pokémon Champions.

## Rodar localmente

Requer Node.js 22.12 ou mais recente.

```sh
npm ci
npm run dev
```

Na primeira execução, o catálogo é gerado a partir de uma revisão fixa da PokéAPI e guardado localmente. Depois de instalar, rode `npm run lint`, `npm test` e `npm run build` para conferir o projeto.

## Documentação

- [Fontes e atribuições](docs/DATA_SOURCES.md)
- [Avaliação das APIs competitivas](docs/META_SOURCES.md)
- [Matriz de cobertura competitiva, campos observados e próximos PRs](docs/COMPETITIVE_COVERAGE.md)
- [Regras e disponibilidade](docs/RULESETS.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Direção visual](docs/DESIGN.md)
- [Plano de validação da calculadora](docs/CALC_VALIDATION.md)
- [Segurança e privacidade](docs/SECURITY.md)
- [Próximas etapas](docs/ROADMAP.md)

## Licenças

O MIT cobre o código original deste projeto. Nomes, personagens, dados e marcas de Pokémon continuam pertencendo aos respectivos titulares. O repositório não inclui artes ou sprites de Pokémon.
