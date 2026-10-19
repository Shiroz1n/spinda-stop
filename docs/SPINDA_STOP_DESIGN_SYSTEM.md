# Spinda Stop — design system e fluxos

Estado: direção para a próxima revisão do PR #28. Este documento especifica a experiência desejada e parte dos tokens que o código já utiliza. Não afirma que todos os padrões abaixo estejam implementados. Consulte [UI Humanizer](UI_HUMANIZER.md) para a revisão geral e [origens e créditos](THIRD_PARTY_LICENSES.md) para sprites.

## Norte

Uma ferramenta competitiva com o reconhecimento imediato de uma Pokédex portátil. A base vem dos menus e sprites de Pokémon FireRed/GBA; a densidade e a precisão vêm de uma ferramenta de análise. O usuário deve ver Pokémon, formato e próxima ação antes de texto sobre infraestrutura. O visual deve ser próprio do Spinda Stop, sem reproduzir componentes ou artes exclusivas dos sites estudados.

Na primeira dobra: Dex mostra catálogo e busca; ficha mostra Pokémon e navegação de dados; Usage mostra ranking e espécie; builder mostra seis posições e edição selecionada; calculadora mostra confronto e resultado; Speed mostra alvo e comparação; sala/torneio mostram participantes, estado e próxima ação.

## Evidência visual recebida

| Referência | Padrão observado nas imagens fornecidas | Adaptação desejada | Limite |
| --- | --- | --- | --- |
| DataDex, captura do catálogo | Linhas coloridas por tipo, número, nome, tipos e forma com Pokémon grande; várias entradas varridas sem abrir fichas. | Lista responsiva com densidade ajustável; sprite reconhecível, forma inequívoca, navegação contínua e filtro do catálogo inteiro. | Não replicar cards, paleta ou artes do app. A existência no Dex não significa legalidade no Champions. |
| DataDex, ficha e galerias | Ilustração principal bem maior, variantes, abas de Informações/Movimentos/Galeria/Equipes, evolução e detalhes consultáveis. | Ficha com identidade forte, abas úteis e links de volta ao builder/Usage; variantes e formas separadas. | Muitas imagens do app são renders ilustrativos, não pixel art; escolher fonte apropriada a cada contexto, sem reusar assets exclusivos. |
| DataDex, golpes e relações de tipo | Busca com filtros por categoria/tipo, dados tabulares e agrupamento de fraqueza, resistência e imunidade. | Filtro dos golpes realmente atribuíveis com fonte; tabela de defesa clara, fator multiplicativo e regras de habilidade/campo só quando modeladas. | Não copiar listas de aprendíveis de outros jogos para Champions nem confundir tipo base com dano efetivo em batalha. |
| Pikalytics, ficha Rillaboom e Pokédex | Ranking acessível ao lado da espécie; stats, movimentos, parceiros e atalhos para cálculo. | Ranking/ficha com seleção persistente e colunas densas em desktop; tempos e métricas atribuídos à fonte existente. | Números e win rate do Pikalytics não pertencem automaticamente às nossas APIs. |
| Champions Lab, builder | Seis slots visíveis, set escolhido e ações de salvar/importar/exportar próximas da montagem. | Alternância rápida entre os seis sets com ações de equipe onde são usadas. | Não copiar interface, dados nem supor que “EV” de outra fonte equivale a SP. |
| VGC Multi Calc e Pikalytics Calc | Confronto editável perto de resultado e rolls; modos de comparação e controles de campo por tarefa. | Ataque/alvo/golpe/dano primeiro, modificadores progressivos, modos distintos de comparação com estado preservado. | O motor e seus limites continuam documentados; interface não promete mecânica não validada. |
| Silph Scope Usage, Matchups e Rentals | Colunas de filtros, lista selecionável e detalhe; distribuição, confronto e equipe completos em contextos distintos. | Exploração rápida de dados existentes e links entre Usage, builder e calculadora. | Não criar Rentals ou métricas sem fonte autorizada e sem contrato de dados; não misturar percentuais. |
| Silph Scope ladder | Tabela ordenável e período explícito; gráfico de progresso contextual. | Tabela legível com filtros e última captura. | Histórico/cutoff só com semântica confirmada pela fonte. |

As imagens enviadas pelo usuário servem como referência para revisão. Não incorpore screenshots de terceiros como assets do produto. Antes de implementar detalhe interativo, abra o site respectivo, clique, registre URL/ação/resultado; se indisponível, marque como inferência a partir da captura.

