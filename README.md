# Spinda Stop

Uma oficina independente para explorar Pokémon, montar times e, mais adiante, organizar torneios comunitários de Pokémon Champions. Doubles é o primeiro formato. O projeto não tem vínculo com The Pokémon Company, Nintendo, Creatures ou GAME FREAK.

## O que já funciona

- Buscar espécies e formas, filtrar por tipo ou geração e abrir uma ficha de dados gerais.
- Montar seis posições com habilidade, item, nature, golpes e campos de Stat Points.
- Salvar o rascunho neste navegador e importar ou exportar o formato JSON do projeto.

A PokéAPI fornece dados gerais; disponibilidade e legalidade no Champions seguem como desconhecidas até confirmação por formato e regulamento. Cada equipe aparece como rascunho.

As APIs de uso competitivo foram avaliadas, mas ainda não estão ligadas ao app. Os limites, termos e lacunas de amostra estão em [APIs de dados competitivos](docs/META_SOURCES.md).

## Próximas partes

- Análise de tipos e legalidade por regulamento.
- Dados competitivos com fonte, período e tamanho da amostra.
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
- [Regras e disponibilidade](docs/RULESETS.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Direção visual](docs/DESIGN.md)
- [Plano de validação da calculadora](docs/CALC_VALIDATION.md)
- [Segurança e privacidade](docs/SECURITY.md)
- [Próximas etapas](docs/ROADMAP.md)

## Licenças

O MIT cobre o código original deste projeto. Nomes, personagens, dados e marcas de Pokémon continuam pertencendo aos respectivos titulares. O repositório não inclui artes ou sprites de Pokémon.
