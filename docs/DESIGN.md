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
- Speed Tiers usa uma tabela ordenável calculada. O builder pode comparar os seis membros contra um alvo com prévias explícitas antes de salvar.
- Salas e torneios priorizam participantes, equipe compartilhada e próxima ação. Equipe só aparece quando a pessoa escolheu compartilhá-la.
- Estados de carregamento, erro, vazio e indisponibilidade têm linguagem curta e ação próxima. Dados ausentes não recebem barras ou valores inventados.

## Identidade, sprites e formas

O cabeçalho e o favicon usam o mesmo sprite `327.png` de Spinda na coleção Black/White de PokeAPI/sprites, fixado na revisão `7a7d66b1620e646f69afd48dc1273da9033ede9c`. O navegador carrega essa imagem pela URL versionada do host; o arquivo não é copiado para o repositório. Os demais sprites também vêm da revisão fixada, com mapeamento explícito de espécies e formas. As origens e os direitos das imagens estão em [Licenças de dependências](THIRD_PARTY_LICENSES.md).

`PokemonSprite` usa um único mapeamento: ID da PokéAPI para forma base e ID próprio do Pokémon/forma para formas alternativas. Formas Mega, regionais e especiais não herdam a imagem base se a imagem correta não estiver disponível. O fallback mostra uma inicial identificável e informa que o sprite está indisponível. Listas usam carregamento sob demanda e mantêm espaço reservado.

Tipos usam o símbolo de Pokémon Champions hospedado em PokeAPI/sprites, com o nome sempre visível. Itens usam o slug da PokéAPI quando há sprite; nomes continuam disponíveis sem a imagem. A origem e os limites de uso estão em [Licenças de dependências](THIRD_PARTY_LICENSES.md).

## Paleta

| Token | Valor | Papel |
|---|---|---|
| `--paper` | `#dce9e4` | Fundo de arena menta, sem textura contínua |
| `--surface` | `#fbfcf4` | Superfície clara de leitura |
| `--surface-alt` | `#e5efe7` | Faixa de controle secundária |
| `--ink` | `#153748` | Texto principal azul-marinho |
| `--muted` | `#3c5964` | Texto de apoio |
| `--blue-dark` | `#16485e` | Cabeçalho, navegação e links |
| `--blue` | `#236f91` | Controles informativos |
| `--coral` | `#bd473b` | Ação principal em superfície clara |
| `--coral-dark` | `#92372f` | Hover de ação |
| `--green` | `#28684b` | Seleção de menu e confirmação |
| `--gold` | `#704f08` | Marcador de seleção e aviso |
| `--focus` | `#115a9c` | Contorno de teclado |

## Segunda rodada

O cabeçalho escuro separa a navegação do campo de trabalho; o amarelo marca seleção e o coral fica restrito às ações principais. A moldura pixel aparece em workbenches e no resultado principal. Linhas de catálogo e de jogadores usam divisórias planas para reduzir a aparência de cartões aninhados. A Pokédex reduz o palco vazio e coloca o sprite ao lado do nome, forma e tipos; no telefone mantém duas colunas em 390 px e uma coluna de leitura a 320 px. A barra fixa mobile mantém cinco rotas de tarefa e a entrada “Mais”. O conteúdo de dados e formulários continua em sans-serif; a fonte pixelada fica na marca e em índices curtos.

## Skills aplicadas

- `frontend-design`: a identidade usa uma direção única (arena portátil), tokens compartilhados, tipografia separada por função e composição assimétrica na home e no Usage.
- `React`: estado permanece junto ao fluxo que o usa; sprites e tipos são componentes específicos do produto; não há memoização sem necessidade medida.
- `performance-optimizer`: imagens têm dimensão reservada e `loading="lazy"` nas listas; a revisão mede bundle e requisições, sem incluir uma coleção inteira de artes.
- Rotom Labs: foram consultados `docs/SKILL_ROUTER.md`, `docs/PATTERNS_ANTIPATTERNS.md` e `docs/ROADMAP.md`. As regras aplicadas incluem separar IDs de espécie e forma, não usar sprite base para forma sem imagem exata, conservar a proveniência de cada fonte e tratar estados vazios sem dados de exemplo. `PLANO_MESTRE.md` não está presente neste checkout.

O catálogo desta sessão não disponibilizou uma skill ou executável chamado Impeccable. Não declaro sua execução. A captura anterior foi usada como anti-referência, e a composição foi refeita para priorizar Pokémon e ações, com inspeção visual em vez de aprovação por lint ou axe. A skill externa de responsividade citada em `docs/SKILL_ROUTER.md` também não estava disponível no leitor; os requisitos de 320 px, toque de 44 px, zoom e teclado foram aplicados como critérios do projeto.