## Fundamentos existentes e evolução

`apps/web/src/styles.css` contém os tokens atuais. O documento antigo `docs/DESIGN.md` descrevia valores de uma fase anterior e não deve ser usado como tabela de cores vigente. Inventário atual, a ser validado nas capturas e ajustado por token, nunca por substituição casual:

| Papel | Token atual | Valor atual | Diretriz |
| --- | --- | --- | --- |
| Campo de fundo | `--paper` | `#f3e7c4` | Base quente; evitar textura uniforme que prejudique tabelas. |
| Painel de leitura | `--surface` | `#fff8e9` | Separar da página sem empilhar caixas. |
| Faixa secundária | `--surface-alt` | `#eee0b7` | Agrupar controles reais. |
| Texto | `--ink` | `#20283a` | Legibilidade de dados e formulários. |
| Cabeçalho e links | `--blue-dark` | `#24466f` | Contexto de navegação, não competir com resultado. |
| Ação principal | `--coral` | `#c44033` | Uma ação de maior peso por contexto. |
| Confirmação | `--green` | `#2c704a` | Estado com rótulo, nunca só cor. |
| Seleção | `--gold` | `#785300` | Usar em conjunto com borda/forma. |
| Foco | `--focus` | `#8f3028` | Anel visível em superfícies claras e escuras. |
| Geometria | `--radius`, `--pixel-edge` | `4px`, sombra deslocada de `4px` | Moldura pixelada em foco e painéis principais, sem repeti-la em toda célula. |

Esses valores documentam o ponto de partida, **não uma aprovação final da paleta**. A rodada visual deve gerar uma prancha de tokens com estados normal/hover/foco/desabilitado, testar contraste e decidir o que permanece. Evite introduzir cores diretas em dezenas de seletores; consolide apenas as que correspondem a papéis novos.

### Tipografia, molduras, imagens e movimento

- `Press Start 2P` somente na marca, títulos curtos, números ou pequenos sinais de menu. Texto corrido, campos, dados e tabelas usam sans legível; preserve números tabulares quando comparáveis.
- Escalas coerentes de título, seção, rótulo e dado. Desenhe quebra de nomes longos e de formas antes de limitar texto; não use reticências para esconder identidade essencial.
- Hierarquia de bordas: contorno mais forte para seleção/resultado, divisória leve para linhas, fundo livre para respiro. Sombra deslocada só onde indica camada; nada de vidro translúcido por padrão.
- Sprites de espécie e **forma exata** com espaço reservado, `loading` apropriado e fallback nomeado. Pixel art em tamanho múltiplo adequado com `image-rendering: pixelated`; renders HOME maiores com suavização normal. Não ampliar um sprite minúsculo indefinidamente ou usar forma base como outra forma. O Spinda do cabeçalho/favicon usa o asset de origem documentada.
- Tipos com nome e símbolo; cores distinguíveis sem depender exclusivamente da cor. Itens e golpes não precisam de emoji. Imagens externas têm origem, atribuição, estado de falha e política de carregamento definidos.
- Transições curtas apenas quando esclarecem seleção, expansão ou carregamento. Nada de pulsar para simular “ao vivo”. Respeite `prefers-reduced-motion`.

### Componentes e estados

Componentes candidatos: `PokemonIdentity` (sprite, nome, forma, tipos), linha de catálogo, seletor de seis posições, `StatRow`, `TypeRelation`, controle de Nature, campo de filtro com resumo ativo, linha de distribuição, resultado de dano e cartão de participante. Só extraia componente compartilhado quando conteúdo, comportamento e estados coincidirem. Documente variantes e exemplos reais de uso; evite abstrações para decorar um único caso.

Cada controle inclui estado normal, hover onde houver ponteiro, foco, selecionado, desabilitado e erro. Busca/filtro preservam contexto ao abrir e voltar. Carregamento, vazio e falha mostram a próxima ação sem páginas de avisos. Fonte, formato, período e captura permanecem visíveis onde qualificam números; detalhes de API ficam em “Sobre os dados”.

## Padrões por tela

