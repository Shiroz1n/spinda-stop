# Continuação funcional do PR #28

Revisão em 20/10/2026, branch `feat/visual-pass-two`, sobre o HEAD remoto conferido antes das alterações. O PR permanece aberto. Esta rodada complementa o passe visual anterior; não reabre nem substitui seus commits.

## Inventário aplicado

- **Pokédex e variantes (a):** catálogo geral, formas, busca e filtros existentes foram preservados.
- **Evolução direta (b):** a ficha agora liga pré-evolução, espécie selecionada e evoluções por ID de espécie. Usa `evolves_from_species_id` da revisão fixa da PokéAPI; não apresenta condições de evolução.
- **Galeria normal/brilhante da forma exata (c):** continua como trabalho futuro até confirmar direito de redistribuição, cobertura shiny por forma, atribuição e fallback. A ficha não mostra um espaço vazio.
- **Relações de tipo (a):** multiplicadores gerais de tipo permanecem na ficha. Não representam efeitos situacionais de habilidade, item, clima ou golpe.
- **Aprendibilidade de golpes (b):** ficha exata da forma com filtros por nome, jogo/versão, método, tipo e categoria; Scarlet/Violet começa selecionado para evitar centenas de registros misturados, e “Todos os jogos” continua disponível. Cada linha pode preparar forma e golpe na calculadora. Os 32 blocos são carregados sob demanda por ID da forma; o maior no build desta revisão tem 379,69 KB sem compressão.
- **Legalidade/compatibilidade em Champions (c):** exige fonte autorizada por formato, regulamento, temporada e data. Os registros gerais da PokéAPI, inclusive Legends: Z-A, não respondem isso.
- **Dex → Usage/builder/calculadora (a, melhorada):** ações existentes foram mantidas e uma linha de golpe agora prepara forma e golpe na calculadora. O alvo continua em branco para a pessoa escolher.
- **Usage, ladder, salas, torneios e matchups (a):** os fluxos existentes foram preservados. Nenhuma margem de uso virou um set, rental ou equipe inferidos.
- **Rentals e equipes arquivadas (c):** dependem de fonte, direitos/condições e semântica de atualização confirmados.
- **Probabilidade e novos modos de calculadora (c):** dependem de contrato e validação; 16 rolls de dano não equivalem a probabilidade de partida.

## Clear Amulet: reprodução e correção

Reprodução: rascunho com Garchomp, `Clear Amulet` e `Earthquake` no modo **Time vs 1**. O texto é preservado no objeto do set e na importação/exportação; `toID("Clear Amulet")` retorna `clearamulet`. O nome existe no catálogo geral da geração 9 empacotado por `@smogon/calc` 0.12.0, mas não em `Generations.get(0)`, subconjunto que alimenta o cálculo de Champions. Portanto, a causa era a cobertura parcial do catálogo do motor, não normalização nem importação.

Agora as sugestões de item incluem nomes do catálogo geral de geração 9 e do subconjunto Champions. O adaptador classifica o item antes de calcular:

