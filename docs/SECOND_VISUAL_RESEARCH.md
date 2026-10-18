# Segunda rodada visual

18/10/2026 · pesquisa interativa das referências e plano aplicado ao estado integrado do Spinda Stop.

## Padrões, problemas e mudanças

| Padrão observado | Problema concreto no Spinda Stop | Melhoria aplicada | Dados necessários |
| --- | --- | --- | --- |
| Pikalytics e Champions Lab permitem trocar formato/período e abrir uma espécie a partir de uma lista | Os cartões do Dex reservam uma faixa alta vazia antes do sprite | Cartões compactos com sprite maior, número, forma, tipos e atributos no mesmo bloco; busca, filtros e paginação continuam | Catálogo local: número, nome, forma, tipo, stats e sprite mapeado |
| Silph Scope e MetaRoll separam a lista do resumo da espécie e oferecem seções de dados | Usage despeja todas as distribuições de uma espécie numa coluna longa | Resumo curto com destaques e navegação por seção; cada linha completa continua acessível | Somente campos normalizados da fonte selecionada, sem cruzar amostras |
| Pikalytics e Silph Scope deixam os slots e o seletor de Pokémon acessíveis durante a edição | No builder mobile, avisos, conta e ações ocupam o primeiro espaço; 320 px empilha os seis slots | Slots em grade compacta antes de opções secundárias, com campos por tarefa e ações de arquivo recolhidas | Estado local dos seis integrantes e dos sets já salvos |
| A calculadora Silph começa pelos lados e pelo golpe; as referências deixam o resultado fácil de localizar | Os cenários A/B duplicam os dois formulários completos e a ficha técnica fica aberta | B parte de A e expõe uma variação curta; dados detalhados fecham por padrão e continuam disponíveis | Mesmas entradas e resultados do motor atual; nenhuma métrica de fonte competitiva |
| Calendários e torneios mostram estado e próxima ação em contexto | Salas e torneios repetem que a partida ocorre no jogo ao lado de conteúdo secundário | Contexto do Champions aparece uma vez; estado/próxima ação ganha precedência sobre detalhes | Estado existente, papel do participante e situação do resultado |
| A mesma imagem do Spinda Black/White `327.png` pode identificar o cabeçalho e a aba | O favicon criado anteriormente não era o sprite solicitado | Usar a URL versionada de `327.png` no cabeçalho e em `<link rel="icon">`; remover os ícones locais | Nenhum dado; arquivo externo fixado por commit e direitos das imagens registrados separadamente da licença do código |

## Registro de navegação

As referências foram usadas para observar ações, hierarquia e fluxos. Não copiamos código, texto, composição ou valores competitivos.

