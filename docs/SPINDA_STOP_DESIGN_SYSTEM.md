# Spinda Stop — design system e fluxos

Estado: direção implementada e revisada no PR #28. Este documento registra os tokens e componentes atuais, a inspeção visual final e os limites de fonte que ainda não podem ser preenchidos. Consulte [UI Humanizer](UI_HUMANIZER.md) para os critérios gerais e [origens e créditos](THIRD_PARTY_LICENSES.md) para sprites.

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

## Tokens vigentes e evolução

`apps/web/src/styles.css` é a fonte dos tokens. A paleta abaixo é a que aparece nas telas e capturas desta rodada; `docs/DESIGN.md` resume sua intenção e aponta para esta tabela, sem manter uma cópia independente dos valores.

| Papel | Token | Valor atual |
| --- | --- | --- |
| Página | `--paper` | `#dce8dc` |
| Sombra de superfície | `--paper-shadow` | `#b7cbbd` |
| Painel | `--surface` | `#fffbe7` |
| Agrupamento secundário | `--surface-alt` | `#e8efd7` |
| Campo de formulário | `--field` | `#f4f2dd` |
| Sprite: céu / chão | `--sky` / `--grass` | `#c9e2dd` / `#98b77a` |
| Seleção | `--selection` | `#f2dda0` |
| Texto / texto secundário | `--ink` / `--muted` | `#173746` / `#465d5e` |
| Divisória | `--line` | `#84988c` |
| Acento azul / navegação | `--blue` / `--blue-dark` | `#2e7896` / `#234f63` |
| Ação / ação em texto | `--coral` / `--coral-dark` | `#b84538` / `#8d342d` |
| Confirmação / seleção em texto | `--green` / `--gold` | `#326b45` / `#8e6817` |
| Foco | `--focus` | `#005c9a` |
| Geometria / sombra curta | `--radius` / `--pixel-edge` | `3px` / `2px 2px 0 var(--paper-shadow)` |

O CSS também mantém `--fire-ink: #8d342d` para texto de ação/alerta e os tokens de tipo. Use estes papéis em vez de espalhar valores novos. Os estados normais, selecionados, desabilitados, erro e foco pertencem ao componente e usam rótulo ou forma além da cor. A revisão verifica foco por teclado e axe; o cálculo de contraste do runner observa navegação e atribuição no rodapé, não todas as combinações. Não há alegação de uma matriz completa de contraste.

### Tipografia, molduras, imagens e movimento

- `Press Start 2P` somente na marca, títulos curtos, números ou pequenos sinais de menu. Texto corrido, campos, dados e tabelas usam sans legível; preserve números tabulares quando comparáveis.
- Escalas coerentes de título, seção, rótulo e dado. Desenhe quebra de nomes longos e de formas antes de limitar texto; não use reticências para esconder identidade essencial.
- Hierarquia de bordas: contorno mais forte para seleção/resultado, divisória leve para linhas, fundo livre para respiro. Sombra deslocada só onde indica camada; nada de vidro translúcido por padrão.
- Sprites de espécie e **forma exata** com espaço reservado, `loading` apropriado e fallback nomeado. Pixel art em tamanho múltiplo adequado com `image-rendering: pixelated`; renders HOME maiores com suavização normal. Não ampliar um sprite minúsculo indefinidamente ou usar forma base como outra forma. O Spinda do cabeçalho/favicon usa o asset de origem documentada.
- Tipos com nome e símbolo; cores distinguíveis sem depender exclusivamente da cor. Itens e golpes não precisam de emoji. Imagens externas têm origem, atribuição, estado de falha e política de carregamento definidos.
- Transições curtas apenas quando esclarecem seleção, expansão ou carregamento. Nada de pulsar para simular “ao vivo”. Respeite `prefers-reduced-motion`.

### Componentes e estados implementados

