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
- **Lint/build:** `npm run lint` e `npm run build` passaram. `npm test`: 119 testes, 114 aprovados e 5 ignorados.

### Integrações PostgreSQL

No `npm test` local, sem `DATABASE_URL`, os quatro fluxos funcionais são pulados. O quinto item ignorado é só o teste sentinela que explica a falta de `DATABASE_URL`; não representa uma quinta integração.

O container local não permite preparar PostgreSQL 16 conforme `DEVELOPMENT.md`: a configuração falhou com `Cannot open audit interface` ao executar `groupadd`; trocar de usuário falhou com `setgroups: Operation not permitted` e `setresuid: Invalid argument`; `pg_isready -h 127.0.0.1 -p 5432` retornou `no response`. Nenhum `.env`, banco ou credencial de produção foi lido ou usado.

A CI #170 rodou no PostgreSQL 16 descartável declarado em `.github/workflows/ci.yml`. `npm run api:migrate` passou e os quatro casos funcionais passaram: equipe autenticada/sala com duas pessoas, torneio privado com quatro pessoas, rejeição de escrita de outra origem e estado OAuth de uso único com sessão. `npm test` terminou com 118 testes aprovados, zero falhas e zero skips. Contas, salas, torneios, CORS e OAuth ficam verificados pela integração da CI; o ambiente local continua sem servidor de banco.

### Revisão visual local

O passe visual anterior permanece preservado: a revisão #120 falhou por sete verificações de layout mobile (controles de Speed, identidade da linha de Usage e conteúdo da barra A/B, inclusive em 320 px); as correções subsequentes passaram na Visual review #123. Nesta continuação, `npm run visual:review` recompilou o app, mas parou ao lançar Chromium porque o executável de Playwright não estava instalado. A instalação oficial tentou baixar o browser e recebeu arquivo vazio/incompleto (`End of central directory record signature not found`). O Chrome de inspeção também não conseguiu alcançar uma porta local isolada do sandbox. Assim, o build e os testes de lógica passaram, mas a ficha/galeria nova ainda requer inspeção visual num runner com Chromium.

Não houve merge nem deploy.
