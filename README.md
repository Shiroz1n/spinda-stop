# Spinda Stop

Uma oficina independente para explorar Pokémon, montar times e organizar encontros da comunidade de Pokémon Champions. Doubles é o primeiro formato. O projeto não tem vínculo com The Pokémon Company, Nintendo, Creatures ou GAME FREAK.

A interface usa cores de arena, molduras em degraus e sprites de Pokémon carregados da revisão fixa de PokeAPI/sprites. O Spinda Black/White `327.png` aparece no cabeçalho e no favicon pela mesma URL versionada. Os direitos das imagens pertencem a seus titulares; consulte [origens e créditos](docs/THIRD_PARTY_LICENSES.md). O Spinda Stop é um projeto de fã independente.

## O que já funciona

- Buscar espécies e formas, filtrar por tipo ou geração e abrir uma ficha de dados gerais.
- Montar seis posições com habilidade, item, nature, golpes e campos de Stat Points; abrir Usage por integrante sem alterar o set.
- Simular dano em nível 50 para Singles ou Doubles, comparar cenários e ver rolls, modificadores e Stat Points usados pelo motor.
- Salvar o rascunho neste navegador e importar ou exportar o formato JSON do projeto.
- Entrar com GitHub para salvar cópias privadas ou públicas de equipes e organizar salas de duas pessoas ou torneios privados de quatro, com convite, check-in e resultados confirmados manualmente.
- Explorar Usage de Doubles por espécie, com filtros e fichas de Pokémon Champions Battle Data ou MetaRoll em telas separadas; a MetaRoll também publica matchups e ladder de jogadores.
- Conferir cenários representativos da calculadora contra os rolls do simulador Pokémon Showdown fixado; essa checagem valida concordância entre implementações, não uma partida real no jogo.

A PokéAPI fornece dados gerais; disponibilidade e legalidade no Champions seguem como desconhecidas até confirmação por formato e regulamento. Cada equipe aparece como rascunho.

Usage mostra a fonte e o período que cada API informa. “Current” e nomes de temporada são rótulos da fonte, não regulamentos oficiais. Os percentuais da Battle Data não têm denominador conhecido; MetaRoll define distribuições como parcela das aparições do Pokémon. Nenhuma tela combina números das duas fontes.

## Próximas partes

- Ampliar a validação da calculadora sem tratar o motor como uma reprodução perfeita do jogo.
- Novos campos MetaRoll somente depois de confirmar a semântica e os termos de uso.
- Ampliar torneios comunitários sem abrir mão de confirmação de resultados e controles de privacidade.

As partidas continuam acontecendo dentro do jogo. O site organiza participantes e relatos voluntários; não se conecta ao Pokémon Champions nem cria serviços oficiais. A API comunitária precisa de PostgreSQL e OAuth do GitHub configurados pelo operador.

## Rodar localmente

Requer Node.js 22.12 ou mais recente.

```sh
npm ci
npm run dev
```

Na primeira execução, o catálogo é gerado a partir de uma revisão fixa da PokéAPI e guardado localmente. Depois de instalar, rode `npm run lint`, `npm test` e `npm run build` para conferir o projeto.

Para testar contas, salas e torneios localmente, veja [Desenvolvimento](DEVELOPMENT.md#api-comunitária). O fluxo exige PostgreSQL local e credenciais OAuth do GitHub; sem essas credenciais, a tela explica que o login está indisponível. A CI executa os testes de integração com PostgreSQL 16.

## Documentação

- [Fontes e atribuições](docs/DATA_SOURCES.md)
- [Avaliação das APIs competitivas](docs/META_SOURCES.md)
- [Matriz de cobertura competitiva, campos observados e próximos PRs](docs/COMPETITIVE_COVERAGE.md)
- [Regras e disponibilidade](docs/RULESETS.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Direção visual](docs/DESIGN.md)
- [Registro da revisão visual](docs/VISUAL_REVIEW.md)
- [Plano de validação da calculadora](docs/CALC_VALIDATION.md)
- [Regras e limites da calculadora de dano](docs/DAMAGE_CALCULATOR.md)
- [Como executar o oráculo independente da calculadora](DEVELOPMENT.md#oráculo-opcional-da-calculadora)
- [Licenças de dependências](docs/THIRD_PARTY_LICENSES.md)
- [Segurança e privacidade](docs/SECURITY.md)
- [Próximas etapas](docs/ROADMAP.md)
- [Contas, salas, privacidade e torneios](docs/COMMUNITY_MODEL.md)

## Licenças

O MIT cobre o código original deste projeto. Nomes, personagens, sprites, dados e marcas de Pokémon continuam pertencendo aos respectivos titulares. A origem e o carregamento das imagens estão em [Licenças de dependências](docs/THIRD_PARTY_LICENSES.md).