| Componente ou tela | Responsabilidade confirmada |
| --- | --- |
| `PokemonSprite` | Sprite da forma disponível, reserva de espaço e fallback com nome quando a imagem falha; evita substituir uma forma sem sprite próprio pela arte base. |
| `PokemonCard` + `DexPage` | Linha/cartão compacto com número, nome, forma e tipos; busca e filtros percorrem o catálogo inteiro. |
| `DexDetailPage` | Identidade em primeiro plano, navegação por seção, formas, evolução direta, multiplicadores gerais e aprendibilidade filtrada com fonte. |
| `TypeTag` | Nome/símbolo e cor contextual para reconhecer tipo sem depender só da cor. |
| `NaturePicker` + `BuilderPage` | Seleção de Nature com efeitos ↑/↓, seis sets, campos editáveis, importação/exportação e stats recalculados. |
| `DamageCalculatorPage` | Modos 1 vs 1, 1 vs vários e Time vs 1, resumo do confronto, resultados e rolls por golpe. |
| `UsagePage` e vistas MetaRoll | Fonte, formato e período junto da seleção, ranking e filtros publicados por cada fonte. |
| `RoomsPage` e `TournamentsPage` | Participantes, estado e próxima ação; vazio, erro, convite e resultado em contexto. |

Cada controle precisa exibir foco, seleção, desabilitado e erro quando aplicáveis. Busca e filtro preservam contexto ao abrir e voltar. Carregamento, vazio e falha mostram a próxima ação sem páginas de avisos. Fonte, formato, período e captura permanecem visíveis onde qualificam números; detalhes de API ficam em “Sobre os dados”. A [última revisão do PR #28](PR28_FOLLOWUP.md) registra telas e estados exercitados, correções encontradas nas capturas e limites do ambiente.

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

## Oportunidades de produto

1. **Ficha enciclopédica ampliada:** evolução direta por espécie, variantes e relações de tipo já têm fonte e aparecem na ficha. A lista de golpes usa a forma exata, jogo, método, tipo e categoria da revisão fixada da PokéAPI. Grupos de ovos, condições de evolução detalhadas e localização ainda precisam de um contrato de dados por jogo. Localização em Legends Z-A não prova disponibilidade em Pokémon Champions.
2. **Galeria normal/brilhante da forma exata:** depende de confirmar direitos e cobertura consistente de sprites shiny por forma, com atribuição, fallback e teste dos assets. Não renderizar uma galeria vazia enquanto a fonte não estiver confirmada.
3. **Golpes permitidos em Pokémon Champions:** aprendibilidade geral já pode ser consultada por jogo e versão. Filtrar ou rotular compatibilidade/legalidade no Champions ainda depende de fonte de regulamento autorizada, formato, temporada e data; uma linha de Legends Z-A ou de Scarlet/Violet não responde isso.
4. **Análise de tipo explicável:** fraqueza/resistência/imunidade com multiplicador da combinação de tipos já aparece. Habilidades, itens, clima e golpes condicionais são outra camada e só entram quando o motor identifica e modela seu efeito.
5. **Cálculo competitivo avançado:** modos complementares do VGC Multi Calc, como múltiplos atacantes contra um time ou probabilidades, dependem de contrato de entrada e validação do motor. Não anunciar probabilidade de partida quando só há 16 rolls de dano.
6. **Rentals e equipes de torneio:** catálogo, filtro, link e importação dependem de confirmar origem, licença/condições e semântica de equipe ao vivo/arquivada. O link de rental de referência não é uma API autorizada.

O estado desta rodada e o trabalho futuro por fonte estão registrados em [PRODUCT_OPPORTUNITY_INVENTORY.md](PRODUCT_OPPORTUNITY_INVENTORY.md).

Mantenha oportunidades futuras no inventário com fonte, aceitação e prioridade. Não misture entrega de design com alegação de completude de Pokédex competitiva.

## Protocolo de revisão

Para cada rota, capture a primeira dobra e estados com conteúdo real em 1440, 390 e 320 px; inclua erro, vazio e carregamento quando aplicáveis. Inspecione as imagens manualmente, percorra fluxos reais com teclado e compare com o estado anterior do PR #28. Registre **referência → intenção → alteração própria → captura → limite de dados**. O viewport CI de 720 CSS px ajuda a inspecionar reflow, mas não é zoom real do navegador. O Chrome isolado desta sessão não alcançou a porta local do app; a revisão pós-correção usa o runner Playwright do Actions, que executa o app e os fluxos no ambiente de teste. Consulte [PR28_FOLLOWUP.md](PR28_FOLLOWUP.md) para a última execução, seus estados cobertos e o limite de avaliação manual.
