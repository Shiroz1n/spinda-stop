# Direção visual do Spinda Stop

O Spinda Stop combina a identificação rápida de uma Pokédex portátil com uma bancada de análise competitiva. A referência FireRed/GBA aparece em sprites, seleção e pequenos sinais de navegação; títulos, tabelas, formulários e resultados priorizam leitura simples. Não usamos layout, texto, código, paleta nem assets exclusivos das referências.

## Linguagem atual

- Fundo de papel claro com leve tom vegetal, superfícies quase brancas e campos diferenciados.
- Tinta verde-escura; azul para navegação/links; coral para ação/alerta; verde para confirmação; dourado para seleção.
- Contornos fortes somente em seleção, foco, erro ou resultado. Linhas e alinhamento agrupam a informação comum.
- Press Start 2P fica restrita à marca e a sinais curtos. Texto, formulários, tabelas e números usam sans-serif do sistema e algarismos tabulares quando comparáveis.
- Sprites ficam ligados ao ID exato da forma, com fallback nominativo, e preservam crédito e origem registrados em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
- Busca, seleção, erro, carregamento e ausência de dados têm rótulo e recuperação acessíveis; a cor não é o único sinal.

Os valores semânticos vigentes estão centralizados em `:root` de [styles.css](../apps/web/src/styles.css); composição por tarefa e breakpoints ficam em [composition-refresh.css](../apps/web/src/composition-refresh.css), sobre a base de [visual-refresh.css](../apps/web/src/visual-refresh.css). A tabela de papéis, componentes e limites está em [SPINDA_STOP_DESIGN_SYSTEM.md](SPINDA_STOP_DESIGN_SYSTEM.md).

## Composição por tarefa

| Tela | Primeiro plano | Comportamento estreito |
|---|---|---|
| Home | Busca real em um hero assimétrico, uma identidade Spinda e destinos funcionais numa lista compacta. | Busca e entrada para montar time no primeiro viewport; atalhos sem números de atividade. |
| Dex | Catálogo em quatro colunas no desktop, com sprite maior, forma, número e tipos; filtros secundários têm menos peso. | Grade em duas colunas; nome, forma, tipos, contagem e busca continuam legíveis. |
| Ficha | Espécie, forma e sprite exatos no destaque; evolução, stats, relações e formas em seções de consulta. | Navegação de seções rola horizontalmente; cada forma continua ligada ao próprio registro e sprite. |
| Usage e ladder | Fonte/período compactos; ranking e detalhe precedem filtros e metadados extensos. | Ranking e ficha vêm antes dos controles de longa cauda; “Limpar filtros” aparece logo após o disclosure de filtros e fora da grade expandida, quando há filtros ativos. Battle Data e MetaRoll continuam independentes. |
| Builder | Seis posições num seletor e um editor para o integrante ativo. | Posições em 3×2; o set ativo vem em seguida com Nature, habilidade, item, quatro golpes e SP. |
| Calculadora | Bancada em três regiões: atacante/golpes, resultado/campo e alvo/golpes; quatro slots por lado. | A bancada empilha em uma coluna; confronto e golpe ativo vêm antes dos detalhes. 16 rolls e modificadores seguem acessíveis. |
| Speed | Alvo e velocidade resultante abrem a leitura; tabela compara os valores calculados. | Lista e alvo vêm antes de explicação longa; Trick Room muda ordem, não valor bruto. |
| Salas e torneios | Estado, participantes/chave e próxima ação antes de configuração. | Nomes longos quebram linha; erro/vazio conserva recuperação junto do estado. |

## Fontes e limites

Stats, formas, tipo, evolução e aprendibilidade vêm da revisão fixa da PokéAPI e são dados gerais/de jogo. Eles não provam disponibilidade em Pokémon Champions, coexistência dos golpes ou legalidade de um regulamento. A calculadora oferece listas orientadas por espécie/versão e mantém separado o catálogo do motor; a escolha de golpe recalcula o resultado na hora. Habilidades da forma, catálogo de itens, itens importados e itens sem suporte são identificados por fonte e limite. A calculadora segue `@smogon/calc` 0.12.0; Battle Data e MetaRoll permanecem adaptadores independentes. Não mostramos win rate, rentals ou listas de equipes externas sem fonte/contrato e semântica apropriados.

A galeria normal/brilhante por forma continua futura até haver cobertura e direitos confirmados para cada sprite/modelo. Capturas DataDex e de outros sites são evidência de pesquisa, não assets do produto. As decisões e as capturas de revisão desta PR estão em [NEXT_VISUAL_REDESIGN.md](NEXT_VISUAL_REDESIGN.md) e no relatório visual anexado à própria PR.
