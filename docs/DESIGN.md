# Direção visual

## Ideia

O app é uma bancada de preparação para batalhas: a informação precisa ser rápida de comparar e fácil de editar. A direção usa cores quentes, molduras em degraus, seleção verde, ações em vermelho e bordas duras de RPGs portáteis da era GBA. A linguagem é do Spinda Stop: não reproduz menus, sprites ou telas de Pokémon FireRed nem do Silph Scope.

O modo é **Operate**: quem usa está procurando uma espécie ou ajustando um time. A tela prioriza controles conhecidos, densidade útil e estados claros. A captura Silph Scope serve para entender tipos de filtros e volume de informação, não para copiar aparência. O mascote é um desenho pixel art original feito para o projeto; nenhum sprite oficial foi incluído.

## Tokens iniciais

| Token | Valor | Uso |
|---|---|---|
| `paper` | `#F3E7C4` | Fundo geral. |
| `surface` | `#FFF8E9` | Área de trabalho. |
| `ink` | `#20283A` | Texto e bordas principais. |
| `blue` | `#2D67A4` | Links e navegação. |
| `coral` | `#C44033` | Ações principais e estados de atenção. |
| `green` | `#2C704A` | Seleção e confirmação, com contraste AA no fundo principal. |
| `gold` | `#785300` | Aviso e dado provisório. |

Tipo também aparece por nome. Press Start 2P é usada só na marca; corpo e formulários usam sans do sistema. Números de catálogo usam largura tabular. Molduras quadradas, sombras curtas e áreas de cor se repetem na navegação, cartões, filtros, campos, seleções e resultados. Cabeçalho, botões, abas de Usage, fichas e calculadora usam a mesma paleta.

## Mascote e ícones

O desenho pixel art em `spinda-stop-mascot.svg` é original para o Spinda Stop. A imagem do Spinda no Pokémon Database foi referência visual; nenhum arquivo do site foi copiado, redistribuído ou carregado de lá. A cabeça clara, as orelhas assimétricas e as manchas desencontradas preservam a ideia de um Spinda sem usar o sprite oficial.

O favicon 16×16 usa uma grade simplificada própria em `favicon-16.svg`; sem antialias, ela conserva olhos, manchas e contorno em poucos pixels. O favicon 32×32, `favicon.ico`, ícones 192×192 e 512×512 e Apple touch icon são servidos localmente a partir do desenho maior. Não há manifesto PWA porque o app ainda não oferece instalação offline.

## Telas de referência

| Tela | Desktop | Mobile |
|---|---|---|
| Dex | Filtros ao lado da lista; detalhe em página própria. | Filtros recolhíveis e lista em uma coluna. |
| Builder | Slots à esquerda, set em foco e resumo do time ao lado. | Seis slots em abas; um set por vez. |
| Calc | Dois sets lado a lado e distribuição de rolls abaixo. | Alternar atacante/defensor; resumo do resultado fixo. |
| Lobby | Rodada, participantes e ações do organizador. | Estado da partida primeiro; detalhes abaixo. |

Calc e Lobby são direções documentadas para fases futuras, sem telas fictícias nas etapas em que ainda não existem. Movimento só confirma seleção ou gravação; `prefers-reduced-motion` remove deslocamentos decorativos.
