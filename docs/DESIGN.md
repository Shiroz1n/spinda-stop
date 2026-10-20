# Direção visual do Spinda Stop

O Spinda Stop combina a identificação rápida de uma Pokédex portátil com uma bancada de análise competitiva. A referência FireRed/GBA aparece em sprites, seleção e pequenos sinais de navegação; títulos, tabelas, formulários e resultados priorizam leitura simples. Não usamos layout, texto, código, paleta nem assets exclusivos das referências.

## Linguagem atual

- Fundo de papel claro com leve tom vegetal, superfícies quase brancas e campos diferenciados.
- Tinta verde-escura; azul para navegação/links; coral para ação/alerta; verde para confirmação; dourado para seleção.
- Contornos fortes somente em seleção, foco, erro ou resultado. Linhas e alinhamento agrupam a informação comum.
- Press Start 2P fica restrita à marca e a sinais curtos. Texto, formulários, tabelas e números usam sans-serif do sistema e algarismos tabulares quando comparáveis.
- Sprites ficam ligados ao ID exato da forma, com fallback nominativo, e preservam crédito e origem registrados em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
- Busca, seleção, erro, carregamento e ausência de dados têm rótulo e recuperação acessíveis; a cor não é o único sinal.

Os valores semânticos vigentes estão centralizados em `:root` de [styles.css](../apps/web/src/styles.css); composição e breakpoints ficam em [visual-refresh.css](../apps/web/src/visual-refresh.css). A tabela de papéis, componentes e limites está em [SPINDA_STOP_DESIGN_SYSTEM.md](SPINDA_STOP_DESIGN_SYSTEM.md).

## Composição por tarefa

| Tela | Primeiro plano | Comportamento estreito |
|---|---|---|
| Home | Busca da Pokédex, montagem do time e lista de ferramentas. | Busca e ações cabem no primeiro viewport sem contadores inventados. |
| Dex | Busca, tipo, geração, ordenação e faixa opcional do total de stats-base; lista com sprite, número, nome, forma e tipos. | Linhas horizontais em 320/390 px, valor selecionado visível, resultados contados e vazios recuperáveis. |
| Ficha | Espécie e forma exata, sprite, tipos, navegação de seções, evolução/condições, stats gerais, multiplicadores e golpes aprendidos. | Navegação horizontal com indicação de continuidade; forma pode ser escolhida no contexto dos golpes. |
| Usage e ladder | Fonte/formato/período, espécie e posição próximas das distribuições. | Metadados longos recolhidos; filtros ativos e linhas numéricas permanecem legíveis. Battle Data e MetaRoll não são combinados. |
| Builder | Seis integrantes, integrante ativo e set editável. | Seis posições em 3×2, texto do ativo e Nature/efeitos legíveis; editor segue em ordem de leitura. |
| Calculadora | Modo, lados do cenário e primeiro dano. | Time vs 1 prioriza o primeiro integrante/resultado e mantém conteúdo fora da navegação fixa; 16 rolls e modificadores seguem acessíveis. |
| Speed | Alvo, modelo e Speed comparada. | Configurações de Nature/SP próximas e controles secundários recolhíveis. Trick Room muda ordem, não valor bruto. |
| Salas e torneios | Estado, pessoas envolvidas, chave/resultados e próxima ação. | Nomes longos quebram linha; formulários administrativos seguem depois do estado operacional. |

## Fontes e limites

Stats, formas, tipo, evolução e aprendibilidade vêm da revisão fixa da PokéAPI e são dados gerais/de jogo. Eles não provam disponibilidade em Pokémon Champions, coexistência dos golpes ou legalidade de um regulamento. A calculadora segue `@smogon/calc` 0.12.0; Battle Data e MetaRoll permanecem adaptadores independentes. Não mostramos win rate, rentals ou listas de equipes externas sem fonte/contrato e semântica apropriados.

A galeria normal/brilhante por forma continua futura até haver cobertura e direitos confirmados para cada sprite/modelo. Capturas DataDex e de outros sites são evidência de pesquisa, não assets do produto. As decisões e as capturas de revisão desta PR estão em [NEXT_VISUAL_REDESIGN.md](NEXT_VISUAL_REDESIGN.md) e no relatório visual anexado à própria PR.