| Tela | Primeira tarefa e estrutura | Interações a conferir | Fonte e limite |
| --- | --- | --- | --- |
| Home | Entradas claras para explorar, montar e calcular; um Pokémon reconhecível, sem hero de SaaS genérico. | Navegação por teclado, foco, celular. | Sem promessas de dados “ao vivo” não verificadas. |
| Dex | Busca/filtro sobre catálogo inteiro; lista progressiva de espécies e formas, sprite/nome/tipos visíveis. | Scroll, filtro combinado, voltar da ficha com posição preservada. | PokéAPI geral; legalidade Champions desconhecida sem fonte. |
| Ficha | Sprite/forma/tipos/stats primeiro; abas que separam informações, relações de tipo, golpes e mídia quando existirem dados. | Trocar forma, evoluções, voltar; filtros de golpes; links para Usage/builder/calc. | Mostrar aprendibilidade por jogo/fonte; não afirmar golpes legais em Champions sem regras. Galeria só com assets documentados. |
| Usage | Ranking e detalhe de uma espécie, seções compactas para movimentos, item, Nature, SP, parceiros e histórico. | Buscar, selecionar, combinar filtros, trocar fonte/período, atualizar e falhar. | Battle Data e MetaRoll separados; sem inventar denominador. |
| Builder | Seis slots e set selecionado; Nature com nome e ↑/↓, quatro golpes, SP e orçamento; ações próximas ao set. | Trocar slot, importar/exportar, item desconhecido, golpe não validado, preservar set. | Distinguir `unknown` de `unavailable`; só afirmar validade oficial após fonte. |
| Calculadora | Confronto e dano/HP primeiro; 1 vs 1, 1 vs vários, Time vs 1; detalhes e rolls recolhíveis. | Alterar golpe/campo, comparar A/B, carregar seis sets válidos, registrar erro por membro. | `@smogon/calc`; não tratar KO empírico como dano teórico. |
| Speed Tiers | Alvo, modos de Nature/SP e lista dos seis; empate ≠ ultrapassagem. | Arrastar/editar SP, orçamento de 66 e teto de 32, aplicar ao set. | Fórmula e modificadores comprovados; não chamar de uso no meta. |
| Salas/torneios | Participantes, estado e próxima ação antes de formulários. | Convite, permissão, check-in, contestação e conclusão em mobile. | Identidade, privacidade e resultados manuais conforme modelo comunitário. |
| Matchups, ladder, rentals | Identidade e dados escaneáveis; contexto de fonte e período. | Filtros e navegação para ficha/equipe quando a fonte permite. | Rentals exigem fonte legal e funcional antes de virar tela populada. |

## Oportunidades de produto, fora do escopo automático da rodada visual

1. **Ficha enciclopédica ampliada:** evolução, variantes, galeria normal/brilhante, relações de tipo, grupos de ovos e localização. Inventarie os dados por jogo e fonte; não exiba localização de Legends Z-A como disponibilidade no Champions.
2. **Golpes aprendíveis com método e versão:** filtro por tipo/categoria/método e colunas de poder, precisão, PP. Requer fonte e mapeamento da forma, jogo e versão; só mostrar Champions quando confirmado.
3. **Análise de tipo explicável:** fraqueza/resistência/imunidade com multiplicador da combinação de tipos; habilidades, itens, clima e golpes condicionais são outra camada.
4. **Cálculo competitivo avançado:** modos complementares do VGC Multi Calc, como múltiplos atacantes vs time ou probabilidade, somente após contrato de entrada e validação do motor. Não anunciar uma probabilidade se só os 16 rolls estão disponíveis.
5. **Rentals e equipes de torneio:** catálogo, filtro, link e importação só depois de confirmar origem, licença/condições e semântica de live/arquivo. O link de rental fornecido é referência de fluxo, não API.

Abra itens de produto em issues ou plano separado com fonte, aceitação e prioridade. Não misture entrega de design com alegação de completude de Pokédex competitiva.

## Protocolo de revisão

Para cada rota, capture a primeira dobra e pelo menos um estado com conteúdo real em 1440, 390 e 320 px. Faça inspeção humana das imagens; teste fluxo inteiro no navegador, foco, teclado, toque simulado, zoom real quando disponível e movimento reduzido. Compare com o estado anterior do PR #28. Registre **referência → intenção → alteração própria → captura → limite de dados**. Inclua estados de falha e sets válidos, não só fixtures visualmente convenientes. Considere a rodada concluída quando o design melhorar a tarefa e os problemas funcionais demonstrados forem corrigidos, além de lint/test/build/integração aplicáveis.
