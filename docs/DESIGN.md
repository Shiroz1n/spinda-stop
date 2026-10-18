# Direção visual

## Ideia

O app é uma bancada de preparação para batalhas: a informação precisa ser rápida de comparar e fácil de editar. A direção usa blocos, molduras e cores de RPGs portáteis da era GBA, com desenho próprio. Não reproduz menus, sprites ou telas de Pokémon FireRed nem do Silph Scope.

O modo é **Operate**: quem usa está procurando uma espécie ou ajustando um time. A tela prioriza controles conhecidos, densidade útil e estados claros. A captura Silph Scope serve para entender tipos de filtros e volume de informação, não para copiar aparência. O mascote é um desenho pixel art original feito para o projeto; nenhum sprite oficial foi incluído.

## Tokens iniciais

| Token | Valor | Uso |
|---|---|---|
| `paper` | `#F4EBCF` | Fundo geral. |
| `surface` | `#FFFAF0` | Área de trabalho. |
| `ink` | `#20283A` | Texto e bordas principais. |
| `blue` | `#3970A9` | Links e navegação. |
| `coral` | `#B74536` | Ação principal, erro e alerta. |
| `green` | `#2C754B` | Confirmação e fonte selecionada. |
| `gold` | `#87600E` | Aviso e dado provisório. |

Tipo também aparece por nome. Press Start 2P é usada só na marca; corpo e formulários usam sans do sistema. Números de catálogo usam largura tabular. Bordas quadradas, sombras curtas e áreas de cor se repetem em navegação, cartões, filtros, campos e resultados. O ícone é servido localmente; favicon 16 px usa menos detalhes para manter o rosto legível.

## Origem do mascote

O sprite público de Spinda consultado no Pokémon Database não vem acompanhado de uma licença de redistribuição concedida pelo titular; a própria página informa que sprites e artes oficiais são de terceiros. O suporte oficial orienta projetos a não usar nem associar personagens e marcas da franquia. Por isso, o repositório usa um desenho geométrico original de um pequeno roedor tonto, criado em SVG para o Spinda Stop. O arquivo não depende de uma imagem remota e não contém o sprite oficial. Consulte [atribuição e licenças](THIRD_PARTY_LICENSES.md).

## Telas de referência

| Tela | Desktop | Mobile |
|---|---|---|
| Dex | Filtros ao lado da lista; detalhe em página própria. | Filtros recolhíveis e lista em uma coluna. |
| Builder | Slots à esquerda, set em foco e resumo do time ao lado. | Seis slots em abas; um set por vez. |
| Calc | Dois sets lado a lado e distribuição de rolls abaixo. | Alternar atacante/defensor; resumo do resultado fixo. |
| Lobby | Rodada, participantes e ações do organizador. | Estado da partida primeiro; detalhes abaixo. |

Calc e Lobby são direções documentadas para fases futuras, sem telas fictícias na primeira entrega. Movimento só confirma seleção ou gravação; `prefers-reduced-motion` remove deslocamentos decorativos.
