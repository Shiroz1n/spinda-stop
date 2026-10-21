# Crítica e mudanças do redesign

> A tabela seguinte preserva a crítica que abriu a rodada. A PR #30 aplica a composição estrutural e os critérios do UI Humanizer; a auditoria atual e suas capturas ficam no final do documento.

As capturas do PR #23 registram uma CI correta, mas uma interface que não serve como Pokédex visual. Esta crítica trata as imagens como referência de antes, não como aprovação estética.

| Tela nas capturas #23 | Problema visível | Mudança planejada |
|---|---|---|
| Home desktop/mobile | Área vazia grande, texto sobre roteiro e contagens de catálogo; nenhuma espécie em destaque. No mobile, o menu quebra em duas linhas. | Hero com Spinda e espécies visíveis; três caminhos diretos para Dex/meta, time e partidas; navegação mobile própria. Remover roadmap e contagens técnicas da home. |
| Pokédex desktop/mobile | Grade de texto sem imagem; muito pequena frente ao catálogo. | Cards compactos com sprite, nome, número e tipos; busca e filtros mantidos; páginas de resultados sem listas enormes. |
| Ficha de espécie | O espaço principal mostra um número sem sprite; dados gerais têm pouco contraste de hierarquia. | Hero ilustrado da forma escolhida, tags com símbolo e nome do tipo, stats comparáveis e acesso direto ao Usage/builder. |
| Builder | Seis integrantes sem imagem; set e campos se perdem num formulário comprido. | Slots visuais com sprite e seleção clara; painel de edição em foco; no mobile, slots viram seleção horizontal/etapas, sem seis formulários empilhados. Importação, exportação, contas e vínculo com a calculadora permanecem. |
| Usage Battle Data e MetaRoll | Busca, filtros, fonte e ficha são estreitos; não há imagem para localizar a espécie; a página parece documentação. | Separar navegação de espécie e ficha; ranking com imagens; distribuição em barras legíveis; fonte, captura e horário do app juntos; filtros dependem dos campos de cada provedor. |
| Calculadora | Quatro blocos de set competem com o resultado; os dois lados ficam escondidos em uma página longa. | Atacante e alvo ilustrados na primeira dobra, resultado em destaque, configurações avançadas recolhidas e comparação independente lado a lado. |
| Salas e torneios | Painéis pequenos flutuam em uma área vazia; estado e próxima ação não têm prioridade. | Cabeçalho de estado e próxima ação; participantes e equipes só quando compartilhadas; conteúdo principal ocupa a largura útil. |
| Mobile em geral | Menu em duas linhas e telas longas sem checkpoints; controles e dados perdem leitura. | Barra inferior para fluxos principais, menu de comunidade separado, inputs e alvos de toque confortáveis, filtros progressivos e layout específico para 320 px. |

## Critérios de revisão

- Verificar imagens e fluxos renderizados em Chromium nas larguras 1440, 390 e 320 px; conferir também 200% de zoom em viewport CSS estreito.
- Abrir home, Dex, ficha, builder vazio/preenchido, Usage em ambas as fontes, histórico, matchups, ladder, calculadora, sala e torneio.
- Capturar carregamento, falha, resultado vazio e dado ausente quando a tela tiver esses estados.
- Conferir busca, filtros, troca de fonte, posição dos rankings após atualização, importação/exportação com o set preservado e navegação por teclado.
- Ler as capturas manualmente antes de considerar a revisão visual concluída. Axe, build e ausência de overflow são verificações separadas.

## Pente-fino acumulado dos PRs #24–#27

Abri as capturas do artefato do workflow visual do #27 em 1440, 390, 320 e 720 px de largura. A tela de ficha, o builder, Usage das duas fontes, calculadora, sala e torneio foram inspecionados em imagem integral. O snapshot ainda não aprova a interface: encontrei texto claro quase invisível na navegação desktop e no rodapé, baixo contraste do botão coral, “Garchomp” quebrado em “Garcho / mp” na ficha mobile, link de ajuda indistinguível do parágrafo e listas de equipe com rótulos ARIA sem papel semântico. O teste de visibilidade também selecionava uma equipe e clicava no botão desabilitado de outra.

