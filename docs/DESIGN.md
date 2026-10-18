# Direção visual

## Ideia

O app é uma bancada de preparação para batalhas: a informação precisa ser rápida de comparar e fácil de editar. A referência é a clareza dos menus de portáteis 8/16-bit, com desenho próprio; não reproduz telas, textos ou identidade do Silph Scope ou de um jogo específico.

O modo é **Operate**: quem usa está procurando uma espécie ou ajustando um time. A tela prioriza controles conhecidos, densidade útil e estados claros. A captura Silph Scope fornecida serve para entender tipos de filtros e volume de informação, não para copiar aparência. A imagem original não será redistribuída no repositório.

## Tokens iniciais

| Token | Valor | Uso |
|---|---|---|
| `paper` | `#F7F1D5` | Fundo geral. |
| `surface` | `#FFFDF4` | Área de trabalho. |
| `ink` | `#24304A` | Texto e bordas principais. |
| `blue` | `#32649B` | Ação primária e navegação ativa. |
| `coral` | `#B94138` | Erro e alerta. |
| `green` | `#286B4B` | Confirmação. |
| `gold` | `#8A6410` | Aviso e dado provisório. |

Tipo também aparece por nome. Press Start 2P é usada só na marca; corpo e formulários usam sans do sistema. Números de catálogo usam largura tabular. Uma sombra curta e uma borda dupla marcam a moldura do produto; o restante usa elevação por borda.

## Telas de referência

| Tela | Desktop | Mobile |
|---|---|---|
| Dex | Filtros ao lado da lista; detalhe em página própria. | Filtros recolhíveis e lista em uma coluna. |
| Builder | Slots à esquerda, set em foco e resumo do time ao lado. | Seis slots em abas; um set por vez. |
| Calc | Dois sets lado a lado e distribuição de rolls abaixo. | Alternar atacante/defensor; resumo do resultado fixo. |
| Lobby | Rodada, participantes e ações do organizador. | Estado da partida primeiro; detalhes abaixo. |

Calc e Lobby são direções documentadas para fases futuras, sem telas fictícias na primeira entrega. Movimento só confirma seleção ou gravação; `prefers-reduced-motion` remove deslocamentos decorativos.
