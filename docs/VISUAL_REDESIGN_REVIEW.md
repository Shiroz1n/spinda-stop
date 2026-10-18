# Crítica e mudanças do redesign

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