Corrigi a cor da navegação e seu hover para a barra clara, restabeleci o rodapé azul-petróleo com texto legível, escureci o coral para contraste AA, removi a regra mobile antiga que recolocava a ficha em duas colunas e distingui links de ajuda com sublinhado. As equipes salvas agora usam listas e itens semânticos; os sprites da equipe são imagens nomeadas para leitores de tela. O teste de visibilidade atualiza e verifica a mesma linha. Em 320 px, os slots do builder agora mantêm a espécie legível ao lado do sprite.

A captura final da branch revisada foi gerada pelo Chromium do GitHub Actions: 164 imagens e 300 observações em 1440, 390, 320 e 720 px CSS. Não houve overflow, falha de fluxo ou violação axe. Inspecionei as imagens de home, Dex, ficha, builder, Usage das duas fontes, calculadora, salas, torneios, estados vazios/erro e equipes compartilhadas. A comparação manual encontrou nomes quebrados nos slots a 720 px e papel/status de participante colados; o PR #27 passou a usar uma coluna de slots nessa largura e a separar o status, confirmado na nova captura. O viewport de 720 px verificou reflow; não foi feito zoom real do navegador.

A revisão local tentou instalar Playwright Chromium, mas o download foi truncado; não há prévia navegável ligada ao repositório. As imagens do runner de CI permitiram a inspeção visual completa. As capturas do PR #23 servem de antes para desktop e 390 px; não existe baseline de 320 px, então esse tamanho está registrado apenas como estado final.

## Auditoria visual da PR #30

`docs/UI_HUMANIZER.md` foi usado durante o desenho do JSX/CSS e a comparação visual: remover cartões uniformes quando catálogo/lista é a unidade correta, retirar badges sem semântica, reduzir molduras, priorizar a tarefa e o objeto Pokémon, e manter vazios/erros com próxima ação.

| Tela | Antes → depois observado | Decisão aplicada | Estado/limite |
|---|---|---|---|
| Home | Demonstração de catálogo e cartões repetidos → busca editorial e atalhos úteis. | Hero assimétrico, marca Spinda e cinco destinos funcionais. | Sem dados de atividade inventados. |
| Pokédex | Grade miúda e CTA/stats repetidos → grade mais escaneável com sprite e identidade. | Nomes, forma e tipos são o peso de cada linha/card; filtros mantidos em segundo plano. | Imagens reais dependem do host dos sprites; fallback mantém espécie e forma nomeadas. |
| Ficha | Conteúdo em painéis de hierarquia semelhante → identidade da forma antes da consulta por seção. | Forma, sprite, tipo e nome abrem; evolução, formas, stats, relações e perfil vêm depois. | Dados gerais não atestam disponibilidade ou legalidade Champions. |
| Usage | Metadados antes de lista e detalhe → ranking e espécie selecionada na primeira leitura. | Fonte/período são rótulos curtos; filtros e dados extensos ficam abaixo/colapsados. | Captura local mostra erro da fonte indisponível; ranking do provedor não esteve disponível em todas as execuções. |
| Builder | Múltiplos painéis competindo → seis seletores e um editor ativo. | Seis slots visíveis e campos do único set selecionado em fluxo único. | Importação/exportação e formato do set são preservados por testes. |
| Calculadora | Digitação do golpe em controle textual e formulário longo → seleção por slot e resultado em bancada. | Quatro slots por lado, lista pesquisável, golpe ativo com estado semântico e recalculo imediato. | Quatro estados numéricos, teclado, item/habilidade/Nature/SP/campo testados; limites do motor documentados. |
| Speed | Texto de fórmula repetido → valor e lista comparável antes da explicação. | Alvo e resultado acima; fórmula e limites fora do foco primário. | Velocidade calculada, não ranking de uso. |
| Salas e torneios | Introdução/formulário antes da operação → estado e próxima ação no início. | Estado, pessoas/chave, ação e recuperação do erro seguem a ordem da tarefa. | Fluxos comunitários continuam gate de PostgreSQL no workflow completo. |

A comparação visual direta em desktop e 390 px, junto dos exemplos em 320 e 720 px, está preservada em links por viewport no [índice de evidências](../artifacts/reformulation/README.md) e no histórico do merge commit `bf89fc5`; as cópias geradas pelo CI foram removidas do checkout. A sequência dos quatro golpes e os estados exclusivos de teclado/mobile ficam em `artifacts/reformulation/calculator-selection/`. Axe e overflow são verificações técnicas; a aprovação da composição depende da inspeção manual das capturas.
