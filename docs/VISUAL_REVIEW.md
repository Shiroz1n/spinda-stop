# Revisão visual

## Modos de revisão

O comando **npm run visual:review:fast -- --pages=calculator,builder** é o ciclo de desenvolvimento para telas selecionadas. Também aceita o argumento **--screens** e a variável **VISUAL_REVIEW_PAGES=calculator,builder**. IDs aceitos: **home**, **dex** (alias **pokedex**), **pokemon** (aliases **detail** e **dex-detail**), **usage**, **builder**, **calculator**, **speed** (alias **speed-tiers**), **rooms** e **tournaments**. Sem seleção, o modo rápido percorre essas rotas. Ele gera capturas da primeira dobra e do foco de teclado em 1440 e 390 CSS px, registra overflow horizontal e erros de aplicação, e não inicia a API comunitária.

O modo rápido não executa axe nem substitui os fluxos extensos. **npm run visual:review** continua sendo o gate completo: constrói o app e percorre todos os cenários nas quatro larguras, incluindo axe e fluxos comunitários com SQLite temporário. Na execução local, aplique migrações primeiro e defina `SPINDA_DB_PATH`; no workflow, o mesmo arquivo temporário é migrado antes do roteiro. O workflow Visual review executa o modo rápido em Salas e Torneios e depois o completo, preservando diretórios de captura separados no mesmo artefato. Ambos os workflows usam concorrência por workflow e PR e cancelam a execução obsoleta da mesma PR. Na PR #30 o modo rápido local percorreu Usage, Calculadora e Builder; os tempos dessa execução são históricos, não uma medição desta revisão.

As medições e os relatórios anteriores abaixo são históricos. Os gates anteriores usavam PostgreSQL; a implementação atual dos fluxos comunitários e dos testes visuais usa SQLite efêmero. As linhas de resultados anteriores preservam o backend efetivamente testado naquele commit.

Cada execução salva inspection.json com o modo, escopo e duração da inspeção (da inicialização do roteiro até o relatório; não inclui o build). Os comandos npm também devem ser cronometrados separadamente para comparar a duração ponta a ponta, incluindo o build.

### Medição da reformulação PR #30

