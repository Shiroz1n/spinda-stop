# Próxima reformulação visual

## Diagnóstico antes da implementação

Comparação feita em 20/10/2026 entre as capturas selecionadas do Visual review #134 no bundle atual, a composição implementada no PR #28 e as 15 imagens DataDex contidas no mesmo pacote. DataDex orienta densidade, hierarquia e fluxo; nenhuma arte, cor, texto ou estrutura exclusiva foi reutilizada. Os estados integrados são fixtures de revisão, não dados de produção.

| Impacto | Problema concreto na captura atual | Captura de referência | Decisão própria desta PR |
|---|---|---|---|
| Alto | A navegação da ficha perde a indicação de continuidade em 320 px; a forma exata não fica perto da lista de golpes. | `captures/spinda/mobile-320-pokemon-sheet.png`; `mobile-320-pokemon-learnset-filtered.png` | Faixa de seções rolável com seleção e affordance contínuas; controle de forma dentro dos filtros de golpe, ligado à rota exata e preservando os demais filtros. |
| Alto | Time vs 1 usa a dobra de 320 px para cabeçalho, modos e resumo antes de mostrar o primeiro dano; a navegação fixa reduz ainda mais a área útil. | `captures/spinda/mobile-320-calculator-team-vs-one.png` | Bancada curta por modo, primeiro membro e primeiro resultado logo após o alvo; área inferior reservada à navegação. |
| Alto | Busca, tipo e geração ficam comprimidos; a leitura de filtros do Dex não mostra ordenação nem recorte por stats-base. | `captures/spinda/desktop-pokedex-loaded-more.png`; `mobile-320-pokedex-loaded-more.png` | Catálogo denso com hierarquia em colunas no desktop, linhas no celular, filtros secundários recolhíveis e total base identificado como dado geral. |
| Médio | Os seis integrantes cabem em uma grade, mas o foco ativo e o começo do editor disputam uma dobra estreita; leitura do set selecionado é pequena. | `captures/spinda/mobile-320-builder-six-members-first-fold.png`; `mobile-builder-nature-after.png` | Seleção do time como lista compacta de nomes e sprites; editor em painel contíguo, com Nature e stats alinhados e mais próximos do integrante ativo. |
| Médio | Faixa de fonte, período, consulta e abas empurram espécie/ranking no Usage e formam linhas apertadas em 320 px. | `captures/spinda/mobile-320-usage-battle-data.png`; `desktop-usage-battle-data.png` | Fonte e período como metadado compacto; seleção/ranking antes das distribuições; filtros de categoria próximos da lista, mantendo Battle Data e MetaRoll independentes. |

## Composição desta PR por tela

| Tela | Composição e comportamento previstos |
|---|---|
| Home | Cabeçalho editorial curto e busca que abre o catálogo; duas ações de trabalho prioritárias e os demais caminhos reais em uma lista compacta. Sem métricas de atividade, cards repetidos ou espaço reservado. |
| Pokédex | Busca e filtros primários no início; ordenação visível; total de stats em filtro secundário com limites exatos; total de resultados e lista contínua. Colunas comparáveis no desktop e linhas horizontais no celular. |
| Ficha | Identidade/forma/sprite exato em uma faixa única; seletor de forma visível; abas que indicam continuação; seções com evolução e condições, stats gerais, multiplicadores defensivos e aprendibilidade por forma/jogo/método. A ficha não afirma legalidade Champions. |
| Usage e ladder | Recorte ativo e fonte/período antes da espécie e ranking; tabelas de comparação com números alinhados; limites e contrato da integração em detalhes. Não combinar marginais entre fontes. |
| Builder | Seis membros em seletor compacto permanente com foco ativo por borda e texto; o set escolhido vem a seguir e traz identidade, Nature com efeitos, habilidade, item, quatro golpes e SP. Importação/exportação sem mudanças na estrutura ou proveniência. |
| Calculadora | Três modos em navegação curta; cenário editável e primeiro resultado na mesma região visual; editor extenso em disclosure acessível. Time vs 1 exibe primeira linha calculada na primeira dobra de 320/390 px e mantém 16 rolls por membro/golpe. |
| Speed Tiers | Alvo e modelo em primeiro plano; comparação calculada antes dos controles menos usados; Trick Room e limites de SP continuam explicitados. |
| Salas | Estado e pessoas envolvidas formam a área inicial; a próxima ação tem hierarquia clara; convite e configuração permanecem acessíveis depois do estado real. |
| Torneios | Estado, chave e participantes precedem ações administrativas; nomes longos quebram linha e mensagens de falha mantêm recuperação próxima. |

## Fronteiras de dados e assets

- PokéAPI v2 continua fixada em `6fd69dfe90465ba96534f6816fc817737d1f97f6`. Stats-base, total, forma, evolução, critérios de evolução e aprendibilidade são dados gerais/por jogo da fonte.
- Um registro de aprendibilidade representa uma forma, método e grupo de versões. Não prova coexistência de quatro golpes, disponibilidade em Pokémon Champions ou legalidade do regulamento.
- A Pokédex geral, catálogo do motor `@smogon/calc` e disponibilidade regulamentar permanecem camadas separadas. Estados ausentes não viram “inválido”.
- Sprites existentes permanecem ligados ao ID exato da forma. As capturas DataDex não autorizam redistribuição de artes/modelos e não comprovam cobertura shiny por forma; nenhuma galeria normal/brilhante será simulada nesta PR.
- Usage segue proveniência e contrato atuais de cada adaptador. Não acrescentamos win rate, rental, catálogo de torneio ou métricas calculadas de marginais.

## Revisão visual e resultados

A primeira execução do Visual review (#136, HEAD `02e2d739`) confirmou os fluxos, mas encontrou defeitos concretos: o link da PokéAPI manteve amarelo de um tema antigo sobre fundo claro; o número da Pokédex se esticou verticalmente sobre o sprite; a faixa intermediária de fonte do Usage reservou o espaço de rodapé mobile entre controles e conteúdo; o controle de Trick Room aproximou explicação do rótulo; em larguras móveis, o seletor de Nature do alvo podia ultrapassar a área útil. Também faltava uma captura forçada para sprite indisponível.

Foram corrigidos os tokens/cascata do rodapé, o posicionamento do número, o espaço do seletor de fonte, a hierarquia do Usage em telas estreitas, o grid de Trick Room e os limites do popover em relação à navegação fixa. A busca e os selects do Dex também receberam texto compacto para 320 px. A revisão repetida adiciona capturas explícitas de sprite ausente e do popover aberto de Nature em Speed Tiers. O artefato e as conclusões da nova execução serão associados à PR #29 quando a automação terminar.

Os quatro viewports automatizados são 1440, 390, 320 e 720 px. Eles conferem reflow, overflow, estados de loading/erro/vazio, conteúdo extenso, navegação por teclado e áreas de foco; não substituem avaliação humana em navegador nem medem zoom real do sistema.