- Item do subconjunto Champions: o motor recebe o item e aplica os efeitos que conhece.
- `Clear Amulet`: reconhecido no catálogo geral, ausente do subconjunto Champions. O cálculo pontual recebe os stats/estágios informados e não simula quedas de atributo causadas pelo oponente; o nome permanece na ficha e uma nota contextual explica por que não foi passado ao motor. A fonte oficial descreve a proteção contra quedas de stats; isso não confirma disponibilidade em Champions. [Referência oficial sobre o item em VGC](https://www.pokemon.com/uk/features/top-new-pokemon-for-regulation-set-d-battles-in-the-video-game-championships).
- Item conhecido fora do subconjunto com possível efeito no dano/sequência, como `Choice Specs`: cálculo daquele integrante bloqueado, com razão explícita.
- Texto que não aparece nos catálogos consultados: estado `unknown-item`; nenhum dano é produzido e a mensagem não o chama de ilegal.

Disponibilidade e legalidade em Champions continuam **não verificadas**. O aviso não descarta silenciosamente um efeito que mude a faixa; itens não modelados com possível efeito bloqueiam o resultado.

## Fixture de seis integrantes

`apps/web/test/fixtures/calculator-team.js` registra a fixture de regressão. `apps/web/test/fixtures/verified-sv-learnset.json` contém as 24 linhas por forma/golpe extraídas de `pokemon_moves.csv` na revisão fixa, para Scarlet/Violet. O teste confirma espécie/forma, habilidade presente no catálogo geral, quatro nomes de golpes, Nature, item, distribuição de SP, importação/exportação e cálculo.

| Forma | Habilidade | Item de cenário | Nature / SP | Quatro golpes e método registrado em Scarlet/Violet |
|---|---|---|---|---|
| Garchomp, padrão | Rough Skin | Clear Amulet | Jolly · HP 2, Atk 32, Spe 32 | Earthquake (máquina), Dragon Claw (nível 42), Swords Dance (máquina), Protect (máquina) |
| Arboliva, padrão | Seed Sower | Leftovers | Calm · HP 22, Def 16, SpD 28 | Energy Ball (nível 34), Dazzling Gleam (máquina), Earth Power (máquina), Protect (máquina) |
| Incineroar, padrão | Intimidate | Life Orb | Impish · HP 32, Def 16, SpD 18 | Flare Blitz (nível 58), Fake Out (ovo), Parting Shot (ovo), Knock Off (máquina) |
| Rillaboom, padrão | Grassy Surge | Sitrus Berry | Adamant · HP 4, Atk 32, Spe 30 | Grassy Glide (máquina), Wood Hammer (nível 46), U-turn (máquina), Protect (máquina) |
| Charizard, padrão | Solar Power | Life Orb | Timid · HP 2, SpA 32, Spe 32 | Heat Wave (nível 1), Air Slash (método level-up; nível não informado), Dragon Claw (nível 1), Protect (máquina) |
| Pelipper, padrão | Drizzle | Focus Sash | Bold · HP 32, Def 32, SpD 2 | Hurricane (nível 55), Hydro Pump (nível 62), Tailwind (nível 1), Protect (nível 1) |

A fonte comprova que cada golpe listado aparece individualmente na aprendibilidade geral da forma em Scarlet/Violet. Ela não comprova que os quatro coexistam no mesmo indivíduo ou que o set seja obtenível/legal num regulamento. Nature, itens e SP são dados explícitos do cenário de teste; as marginais de Usage não foram combinadas para inventar um time. **A legalidade dos seis sets em Pokémon Champions não foi verificada.**

## Verificação funcional

- **1 vs 1:** Garchomp Jolly com Life Orb usa Earthquake contra Gardevoir-Mega. Uma mudança de Nature/SP/campo altera os rolls; os 16 rolls continuam acessíveis.
- **1 vs vários:** o mesmo atacante contra Garchomp e Gardevoir-Mega mantém resultado e 16 rolls independentes por alvo; item, Nature e campo são editáveis.
- **Time vs 1:** os seis integrantes e quatro golpes são calculados contra o mesmo alvo, com 16 rolls por golpe de dano. Mudanças de golpe, Nature, item, habilidade, SP e campo alteram o cálculo correspondente. Erro por item desconhecido ou sem suporte não impede os outros cinco.
- **Importar/exportar:** `serializeTeam` seguido de `parseTeam` preserva forma, habilidade, item, Nature, quatro campos de golpe e SP nos seis slots.
- **Motor:** `@smogon/calc` continua fixado em 0.12.0; não houve alteração na dependência.
- **Lint/build:** `npm run lint` e `npm run build` passaram. `npm test` local: 120 testes, 115 aprovados e 5 ignorados sem `DATABASE_URL`.

### Integrações PostgreSQL

No `npm test` local, sem `DATABASE_URL`, os quatro fluxos funcionais são pulados. O quinto item ignorado é só o teste sentinela que explica a falta de `DATABASE_URL`; não representa uma quinta integração.

O ambiente local atual não tem `docker`, `podman`, `postgres`, `initdb`, `pg_ctl`, `psql` ou `pg_isready`, e não há servidor PostgreSQL escutando. A migração foi tentada apenas com uma URL local de teste (`postgres://spinda:spinda-local@127.0.0.1:5432/spinda_stop`) e retornou `Error: connect ECONNREFUSED 127.0.0.1:5432`. Nenhum `.env`, banco ou credencial de produção foi lido ou usado.

A [CI #172](https://github.com/Shiroz1n/spinda-stop/actions/runs/39412075481) e a [CI #173](https://github.com/Shiroz1n/spinda-stop/actions/runs/39413881604) rodaram no PostgreSQL 16 descartável declarado em `.github/workflows/ci.yml`; migração e os quatro casos funcionais passaram. A [CI #174](https://github.com/Shiroz1n/spinda-stop/actions/runs/39423050772), no HEAD de correção visual, também concluiu com sucesso `data:sync`, migração, lint, testes e build. Assim, as integrações de contas, salas, torneios, CORS e OAuth estão verificadas na CI; a execução local dessas integrações continua bloqueada pela ausência do servidor PostgreSQL.

### Revisão visual

O passe visual anterior permanece preservado: a revisão #120 falhou por sete verificações de layout mobile (controles de Speed, identidade da linha de Usage e conteúdo da barra A/B, inclusive em 320 px); as correções passaram na Visual review #123. Nesta continuação, a #126 encontrou três problemas na ficha: seletor ambíguo no teste, nome acessível do link de golpe diferente do texto visível e “Garchomp” quebrando em duas linhas a 320 px. O commit `40d85c3` ajustou o escopo dos seletores, alinhou o nome acessível e empilhou a linha evolutiva em telas estreitas.

A [Visual review #127](https://github.com/Shiroz1n/spinda-stop/actions/runs/39412075255) passou no HEAD `40d85c3`: 84 capturas, 310 observações, zero falhas, zero violações axe e zero overflow horizontal nas capturas auditadas. O roteiro também verificou a ordem de Tab dos filtros de golpe, o nome acessível da ação para a calculadora e foco de navegação/fonte nos quatro viewports.

Capturas selecionadas no artefato da #127: `desktop-pokemon-evolution.png`, `desktop-pokemon-learnset-filtered.png`, `mobile-pokemon-evolution.png`, `mobile-pokemon-learnset-filtered.png`, `mobile-320-pokemon-evolution.png` e `mobile-320-pokemon-learnset-filtered.png`. A inspeção manual confirmou que a relação evolutiva segue legível em 320 px e que os quatro filtros se empilham em duas colunas sem esconder o golpe ou a ação contextual. O artefato inclui ainda home, Dex, Usage, time de seis, três modos de dano, Speed, salas e torneios em 1440/390/320 px. O viewport de 720 CSS px testa reflow e **não é zoom real do navegador**.

Não foi possível abrir o app local no Chrome isolado desta sessão: embora o servidor Vite estivesse em execução no ambiente de trabalho, a porta local retornou `ERR_CONNECTION_REFUSED` no navegador. A consulta somente leitura à integração Vercel não encontrou projeto associado a `Shiroz1n/spinda-stop`, portanto não havia preview hospedado para abrir. O Chromium do runner Playwright do Actions gerou e inspecionou as capturas; isso não equivale a percorrer o app na sessão do Chrome. Também não foi possível aplicar zoom real. Não houve merge nem deploy.

### Revisão final do resultado Time vs 1

A inspeção manual do artefato [Visual review #129](https://github.com/Shiroz1n/spinda-stop/actions/runs/39423050770) comparou o pré-ajuste da #128 com o HEAD `da8ee8a`. A #129 passou com 84 PNGs, 314 observações, zero falhas, zero violações axe e nenhum overflow horizontal. Confirmou o resumo em grade 3×2 e as duas colunas de resultados em 1440 px; em 390/320 px, a lista tem uma coluna e os seis sprites permanecem identificáveis no resumo.

A inspeção manual encontrou outro problema que as verificações automatizadas não cobriam: a grade esticava a linha dos resultados até a altura do card com rolls abertos e deixava espaço sem uso ao lado. Também notei que o runner rotulava o perfil de 720 CSS px como zoom a 200% e o relatório afirmava uma equivalência. O commit `fb88fc2` alinha os cards ao topo e renomeia o perfil para `reflow-720`; remove o metadado de equivalência. A captura dessa largura continua sendo viewport de reflow; **não houve zoom real**.

O artefato [Visual review #130](https://github.com/Shiroz1n/spinda-stop/actions/runs/39425112022) passou em `fb88fc2`: 84 PNGs, 318 observações, zero falhas, zero violações axe e zero overflow. A inspeção manual final confirmou a grade sem esticar cards. Em 1440 px os seis resultados ficam em duas colunas, com o card de rolls alinhado ao topo; em 390 e 320 px ficam em uma coluna. Garchomp mostra os 16 rolls e a nota do Clear Amulet. A asserção de erro confirmou a orientação breve para o acesso com GitHub, mas a #130 não exportava esse estado como captura; `reflow-720` também não tem metadado de equivalência a zoom.

A [CI #175](https://github.com/Shiroz1n/spinda-stop/actions/runs/39425112029) passou no mesmo commit: sincronização, migração, lint, 120 testes (115 aprovados, cinco pulados sem banco local) e build. A CI usa PostgreSQL de teste para as integrações; localmente não há servidor PostgreSQL e a tentativa com URL local de teste foi recusada em `127.0.0.1:5432`.

Ao revisar o ZIP da #130, confirmei que alguns estados vazios e de erro eram exercitados e registrados como observações, mas não exportados como imagens representativas. Ampliei a suíte visual para salvar esses estados e um carregamento controlado do índice Usage.

A [Visual review #131](https://github.com/Shiroz1n/spinda-stop/actions/runs/39427397177) passou com 135 PNGs, 404 observações, zero falhas, zero violações axe e zero overflow: 36 capturas desktop e 33 em cada um dos viewports de 390, 320 e reflow-720. A inspeção manual encontrou no estado vazio do Speed do builder a 390/320 px uma instrução comprimida ao lado do botão de seleção do alvo. O ajuste no CSS empilha instrução e ação até 420 px; a checagem também compara a separação vertical, além dos limites horizontais. Lint, testes e build locais passaram novamente; os cinco testes de banco continuam pulados localmente pelo servidor indisponível. A CI e a revisão visual do último ajuste ainda serão registradas após concluir.

A [Visual review #132](https://github.com/Shiroz1n/spinda-stop/actions/runs/39429712406) passou com os mesmos 135 PNGs e 404 observações, sem falhas, axe ou overflow. As capturas de 390/320 confirmaram que a ação do Speed ficou abaixo da instrução. A inspeção visual também encontrou o rótulo e a explicação de Trick Room encostados em todas as larguras. O ajuste coloca checkbox e rótulo na primeira linha e a explicação abaixo; a suíte verifica o espaçamento.

A revisão final [Visual review #133](https://github.com/Shiroz1n/spinda-stop/actions/runs/39431965021), no commit `e8e9abc`, passou com 135 PNGs, 408 observações, zero falhas, zero violações axe e zero overflow horizontal: 36 capturas desktop e 33 em cada largura 390, 320 e reflow-720. A inspeção manual confirmou o rótulo de Trick Room legível, a ação do alvo abaixo da instrução em telas estreitas, os seis integrantes identificáveis e o resultado do Time vs 1 em duas colunas no desktop/uma no mobile. Também abriu as capturas de carregamento e erros de Usage, busca vazia da Dex, erro de salas e estado real do torneio. A `inspection.json` não contém metadado de zoom; 720 CSS px continua sendo apenas reflow.

Capturas selecionadas da #133: `desktop-calculator-team-vs-one.png`, `mobile-320-builder-empty-speed-target.png`, `mobile-builder-empty-speed-target.png`, `mobile-320-builder-six-members-first-fold.png`, `mobile-320-usage-index-loading.png`, `mobile-320-usage-metaroll-error.png`, `mobile-320-rooms-api-error.png` e `desktop-tournament-state-flow.png`. O pacote completo, o relatório e todas as larguras estão no artefato do [Actions #133](https://github.com/Shiroz1n/spinda-stop/actions/runs/39431965021).

A [CI #178](https://github.com/Shiroz1n/spinda-stop/actions/runs/39431964975) passou no mesmo commit, com `data:sync`, migração, lint, testes, build e PostgreSQL de teste efêmero. Localmente, `npm test` soma 120 testes: 115 aprovados e cinco pulados por falta de `DATABASE_URL`; a tentativa de usar PostgreSQL apenas em `127.0.0.1:5432` recebeu `ECONNREFUSED`. O build mantém o aviso existente do bundle da calculadora (~521,67 kB; ~126,02 kB gzip).

O Chrome desta sessão não conseguiu conectar à porta local do Vite (`ERR_CONNECTION_REFUSED`), e a integração Vercel não lista preview para o repositório. A revisão de interação e as capturas foram feitas no Chromium headless do runner, não em uma sessão de Chrome visível; zoom real também não foi exercitado. A densidade em 320 px, o espaço sob os atalhos da home e a posição dos controles de fonte/período antes da lista de Usage são os pontos mais úteis para sua avaliação visual final.