| Modo | Escopo | Duração medida | Leitura |
|---|---|---:|---|
| Rápido, nove rotas | 1440 e 390 px; capturas, foco/teclado, overflow e erros. | 18,446 s na inspeção; 21,8 s ponta a ponta com build. | Ciclo de iteração; não contém axe, cenários completos, 320/720 nem PostgreSQL. |
| Rápido, só calculadora | 1440 e 390 px; quatro golpes e teclado. | 7,489 s na inspeção; 11,3 s ponta a ponta com build. | Evidência específica da seleção guiada; não representa o custo do gate. |
| Rápido, três rotas selecionadas (PR #30) | Usage, calculadora e builder em 1440 e 390 px; quatro golpes, foco/teclado, overflow e erros. | 10,149 s na inspeção; 12,8 s ponta a ponta incluindo o build; 36 observações, 0 falhas. | Iteração da reformulação; sem axe, rotas completas, 320/720 ou PostgreSQL. |
| Completo local | Cenários do roteiro em quatro larguras, axe e tentativas de carregar sprites. | 78,812 s na inspeção; 83,1 s ponta a ponta com build. | `needs-review`: o ambiente local não decodificou o favicon remoto e bloqueou sprites; uma correção de contraste posterior foi validada separadamente com axe. Não é aprovação do gate completo. |
| Completo GitHub #149 (HEAD `cd05036`) | Quatro larguras, axe, fluxos comunitários e PostgreSQL; 420 observações. | 725,0 s no roteiro; 788 s ponta a ponta. | `needs-review`: duas verificações de sprite foram ligadas ao componente errado no modo 1 vs 1, e o clique do reset no mobile-320 ficou sob navegação fixa. O próximo gate cobre as correções sem remover cenários. |
| Completo GitHub #150 (HEAD `e2a1e70`) | Quatro larguras, axe, fluxos comunitários e PostgreSQL; 460 observações. | 793,7 s no roteiro; 863 s workflow. | `needs-review`: primeiro dano do Time vs 1 em 320 px começou em y=704, atrás da navegação fixa em y=696. O artefato registra a captura e a medição; o cabeçalho compacto em até 360 px corrige o espaço sem reduzir cenários. |
| Completo GitHub #151 (HEAD `7848e25`) | Quatro larguras, axe, fluxos comunitários e migração PostgreSQL; 460 observações. | 798,3 s no roteiro; 870 s workflow (14 min 30 s). | `passed`: zero falhas de interação/layout, zero violações axe. Em 320 px, a faixa `109–129` ocupa y=552–581 e termina antes da navegação fixa, que começa em y=696. [Run e capturas](https://github.com/Shiroz1n/spinda-stop/actions/runs/39579394813), [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39579394813/artifacts/12336421698). |
| Completo GitHub #154 (HEAD `6eb0bde`) | Quatro larguras, axe, fluxos comunitários com SQLite; 460 observações e 163 capturas. | 788,8 s na inspeção; 857 s workflow (14 min 17 s). | `passed`: zero falhas e zero violações axe; primeiro dano em 320 px segue em y=552–581, acima da navegação em y=696. A inspeção humana do artefato encontrou dois problemas de hierarquia que axe e overflow não medem; a correção está no follow-up desta PR. [Run e capturas](https://github.com/Shiroz1n/spinda-stop/actions/runs/39590650367), [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39590650367/artifacts/12341803032). |
| Completo GitHub #155 (HEAD `b1edcaa`) | Quatro larguras, axe, fluxos comunitários com SQLite; 464 observações. | 810,1 s na inspeção; 875 s workflow (14 min 35 s). | `needs-review`: os quatro fluxos de troca de fonte por teclado mudaram o estado, mas a alternância desmontou o botão e perdeu foco visível. As duas correções de composição passaram; o follow-up mantém o seletor no pai persistente e testa foco após Enter. [Run e capturas](https://github.com/Shiroz1n/spinda-stop/actions/runs/39593320619), [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39593320619/artifacts/12343212182). |

O gate completo no GitHub roda em todas as rotas e quatro larguras, com axe e fluxos comunitários SQLite; o modo rápido nunca substitui essa execução. Uma auditoria axe pontual de salas em 1440 e 390 px após a correção encontrou zero violações; ela não substitui a auditoria completa. A captura reproduzível e o relatório do HEAD `7848e25` estão no artefato #151 acima.

A leitura manual do artefato #154, depois do gate automático, mostrou o seletor de fonte de Usage separado acima do título (com um vão alto em mobile) e dois resultados A/B estreitos que quebravam os nomes dos golpes no desktop. A composição seguinte aproxima seletor e título, põe a espécie e a posição antes das categorias, e empilha os dois resultados para manter os golpes e números legíveis. O roteiro inclui verificações explícitas dessa hierarquia e da largura dos resultados. O review #155 então mostrou que manter o controle no componente que troca de fonte ainda desmontava o botão e perdia o foco do teclado. O seletor agora fica no pai persistente das duas fontes, e a asserção também verifica `document.activeElement` após Enter.

### Visual review final da PR #30

O run [Visual Review #30](https://github.com/Shiroz1n/spinda-stop/actions/runs/39599792319) no HEAD `1c374273c4c1a675448d6351b19cf9ea3c5f56bd` terminou com sucesso: 464 observações nas larguras 1440, 720, 390 e 320 px, sem falhas nem violações axe, e os fluxos comunitários/SQLite passaram. A inspeção levou 810,1 s e o workflow 841 s (14 min 01 s). O [artefato de capturas e relatório](https://github.com/Shiroz1n/spinda-stop/actions/runs/39599792319/artifacts/12346501530) tem retenção até 4 nov. 2026; as imagens comparativas removidas do checkout continuam no histórico do merge commit `bf89fc5`. Axe e zero overflow não aprovam design por si só.

## PR #17 — inspeção com Playwright

A inspeção foi executada no Chromium do GitHub Actions, com a prévia Vite do próprio build. O run [Visual review #11](https://github.com/Shiroz1n/spinda-stop/actions/runs/39118793206) terminou com `passed`; o artefato reúne 21 capturas por viewport e o relatório da execução.

| Viewport | Capturas | Overflow horizontal | Violações axe nas telas auditadas |
|---|---:|---:|---:|
| Desktop — 1440 × 960 | 21 | 0 px | 0 |
| Mobile simulado — 390 × 844 | 21 | 0 px | 0 |

O roteiro abriu a página inicial, Pokédex, ficha, builder vazio e configurado, calculadora aberta pelo builder, Usage das duas fontes, filtros combinados, histórico, matchups, ladder e calculadora com comparação. Também cobriu busca sem resultado, falha das duas fontes e exportação/importação do set. A amostra exportada manteve espécie, item, natureza, golpe e Stat Points. O [artefato do run](https://github.com/Shiroz1n/spinda-stop/actions/runs/39118793206/artifacts/12132918513) fica disponível por 14 dias.

O teste de teclado confirmou o link de salto no primeiro `Tab`, foco visível de 3 px na Pokédex e ativação do link com `Enter`. A troca entre Battle Data e MetaRoll também funcionou com `Enter`, mantendo o botão ativo e o contorno visíveis.

### Correções feitas a partir da inspeção

- Ajustado o nome acessível do atalho de Usage no builder para incluir seu texto visível.
- Links que identificam o motor da calculadora receberam contraste e sublinhado; axe antes os apontava como links indistinguíveis do texto ao redor.
- A captura inicial agora mostra a página sem foco de teclado; a captura do link de salto fica separada.
- O Playwright combina as quatro facetas visíveis de Garchomp com opções observadas no índice da fonte e registra uma tela filtrada.

As imagens mostram layouts inteiros em 1440 px e 390 px. Li telas, formulários, texto de atribuição e estados de carregamento/erro/vazio nas capturas; não encontrei texto cortado. O artefato contém o relatório e todas as imagens.

## Limites da conferência

O mobile é um viewport simulado em Chromium, não um aparelho físico. Foram testados 390 px; ainda não foi feita uma passagem específica em 320 px, com leitor de tela ou com zoom do sistema. Axe automatiza critérios WCAG 2.1 A/AA, mas não substitui essas verificações.

Esta captura registra a identidade que existia antes do PR próprio de Spinda/GBA. O tema e o mascote serão conferidos de novo em desktop e mobile depois dessa mudança; não use esta rodada como aprovação visual final da nova identidade.

## PR #18 — identidade Spinda/GBA

A nova identidade foi conferida no Chromium do GitHub Actions com a prévia Vite do build. O [run visual #14](https://github.com/Shiroz1n/spinda-stop/actions/runs/39119805042) passou. O [artefato final](https://github.com/Shiroz1n/spinda-stop/actions/runs/39119805042/artifacts/12134105614) contém 42 capturas e o relatório da inspeção; a retenção termina em 01/11/2026.

| Viewport | Imagens | Observações | Overflow | Violações axe |
|---|---:|---:|---:|---:|
| Desktop — 1440 × 960 | 21 | 24 | 0 px | 0 |
| Mobile simulado — 390 × 844 | 21 | 24 | 0 px | 0 |

Foram abertas a página inicial, Pokédex, ficha, builder vazio e configurado, importação/exportação, Usage Battle Data e MetaRoll, histórico, matchups, ladder e calculadora com comparação. Busca sem resultado e erros de ambas as APIs também foram capturados. Navegação por teclado chegou à Pokédex e trocou a fonte do Usage com foco visível. O set exportado e importado preservou espécie, item, natureza, golpe e Stat Points.

A primeira execução apontou contraste 4,45:1 no texto de confirmação verde. O verde da interface e dos ícones foi escurecido para `#2C704A` (4,83:1 no fundo da página); a segunda execução não encontrou violações axe. A inspeção manual das capturas finais não encontrou cortes ou overflow.

O mobile continua sendo viewport simulado, sem aparelho físico. Ficam fora desta rodada uma passagem dedicada a 320 px, zoom do sistema e leitor de tela. A validação automatizada cobre apenas os critérios axe configurados; não substitui essas verificações.

Para abrir a branch localmente:

```sh
git clone https://github.com/Shiroz1n/spinda-stop.git
cd spinda-stop
git fetch origin fix/visual-review-captures
git switch --track origin/fix/visual-review-captures
npm ci
npm run dev
```

Abra o endereço impresso pelo Vite. Para reproduzir as capturas automatizadas, rode `npx playwright install chromium` e `npm run visual:review`.

## PR #19 — cenários da calculadora

O [run visual #17](https://github.com/Shiroz1n/spinda-stop/actions/runs/39121625423) conferiu a comparação de cenários em desktop e mobile simulado. Foram 24 observações por viewport, sem overflow, violações axe ou falhas do roteiro. A captura registra as diferenças entre golpe em área e alvo único e os rolls da comparação. O [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39121625423/artifacts/12134655923) fica disponível por 14 dias.

## PR #20 — histórico de rating

O [run visual #18](https://github.com/Shiroz1n/spinda-stop/actions/runs/39122085195) passou com 24 observações por viewport, sem overflow, violações axe ou falhas. O gráfico foi inspecionado em desktop e mobile e manteve a oscilação publicada, sem suavizar os valores. O [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39122085195/artifacts/12135071093) guarda as imagens e o relatório por 14 dias.

## PR #21 — formas Mega da MetaRoll

O [run visual #19](https://github.com/Shiroz1n/spinda-stop/actions/runs/39122383830) terminou com `passed`. O artefato contém 46 imagens, 23 por viewport, e 26 observações por viewport. O relatório marcou zero overflow, zero falhas e zero violações axe. Foram capturadas a ficha de Garchomp com as formas Mega e a falha isolada de `/megas.json`; ambas foram abertas e conferidas em desktop e mobile. A falha ficou clara, com ação de nova tentativa e sem esconder a ficha principal. O [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39122383830/artifacts/12134493450) expira em 01/11/2026.

Esta rodada verificou interface em viewport Chromium simulado. Não substitui aparelho físico, teste em 320 px, zoom do sistema ou leitor de tela.

## PR #22 — contas e salas privadas

O [run visual #25](https://github.com/Shiroz1n/spinda-stop/actions/runs/39125761848) passou com 70 observações, 32 capturas por viewport (64 PNGs), zero overflow, zero falhas e zero violações axe. O roteiro abriu Pokédex, ficha, builder, Usage das duas fontes, histórico, matchups, ladder, calculadora e os fluxos de conta, equipe pública/privada e sala, incluindo estados vazios, erros, convite e confirmação.

| Viewport | Capturas | Observações | Overflow | Violações axe |
|---|---:|---:|---:|---:|
| Desktop — 1440 × 960 | 32 | 35 | 0 px | 0 |
| Mobile simulado — 390 × 844 | 32 | 35 | 0 px | 0 |

As imagens finais foram conferidas depois de corrigir o corte do controle de visibilidade da equipe salva. O [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39125761848/artifacts/12136490304) fica disponível até 01/11/2026.

## PR #23 — torneios privados

O [run visual #26](https://github.com/Shiroz1n/spinda-stop/actions/runs/39127077428) passou com 84 observações, 39 capturas por viewport (78 PNGs), zero overflow, zero falhas e zero violações axe. Além das telas verificadas no PR #22, abriu listagem vazia e com erro, convite, login, semifinais, final e conclusão do torneio.

| Viewport | Capturas | Observações | Overflow | Violações axe |
|---|---:|---:|---:|---:|
| Desktop — 1440 × 960 | 39 | 42 | 0 px | 0 |
| Mobile simulado — 390 × 844 | 39 | 42 | 0 px | 0 |

O fluxo de teclado confirmou link de salto, foco de 3 px nos links e troca de fonte com `Enter`. Conferi manualmente as capturas de semifinais em desktop e mobile, Pokédex desktop, builder mobile, Usage filtrado desktop e calculadora mobile; não encontrei corte ou quebra de layout nessas telas. O [artefato da execução](https://github.com/Shiroz1n/spinda-stop/actions/runs/39127077428/artifacts/12136701660) contém o relatório e as imagens e expira em 01/11/2026.

Esta inspeção usa Chromium e viewport mobile simulado de 390 × 844. Não cobre aparelho físico, 320 px, zoom do sistema nem leitor de tela. O resultado de axe não substitui essa avaliação manual.
