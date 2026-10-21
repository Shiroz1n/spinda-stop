# Revisão visual

## Modos de revisão

O comando **npm run visual:review:fast -- --pages=calculator,builder** é o ciclo de desenvolvimento para telas selecionadas. Também aceita o argumento **--screens** e a variável **VISUAL_REVIEW_PAGES=calculator,builder**. IDs aceitos: **home**, **dex** (alias **pokedex**), **pokemon** (aliases **detail** e **dex-detail**), **usage**, **builder**, **calculator**, **speed** (alias **speed-tiers**), **rooms** e **tournaments**. Sem seleção, o modo rápido percorre essas rotas. Ele gera capturas da primeira dobra e do foco de teclado em 1440 e 390 CSS px, registra overflow horizontal e erros de aplicação, e não inicia o servidor comunitário/PostgreSQL.

O modo rápido não executa axe nem substitui os fluxos extensos. **npm run visual:review** continua sendo o gate completo: constrói o app e percorre todos os cenários nas quatro larguras, incluindo axe, fluxos comunitários e PostgreSQL quando DATABASE_URL está configurada. O workflow Visual review executa esse modo completo em cada PR. Ambos os workflows usam concorrência por workflow e PR e cancelam a execução obsoleta da mesma PR. Nesta rodada rodei `npm run visual:review:fast -- --pages=usage,calculator,builder` para percorrer as três telas afetadas sem repetir os demais cenários.

Cada execução salva inspection.json com o modo, escopo e duração da inspeção (da inicialização do roteiro até o relatório; não inclui o build). Os comandos npm também devem ser cronometrados separadamente para comparar a duração ponta a ponta, incluindo o build.

### Medição da reformulação PR #30

| Modo | Escopo | Duração medida | Leitura |
|---|---|---:|---|
| Rápido, nove rotas | 1440 e 390 px; capturas, foco/teclado, overflow e erros. | 18,446 s na inspeção; 21,8 s ponta a ponta com build. | Ciclo de iteração; não contém axe, cenários completos, 320/720 nem PostgreSQL. |
| Rápido, só calculadora | 1440 e 390 px; quatro golpes e teclado. | 7,489 s na inspeção; 11,3 s ponta a ponta com build. | Evidência específica da seleção guiada; não representa o custo do gate. |
| Rápido, três rotas selecionadas (rodada atual) | Usage, calculadora e builder em 1440 e 390 px; quatro golpes, foco/teclado, overflow e erros. | 10,149 s na inspeção; 12,8 s ponta a ponta incluindo o build; 36 observações, 0 falhas. | Iteração final das telas afetadas; sem axe, rotas completas, 320/720 ou PostgreSQL. |
| Completo local | Cenários do roteiro em quatro larguras, axe e tentativas de carregar sprites. | 78,812 s na inspeção; 83,1 s ponta a ponta com build. | `needs-review`: o ambiente local não decodificou o favicon remoto e bloqueou sprites; uma correção de contraste posterior foi validada separadamente com axe. Não é aprovação do gate completo. |
| Completo GitHub #149 (HEAD `cd05036`) | Quatro larguras, axe, fluxos comunitários e PostgreSQL; 420 observações. | 725,0 s no roteiro; 788 s ponta a ponta. | `needs-review`: duas verificações de sprite foram ligadas ao componente errado no modo 1 vs 1, e o clique do reset no mobile-320 ficou sob navegação fixa. O próximo gate cobre as correções sem remover cenários. |

O gate completo no GitHub roda em todas as rotas e quatro larguras, com axe, fluxos comunitários e PostgreSQL; a descrição da PR registra a duração e o artefato do HEAD final. O modo rápido nunca substitui essa execução. Uma auditoria axe pontual de salas em 1440 e 390 px após a correção encontrou zero violações; ela não substitui a auditoria completa.

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
