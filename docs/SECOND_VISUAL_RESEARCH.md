# Segunda rodada visual — pesquisa e decisões

18/10/2026 · evidências de navegação interativa usadas para revisar o PR #28. As referências servem para comparar tarefas e hierarquia, não para reproduzir layout, texto, código ou estatísticas.

## Matriz de decisão

| Padrão observado | Problema concreto no Spinda Stop | Mudança implementada | Dados necessários |
| --- | --- | --- | --- |
| Pikalytics Speed Tiers filtra o catálogo por texto e abre a forma clicada; Champions Lab permite procurar uma espécie e abrir sua ficha | A Pokédex interrompia a exploração em páginas e deixava uma faixa vazia antes dos sprites | Removidos Anterior/Próxima; busca e filtros agora selecionam no catálogo completo e a lista renderiza 36 cards por lote, com sentinel, botão de contingência, estado de fim, sprite mais presente e texto de forma/tipos compacto. Sessão guarda filtros, quantidade carregada e scroll ao abrir a ficha | Catálogo local: ID, nome, forma, tipos, geração, stats e sprite mapeado |
| MetaRoll e Silph Scope mantêm ranking e ficha da espécie visíveis enquanto a lista é filtrada; os grupos de distribuições são navegáveis | Usage mostrava fonte, explicações e todas as distribuições como uma sequência longa | Fonte/período/consulta resumidos; contexto técnico expansível; categorias selecionáveis para golpes, itens, habilidades, naturezas, SP, parceiros e histórico; linhas sem percentual não recebem barra fictícia | Apenas campos reais da fonte ativa e do período selecionado; fornecedores continuam separados |
| Silph Scope Builder mantém slots e controles do set no mesmo fluxo; Pikalytics deixa ajustes de set próximos do integrante | Builder mobile empurrava a edição para baixo com regras, notas e ações secundárias | Ordem curta de escolher espécie → editar set → conferir SP; importar/exportar e limites ficam recolhidos no contexto; grade de seis slots continua visível em 320/390 px | Estado dos seis slots, moves, item, habilidade, nature e SP já mantidos localmente |
| Pikalytics e Silph Scope calculadora destacam os lados, golpe e resultado; ações sobre golpes recalculam o dano | A/B repetia dois formulários extensos e escondia o resultado atrás do editor | Resultado vem antes do editor; B herda A e a comparação destaca só diferenças. Rolls, modificadores e justificativas ficam sob demanda; motor atual preservado | Entradas suportadas por `@smogon/calc` e regras Champions confirmadas no projeto; sem métricas de uso |
| Silph Matchups e páginas de torneio apresentam o estado ativo e o conteúdo da equipe antes das ações administrativas | Salas e torneios davam precedência a convite e formulário sobre participantes e próxima ação | Estado/próxima ação e lista de participantes aparecem antes dos formulários; convite foi movido para depois do conteúdo operacional; menção ao jogo fica no contexto da partida | Participantes, estado, permissões, chaveamento e resultado da sala/torneio |
| MetaRoll, Silph e Pikalytics mostram sprites associados aos itens da lista e à forma selecionada | Identidade da Pokédex, Usage, builder e calculadora dependia demais de texto | Sprites e componentes já existentes foram mantidos; esta rodada aumenta o sprite nas cartas do Dex sem alterar mapeamentos ou usar arte dos concorrentes | Catálogo existente de formas/sprites; ausência de sprite continua usando fallback identificável |

## Evidências de navegação

`Interativo + captura` significa que executei a ação descrita e confirmei o resultado visual/na árvore de acessibilidade. As capturas feitas no navegador Work aparecem nos respectivos registros desta sessão; as imagens reproduzíveis do Spinda Stop são anexadas pelo workflow `Visual review` no PR #28.

