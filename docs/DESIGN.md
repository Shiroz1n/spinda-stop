# Direção visual do Spinda Stop

A direção atual é **O Espécime Bitmap**, registrada em [DESIGN.md](../DESIGN.md). A hipótese FireRed/GBA evoluiu: os sprites e o display bitmap mantêm reconhecimento, enquanto papel, tinta, vermelho de sinal e listas editoriais organizam a ferramenta competitiva. A interface não reutiliza layout, texto, código, paleta nem assets exclusivos das referências.

## Linguagem atual

- Fundo de papel claro, superfícies brancas e tinta quase preta.
- Vermelho para ação/seleção; azul para navegação/links; verde e dourado permanecem limitados aos estados existentes.
- Contornos fortes somente em seleção, foco, erro ou resultado. Linhas e alinhamento agrupam a informação comum.
- Press Start 2P dá voz aos títulos; texto, formulários, tabelas e números usam sans-serif e algarismos tabulares quando comparáveis.
- Sprites ficam ligados ao ID exato da forma, com fallback nominativo, e preservam crédito e origem registrados em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
- Busca, seleção, erro, carregamento e ausência de dados têm rótulo e recuperação acessíveis; a cor não é o único sinal.

Os tokens e componentes vigentes estão em [DESIGN.md](../DESIGN.md) e em `:root` de [styles.css](../apps/web/src/styles.css); composição por tarefa e breakpoints ficam em [composition-refresh.css](../apps/web/src/composition-refresh.css), sobre a base de [visual-refresh.css](../apps/web/src/visual-refresh.css). [SPINDA_STOP_DESIGN_SYSTEM.md](SPINDA_STOP_DESIGN_SYSTEM.md) documenta a pesquisa e a execução visual histórica da PR #30.

## Composição por tarefa

| Tela | Primeiro plano | Comportamento estreito |
|---|---|---|
| Home | Busca real em um hero assimétrico, uma identidade Spinda e destinos funcionais numa lista compacta. | Busca e entrada para montar time no primeiro viewport; atalhos sem números de atividade. |
| Dex | Catálogo em três colunas no desktop, com sprite, forma, número e tipos alinhados em linhas; filtros secundários têm menos peso. | Duas colunas; nome, forma, tipos, contagem e busca continuam legíveis. |
| Ficha | Espécie, forma e sprite exatos no destaque; evolução, stats, relações e formas em seções de consulta. | Navegação de seções rola horizontalmente; cada forma continua ligada ao próprio registro e sprite. |
| Usage e ladder | Fonte/período compactos; ranking e detalhe precedem filtros e metadados extensos. | Ranking e ficha vêm antes dos controles de longa cauda; “Limpar filtros” aparece logo após o disclosure de filtros e fora da grade expandida, quando há filtros ativos. Battle Data e MetaRoll continuam independentes. |
| Builder | Seis posições num seletor e um editor para o integrante ativo. | Posições em 3×2; o set ativo vem em seguida com Nature, habilidade, item, quatro golpes e SP. |
| Calculadora | Bancada em três regiões: atacante/golpes, resultado/campo e alvo/golpes; quatro slots por lado. | A bancada empilha em uma coluna; confronto e golpe ativo vêm antes dos detalhes. 16 rolls e modificadores seguem acessíveis. |
| Speed | Alvo e velocidade resultante abrem a leitura; tabela compara os valores calculados. | Lista e alvo vêm antes de explicação longa; Trick Room muda ordem, não valor bruto. |
| Salas e torneios | Estado, participantes/chave e próxima ação antes de configuração. | Nomes longos quebram linha; erro/vazio conserva recuperação junto do estado. |

## Fontes e limites

Stats, formas, tipo, evolução e aprendibilidade vêm da revisão fixa da PokéAPI e são dados gerais/de jogo. Eles não provam disponibilidade em Pokémon Champions, coexistência dos golpes ou legalidade de um regulamento. A calculadora oferece listas orientadas por espécie/versão e mantém separado o catálogo do motor; a escolha de golpe recalcula o resultado na hora. Habilidades da forma, catálogo de itens, itens importados e itens sem suporte são identificados por fonte e limite. A calculadora segue `@smogon/calc` 0.12.0; Battle Data e MetaRoll permanecem adaptadores independentes. Não mostramos win rate, rentals ou listas de equipes externas sem fonte/contrato e semântica apropriados.

A galeria normal/brilhante por forma continua futura até haver cobertura e direitos confirmados para cada sprite/modelo. Capturas DataDex e de outros sites são evidência de pesquisa, não assets do produto. As decisões e as capturas de revisão desta PR estão em [NEXT_VISUAL_REDESIGN.md](NEXT_VISUAL_REDESIGN.md) e no relatório visual anexado à própria PR.