| URL | Ação | Resultado observado |
| --- | --- | --- |
| [Pikalytics home](https://www.pikalytics.com/) | Abri o seletor de formato e alterei a seleção | A rota mudou para `gen9championsvgc2026regma`; a listagem ainda mostrava conteúdo de Reg M-C em partes da página, inconsistência que impede tratar a captura como dado validado |
| [Rillaboom](https://www.pikalytics.com/pokedex/gen9championsvgc2026regmc/rillaboom) | Abri a ficha | Redirecionou para Reg M-A; apresentou atributos, distribuições, parceiros e times de torneio; o título ainda dizia M-C |
| [Top teams](https://www.pikalytics.com/topteams) | Busquei Rillaboom e selecionei o arquétipo Rain | A lista mudou de 200 para 14 resultados e mostrou treinador, evento, resultado e seis Pokémon por time |
| [Builder](https://www.pikalytics.com/team) | Selecionei Rillaboom, troquei a natureza para Jolly e abri detalhes | O set permaneceu editável; detalhes de cobertura e velocidade foram expandidos |
| [Torneios](https://www.pikalytics.com/tournaments) e [detalhe](https://www.pikalytics.com/tournaments/limitless/sunday-showdown-3-3ec722) | Abri a lista e depois a rota de detalhe diretamente | A lista apresentou estados e vencedores; o detalhe mostrou times, classificação e rodadas. O link clicado na lista não navegou |
| [Speed tiers](https://www.pikalytics.com/speed-tiers) | Ordenei por Base Spe e busquei Garchomp | A ordenação mudou; a busca não alterou a tabela de forma verificável |
| [Calculadora](https://www.pikalytics.com/damage-calculator) | Abri a ferramenta | A rota excedeu o tempo de espera e ficou sem conteúdo utilizável nesta sessão |
| [Silph Scope home](https://silph-scope.com/) | Troquei Doubles/temporada e observei a tabela | Há alternância de modo/temporada e tabela de treinadores; em retornos posteriores, alguns blocos ficaram carregando |
| [Usage](https://silph-scope.com/usage) | Selecionei Garchomp, filtro Fire e Season 6; alternei Overview/Progression | A lista caiu de 262 para 28 espécies; ficha separou golpes, itens, habilidade, nature, EV spreads, parceiros e matchups. Ao mudar temporada, a posição da espécie mudou |
| [Builder](https://silph-scope.com/builder) | Abri um slot e busquei Rillaboom | O resultado apareceu no seletor; clique/Enter via árvore acessível não concluiu a seleção nesta sessão |
| [Matchups](https://silph-scope.com/matchups) | Abri a tela e aguardei os dados | Filtros e importação de time apareceram, mas a lista continuou em carregamento com contagens vazias |
| [Calculadora](https://silph-scope.com/calc) | Abri o seletor de atacante | Lista de espécies e colunas de posição apareceram; selecionar atacante/alvo não foi confirmado pela automação |
| [Rentals](https://silph-scope.com/rentals) | Abri a biblioteca | A coleção estava vazia; filtros por Pokémon, tipo, golpe, habilidade, item e regra estavam visíveis |
| [Players](https://silph-scope.com/player) | Busquei `Sam` | Busca e filtros Singles/Doubles e ordenação apareceram; resultados permaneceram carregando |
| [Champions Lab Pokédex](https://championslab.xyz/) | Busquei Rillaboom e abri a espécie | Busca reduziu para uma linha; ficha abriu modal com Stats, Moves, Abilities, Usage e Teams. A aba Moves ficou sem conteúdo visível; Usage mostrou catálogo de golpes aprendíveis, não distribuição competitiva |
| [Meta](https://championslab.xyz/meta) | Alternei Doubles, Pokémon Rankings, modo tabela e expandi Show All | Navegação de seções e tabela respondeu; listas maiores apareceram. Teams mostrava 4.472 times e o comando “Show All” excedeu o tempo de espera |
| [Eventos](https://championslab.xyz/events) | Alternei de Upcoming para Past | Calendário mudou para eventos de 2025; filtros por nível, região e estado estavam disponíveis |
| [MetaRoll home](https://metaroll.app/) e [Usage](https://metaroll.app/usage-stats) | Abri Usage, selecionei Rillaboom, alternei para tabela e apliquei filtro Fire | Ranking Doubles, mudança de temporada, busca e filtros responderam; combinação incompatível retornou zero resultados; abrir Rillaboom levou à ficha |
| [Ficha MetaRoll](https://metaroll.app/pokemon/rillaboom) | Alternei Build, Matchups, Teammates e Trends/Items | A ficha separou resumo, histórico de posição, tendências por item e relações; o botão de set comum existe e deve ser tratado como sugestão da fonte |
| [Seasons](https://metaroll.app/seasons) | Selecionei M-6 e All Seasons | O seletor mostrou temporadas e datas; All Seasons permaneceu em carregamento nesta sessão |

## Limites de inspeção

O navegador de referência do Work não expõe ajuste de viewport nesta sessão; por isso não foi possível verificar as referências concorrentes em viewport mobile. As capturas locais do Spinda Stop cobrem 1440, 390 e 320 px. As rotas e controles com carregamento persistente, timeout ou clique não confirmado estão marcados no registro, sem inferir o conteúdo que não carregou.

## Critérios de execução

- Aplicar hierarquia visual por tarefa e reduzir áreas vazias sem retirar informação real.
- Expor dados completos por navegação curta; resumo inicial é apenas uma prévia, não descarte de campos.
- Manter atribuição, período, cache, estados de falha/vazio e separação entre provedores.
- Inspecionar capturas renderizadas em cada largura e revisar fluxo por teclado; lint, axe e build não substituem inspeção visual.
- Impeccable não está instalado como skill executável neste ambiente. Foi consultada a documentação pública oficial v4.6.0 (`new-work`, `craft-floor`, `operate` e `polish`); os critérios aplicados foram priorizar tarefa antes de enfeite, variar a composição pela função do dado, conferir cópia/layout renderizados, usar contraste legível e revisar affordances/estados interativos. As skills `frontend-design`, `responsive-design-expert` e `react` foram lidas e aplicadas no desenho, nos breakpoints e nos componentes desta rodada.
