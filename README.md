# Spinda Stop

Uma oficina independente para explorar Pokémon, montar times e organizar encontros da comunidade de Pokémon Champions. Doubles é o primeiro formato. O projeto não tem vínculo com The Pokémon Company, Nintendo, Creatures ou GAME FREAK.

A interface usa cores de arena, molduras em degraus e sprites de Pokémon carregados da revisão fixa de PokeAPI/sprites. O Spinda Black/White `327.png` aparece no cabeçalho e no favicon pela mesma URL versionada. Os direitos das imagens pertencem a seus titulares; consulte [origens e créditos](docs/THIRD_PARTY_LICENSES.md). O Spinda Stop é um projeto de fã independente.

## O que já funciona

- Buscar espécies e formas, filtrar por tipo ou geração e abrir uma ficha de dados gerais.
- Montar seis posições com habilidade, item, nature, golpes e campos de Stat Points; abrir Usage por integrante sem alterar o set.
- Simular dano em nível 50 para Singles ou Doubles, comparar cenários e ver rolls, modificadores e Stat Points usados pelo motor.
- Comparar Speed calculada no catálogo ou os seis integrantes do builder contra um alvo, sem confundir tiers calculados com ranking de uso.
- Comparar um atacante contra vários alvos com o mesmo set defensivo; cada dano aparece separadamente.
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

As partidas continuam acontecendo dentro do jogo. O site organiza participantes e relatos voluntários; não se conecta ao Pokémon Champions nem cria serviços oficiais. Localmente, a API comunitária usa um arquivo SQLite em disco. Login GitHub é opcional para desenvolvimento e depende de um OAuth App próprio.

## Rodar localmente

Requer Node.js 22.12 ou mais recente e Bun 1.4.3 para a API comunitária.

```sh
npm ci
npm run api:migrate
```

Em um terminal:

```sh
npm run api:start
```

Em outro terminal:

```sh
npm run dev
```

O banco local fica em `.local/spinda-stop.sqlite` e é ignorado pelo Git. A migração não exige Docker nem servidor de banco. Veja [Desenvolvimento](DEVELOPMENT.md#api-comunitária) para OAuth, backup, restauração e reset. A API em funções Vercel responde `503` até o projeto escolher uma hospedagem com armazenamento persistente; um deployment `Ready` do frontend não significa que as rotas comunitárias salvam dados.

Na primeira execução, o catálogo é gerado a partir de uma revisão fixa da PokéAPI e guardado localmente. `npm run dev` e `npm run build` sincronizam o catálogo; se for rodar `npm test` antes deles, use `npm run data:sync` uma vez. Depois rode `npm run lint`, `npm test` e `npm run build` para conferir o projeto.

Os testes de integração criam bancos SQLite temporários e não dependem de banco externo. Para autenticação GitHub interativa, configure um OAuth App local; sem credenciais, contas ficam indisponíveis, mas o site e os fluxos de teste continuam locais.

## Documentação

- [Fontes e atribuições](docs/DATA_SOURCES.md)
- [Avaliação das APIs competitivas](docs/META_SOURCES.md)
- [Matriz de cobertura competitiva, campos observados e próximos PRs](docs/COMPETITIVE_COVERAGE.md)
- [Regras e disponibilidade](docs/RULESETS.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [SQLite local: esquema, migrações, backup, recuperação e hospedagem](docs/SQLITE_LOCAL.md)
- [Direção visual](docs/DESIGN.md)
- [Guia geral para evitar padrões visuais genéricos](docs/UI_HUMANIZER.md)
- [Design system do Spinda Stop e referências](docs/SPINDA_STOP_DESIGN_SYSTEM.md)
- [Speed Tiers e fórmulas](docs/SPEED_TIERS.md)
- [Registro da revisão visual](docs/VISUAL_REVIEW.md)
- [Pesquisa visual e referências (metadados; imagens fora do checkout)](docs/VISUAL_REFERENCE_RESEARCH.md)
- [Plano de validação da calculadora](docs/CALC_VALIDATION.md)
- [Regras e limites da calculadora de dano](docs/DAMAGE_CALCULATOR.md)
- [Como executar o oráculo independente da calculadora](DEVELOPMENT.md#oráculo-opcional-da-calculadora)
- [Licenças de dependências](docs/THIRD_PARTY_LICENSES.md)
- [Segurança e privacidade](docs/SECURITY.md)
- [Catálogo da auditoria de segurança e organização](docs/SECURITY_AUDIT.md)
- [Catálogo da revisão técnica](docs/TECHNICAL_REVIEW.md)
- [Próximas etapas](docs/ROADMAP.md)
- [Contas, salas, privacidade e torneios](docs/COMMUNITY_MODEL.md)

## Licenças

O MIT cobre o código original deste projeto. Nomes, personagens, sprites, dados e marcas de Pokémon continuam pertencendo aos respectivos titulares. A origem e o carregamento das imagens estão em [Licenças de dependências](docs/THIRD_PARTY_LICENSES.md).