| URL | Ação | Estado resultante | Captura/evidência |
| --- | --- | --- | --- |
| [Pikalytics home](https://www.pikalytics.com/) | Abri o seletor de formato e escolhi Reg M-A | A rota mudou para Reg M-A, mas partes da página mantiveram conteúdo de M-C; não tratei os números como referência de produto | Interativo; Work, tab 6 |
| [Pikalytics Rillaboom](https://www.pikalytics.com/pokedex/gen9championsvgc2026regmc/rillaboom) | Abri ficha e usei navegação de formatos/links para time | A ficha mostrou stats, distribuições, parceiros e equipes; título, URL e seletor divergiram entre M-C/M-A | Interativo; Work, tab 6 |
| [Pikalytics Top Teams](https://www.pikalytics.com/topteams) | Busquei Rillaboom e selecionei Rain | A lista foi reduzida de 200 a 14 equipes e exibiu composição/resultado do time | Interativo; pesquisa anterior, registro de captura no relatório da rodada |
| [Pikalytics Builder](https://www.pikalytics.com/team) | Escolhi Rillaboom, alterei nature para Jolly, abri detalhes e depois usei um time de torneio | Set editável e ferramentas de análise; equipe carregada com seis espécies no builder | Interativo; Work, tabs 7 e 12 |
| [Pikalytics Tournaments](https://www.pikalytics.com/tournaments) → [detalhe de evento](https://www.pikalytics.com/tournaments/limitless/sunday-showdown-3-3ec722) | Abri detalhe, percorri classificação/rodadas e acionei Team Builder | Detalhe mostrou times e standings; ação levou ao builder com seis membros. Link da lista não navegou na sessão | Interativo; pesquisa anterior, registro de captura no relatório da rodada |
| [Pikalytics Speed Tiers](https://www.pikalytics.com/speed-tiers) | Busquei Garchomp, ordenei por Base Spe e abri Mega Garchomp | Busca mostrou 3 formas de Garchomp entre 334 linhas; a ficha preservou a forma Mega. A ficha aberta misturou rótulo M-C e dados/rótulo M-A, além de campos `NaN`; registramos isso como inconsistência da referência | Interativo + captura; Work, tab 8, resultado filtrado e ficha aberta |
| [Pikalytics Damage Calculator](https://www.pikalytics.com/damage-calculator) | Na distribuição, selecionei Fake Out | O matchup recalculou imediatamente dano e 16 rolls do golpe selecionado | Interativo + captura; Work, tab 10 |
| [Silph Scope home](https://silph-scope.com/) | Alternei Doubles/temporada e consultei a tabela | A navegação de modo/temporada respondeu; alguns blocos ficaram carregando em novas visitas | Interativo; Work, tab 9/11 |
| [Silph Usage](https://silph-scope.com/usage?utm_source=chatgpt.com) | Selecionei Garchomp; combinei filtro Fire; troquei Season 7 para Season 6; abri categorias | Fire reduziu 262 espécies a 28 e manteve a ficha aberta; mudar temporada removeu os filtros, mas manteve Garchomp selecionado. A ficha apresenta moves, items, ability, nature, spread, parceiros e matchup | Interativo + captura; Work, tab 11 |
| [Silph Builder](https://silph-scope.com/builder) | Selecionei Garchomp no primeiro slot e explorei os controles do set | Habilidade, item, golpes, EV/nature e distribuições ficaram editáveis para a espécie escolhida | Interativo + captura; Work, tab 9 |
| [Silph Matchups](https://silph-scope.com/matchups) | Carreguei Live S7 Doubles, abri filtros/importação, selecionei Fire e abri Import from text | Lista de 262; filtro Fire reduziu a 28 e conservou Garchomp. Importação abriu área para Showdown/PokéPaste | Interativo + captura; Work, tab 13 |
| [Silph calculator](https://silph-scope.com/calc) | Adicionei Garchomp e Rillaboom em slots opostos | A calculadora preencheu ataques e dano recíproco por espécie | Interativo + captura; Work, tab 16 |
| [Silph Players](https://silph-scope.com/player) | Abri e aguardei carregamento | Cabeçalho abriu; resultados e seletor continuaram em loading após a espera. Fluxo de resultado inacessível nesta sessão | Apenas abriu/carregando; Work, tab 15 |
| [Silph Rentals](https://silph-scope.com/rentals) | Abri a biblioteca e inspecionei os filtros | Filtros de espécie/tipo/move/habilidade/item/regra disponíveis; coleção permaneceu vazia, então não foi possível testar abrir uma equipe | Apenas abriu; sem resultado para continuar |
| [Champions Lab Pokédex](https://championslab.xyz/) | Busquei Rillaboom e abri Stats/Moves/Abilities/Usage/Teams | Uma espécie; modal de ficha. Aba Moves sem conteúdo visível; Usage era lista de golpes aprendíveis, não distribuição competitiva | Interativo + captura; pesquisa anterior, registro da rodada |
| [Champions Lab Meta](https://championslab.xyz/meta) | Alternei Doubles, Rankings e tabela; abri Teams | Controles responderam; Teams listou coleções. `Show All` excedeu o tempo de espera | Interativo; `Show All` inacessível por timeout |
| [Champions Lab Events](https://championslab.xyz/events) | Alternei Upcoming → Past | Calendário passou aos eventos de 2025 e manteve filtros de nível/região/status | Interativo; pesquisa anterior, registro da rodada |
| [MetaRoll Usage](https://metaroll.app/usage-stats) | Selecionei Garchomp, apliquei Fire e comparei lista/ficha | Filtro reduziu 262 a 28; Garchomp continuou selecionado embora não estivesse na lista filtrada. A ficha mantém resumo, moves, parceiros e “beats/loses to” | Interativo + captura; Work, tab 17 |
| [MetaRoll perfil Rillaboom](https://metaroll.app/pokemon/rillaboom) | Alternei Build, Matchups, Teammates, Trends e Items | As seções expuseram dados de set, relações e evolução por período; set comum é uma sugestão da fonte | Interativo; pesquisa anterior, registro da rodada |
| [MetaRoll Seasons](https://metaroll.app/seasons) | Selecionei M-6 e All Seasons | Datas de temporada apareceram; All Seasons permaneceu carregando na sessão | Interativo parcial; agregado contínuo inacessível por loading |

## Capturas do Spinda Stop e inspeção

O script `apps/web/test/visual-review.mjs` grava um conjunto por viewport: `desktop` (1440), `mobile` (390), `mobile-320` (320) e `zoom200` (720 CSS px). Nomes focados desta rodada:

- `*-pokedex-loaded-more.png`, `*-pokedex-filtered.png`, `*-pokedex-restored.png`;
- `*-usage-battle-data-moves.png` e `*-usage-metaroll-category.png`;
- `*-builder-six-members-first-fold.png` e `*-builder-six-members.png`;
- `*-calculator-comparison.png` e `*-calculator-comparison-rolls.png`;
- `*-room-state-flow.png` e `*-tournament-state-flow.png`.

Para sala/torneio, as capturas de hierarquia usam fixtures com formato de resposta da API; a sequência completa de convite, check-in, partida, resultado, confirmação, chaveamento e final usa PostgreSQL efêmero do workflow. O roteiro registra cada modo no `inspection.json`.

## Limites e verificação

- O browser local do ambiente não está instalado. A tentativa de obter Chromium via Playwright foi bloqueada pela política de rede (download do CDN retornou 403), e a prévia local não é alcançável pelo navegador Work. Por isso, a inspeção visual das telas do Spinda Stop precisa ser concluída nas capturas geradas no GitHub Actions; não consideramos lint, axe ou build como aprovação visual.
- O browser Work não oferece alteração de viewport nesta sessão; as referências concorrentes foram exploradas no desktop. A responsividade do Spinda Stop é exercitada em 390, 320 e 720 px pelo workflow do próprio PR.
- As rotas Players, Rentals e alguns agregados não produziram conteúdo suficiente para testar o fluxo posterior. A documentação registra o bloqueio sem inferir resultados.
- A ficha de uso que mantém Garchomp selecionado fora do filtro e a limpeza de filtros ao trocar temporada são comportamentos observados das referências, não requisitos copiados automaticamente.
- Impeccable não está instalado como skill executável. Foi consultada sua documentação pública oficial v4.6.0 (`new-work`, `craft-floor`, `operate`, `polish`): prioridade da tarefa, variação de composição conforme a informação, verificação de conteúdo renderizado, contraste e affordances/estados. `frontend-design`, `responsive-design-expert` e `react` foram lidas/aplicadas no desenho dos componentes, breakpoints e estado local.
