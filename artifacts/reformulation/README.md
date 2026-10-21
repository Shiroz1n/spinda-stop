# Evidência da reformulação — PR #30

Este pacote organiza capturas de pesquisa, comparações visuais do Spinda Stop e estados da calculadora. As capturas de terceiros são documentação de pesquisa, não assets do produto.

## Inventário

- `references/lived-sites/`: 69 capturas reais em cinco grupos. O [manifesto](references/lived-sites/README.md) lista cada arquivo e registra URL, viewport, ação, estado observado e o que foi aplicado no Spinda Stop. As ferramentas de terceiros foram interagidas em desktop; a sessão não ofereceu viewport mobile.
- `references/datadex/`: 15 imagens do DataDex fornecidas pelo usuário, cada uma 945×2048 px, em mobile. URL, versão/build e ações originais não foram fornecidos. `contact-sheet.jpg` é apenas uma montagem de inspeção, não uma décima sexta tela.
- `before/desktop/`, `before/mobile-390/` e `before/mobile-320/`: nove rotas na composição anterior.
- `after/desktop/`, `after/mobile-390/`, `after/mobile-320/` e `after/reflow-720/`: 36 capturas pós-reformulação extraídas do Visual review #151 no HEAD `7848e25`; incluem sprites carregados, catálogo, ficha, Usage com dados de revisão, time configurado e calculadora. Foram conferidas junto ao [run completo](https://github.com/Shiroz1n/spinda-stop/actions/runs/39579394813) e seu [artefato](https://github.com/Shiroz1n/spinda-stop/actions/runs/39579394813/artifacts/12336421698). O gate também mantém cenários não representados nestas capturas de comparação, axe, fluxos comunitários e PostgreSQL.
- `calculator-selection/`: estados de quatro golpes selecionados, ativação por teclado/toque e saída visual em sequência.

O total de pesquisa visual é **69 capturas de terceiros + 15 telas DataDex**. As imagens foram arquivadas por estado distintivo, sem repetições sintéticas. São usadas para revisão interna do redesign; não concedem direitos de redistribuição, uso comercial ou incorporação de texto, arte, ícones ou dados alheios.

## Sequência do cálculo

A amostra automatizada usa Rillaboom contra Incineroar. Os quatro golpes selecionados por clique/toque atualizam o cálculo: Wood Hammer (45–53), Grassy Glide (21–24), U-turn (35–42) e Knock Off (16–19). `calculator-selection/four-moves-sequence.jpg` junta a sequência; PNGs individuais mostram os estados de cada golpe. `desktop-calculator-keyboard-active-move.png` registra teclado e `mobile-calculator-four-moves-selected.png` mostra os quatro slots em 390 px. Esses números são da fixture de teste do Spinda Stop, não das referências externas.

## Revisão e serviços

O modo rápido foi medido em 10,149 s de inspeção (12,8 s ponta a ponta incluindo build) para Usage, Calculadora e Builder, em 1440 e 390 px; registrou 36 observações e 0 falhas. Inclui capturas, foco/teclado, overflow e erros; não equivale ao gate completo. Tempos históricos e a medição final do gate ficam em [docs/VISUAL_REVIEW.md](../../docs/VISUAL_REVIEW.md).

O gate completo #151 levou 798,3 s no roteiro e 870 s ponta a ponta, percorreu 460 observações nas quatro larguras, encontrou zero falhas e zero violações axe e passou pela migração PostgreSQL. A captura da primeira faixa de dano em 320 px ficou acima da navegação fixa. O modo rápido não substitui essa revisão integral.

O deployment Vercel `Ready` existente é `https://spinda-stop-visual-staging-b72suj63g-alaninhuma-s-projects.vercel.app`, ID `dpl_FS7PQGBhEbKYsGUnj3rp4muoHXjJ`. O ambiente reportado é `production`, branch `main`, SHA `d5ef83f15487111e1a18cdef73f31b19eb62e14c`; ele não corresponde ao HEAD desta PR. Não foi encontrado deployment Vercel vinculado ao HEAD da PR, portanto essa URL não foi usada para aprovar o redesign.

Os sprites próprios continuam apontando para IDs/URLs de forma exata, com fallback nomeado e direitos registrados em `docs/THIRD_PARTY_LICENSES.md`. Nenhuma forma é substituída silenciosamente por sua forma base. O pacote `@smogon/calc` e as listas gerais de aprendibilidade são fontes distintas; não provam disponibilidade/legalidade Champions. A PR segue aberta; nenhum merge ou deploy de produção foi feito.
