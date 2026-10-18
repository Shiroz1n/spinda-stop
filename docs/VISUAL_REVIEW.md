# Revisão visual

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
