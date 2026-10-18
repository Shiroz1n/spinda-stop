# Direção visual

## Ideia

O Spinda Stop é uma bancada de preparação com ritmo de RPG portátil. A moldura e a paleta lembram jogos GBA; a hierarquia, os controles e a navegação são de uma aplicação atual. Sprites e filtros ajudam a escolher. A cor nunca é a única forma de identificar tipo, seleção ou estado.

O campo principal usa azul-petróleo, menta e verde. Coral marca ações importantes; amarelo aparece em seleção e aviso. Cartões claros servem para leitura, com seções alternadas em azul ou verde para quebrar a página bege do visual anterior. Bordas em degraus aparecem na marca, nos painéis principais e no foco, sem sombra grande em todos os elementos.

Dados, formulários e textos usam uma sans legível. Press Start 2P fica restrita ao nome da marca e a títulos muito curtos. As áreas de toque têm pelo menos 44 px, o foco é visível e a navegação mobile tem uma barra própria.

## Regras de composição

- Mostrar o Pokémon antes do detalhe secundário. Listas usam sprite, nome, número e tipo; não escondem a espécie em cartões de texto.
- A ficha começa com forma, sprite e tipos; stats e dados competitivos vêm em seguida, cada um com sua fonte.
- O builder mostra os seis integrantes com imagens persistentes. Em mobile, a pessoa escolhe um slot e edita esse set; as seis posições não viram uma coluna de seis formulários.
- Usage começa com resultados sem filtro. A lista e a ficha ficam lado a lado no desktop; em telas estreitas, a busca, a lista e a ficha viram etapas de navegação com uma seleção clara.
- A calculadora deixa atacante e alvo visíveis junto ao resultado. Comparar cenários mantém os dois independentes.
- Salas e torneios priorizam participantes, equipe compartilhada e próxima ação. Equipe só aparece quando a pessoa escolheu compartilhá-la.
- Estados de carregamento, erro, vazio e indisponibilidade têm linguagem curta e ação próxima. Dados ausentes não recebem barras ou valores inventados.

## Identidade, sprites e formas

O cabeçalho e o favicon usam o mesmo sprite `327.png` de Spinda na coleção Black/White de PokeAPI/sprites, fixado na revisão `7a7d66b1620e646f69afd48dc1273da9033ede9c`. O navegador carrega essa imagem pela URL versionada do host; o arquivo não é copiado para o repositório. Os demais sprites também vêm da revisão fixada, com mapeamento explícito de espécies e formas. As origens e os direitos das imagens estão em [Licenças de dependências](THIRD_PARTY_LICENSES.md).

`PokemonSprite` usa um único mapeamento: ID da PokéAPI para forma base e ID próprio do Pokémon/forma para formas alternativas. Formas Mega, regionais e especiais não herdam a imagem base se a imagem correta não estiver disponível. O fallback mostra uma inicial identificável e informa que o sprite está indisponível. Listas usam carregamento sob demanda e mantêm espaço reservado.

Tipos usam o símbolo de Pokémon Champions hospedado em PokeAPI/sprites, com o nome sempre visível. Itens usam o slug da PokéAPI quando há sprite; nomes continuam disponíveis sem a imagem. A origem e os limites de uso estão em [Licenças de dependências](THIRD_PARTY_LICENSES.md).

## Paleta

| Token | Valor | Papel |
|---|---|---|
| `--paper` | `#dcebe3` | Fundo da página |
| `--surface` | `#fffef7` | Superfície de leitura |
| `--surface-alt` | `#edf5ec` | Painéis secundários |
| `--ink` | `#173745` | Texto principal |
| `--muted` | `#49636b` | Texto de apoio |
| `--blue-dark` | `#164c61` | Navegação e links |
| `--blue` | `#2c7894` | Controles informativos |
| `--coral` | `#b84134` | Ação principal com contraste AA sobre superfícies claras |
| `--coral-dark` | `#a93e33` | Hover de ação |
| `--green` | `#287453` | Seleção e confirmação |
| `--gold` | `#72520b` | Avisos |
| `--focus` | `#a5352b` | Contorno de teclado |

## Skills aplicadas

- `frontend-design`: a identidade usa uma direção única (arena portátil), tokens compartilhados, tipografia separada por função e composição assimétrica na home e no Usage.
- `React`: estado permanece junto ao fluxo que o usa; sprites e tipos são componentes específicos do produto; não há memoização sem necessidade medida.
- `performance-optimizer`: imagens têm dimensão reservada e `loading="lazy"` nas listas; a revisão mede bundle e requisições, sem incluir uma coleção inteira de artes.
- Rotom Labs: foram consultados `docs/SKILL_ROUTER.md`, `docs/PATTERNS_ANTIPATTERNS.md` e `docs/ROADMAP.md`. As regras aplicadas incluem separar IDs de espécie e forma, não usar sprite base para forma sem imagem exata, conservar a proveniência de cada fonte e tratar estados vazios sem dados de exemplo. `PLANO_MESTRE.md` não está presente neste checkout.

O catálogo desta sessão não disponibilizou uma skill ou executável chamado Impeccable. Não declaro sua execução. A captura anterior foi usada como anti-referência, e a composição foi refeita para priorizar Pokémon e ações, com inspeção visual em vez de aprovação por lint ou axe. A skill externa de responsividade citada em `docs/SKILL_ROUTER.md` também não estava disponível no leitor; os requisitos de 320 px, toque de 44 px, zoom e teclado foram aplicados como critérios do projeto.
