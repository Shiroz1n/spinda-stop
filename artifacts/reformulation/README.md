# Evidência da reformulação — PR #30

A PR #30 foi mesclada em `main` no commit [`bf89fc5`](https://github.com/Shiroz1n/spinda-stop/commit/bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f). Este diretório mantém pesquisa visual que ainda orienta o produto; capturas geradas pelo CI ficam nos artefatos do Actions, não no checkout.

## Pesquisa mantida

- `references/lived-sites/`: 69 capturas reais em cinco grupos. O [manifesto](references/lived-sites/README.md) registra URL, viewport, ação, estado observado e padrão aproveitado. A navegação interativa disponível foi desktop; os sites não ofereceram viewport móvel nesta pesquisa.
- `references/datadex/`: 15 imagens DataDex fornecidas pelo usuário, cada uma 945×2048 px, em mobile. URL, versão/build e ações originais não foram fornecidos. `contact-sheet.jpg` é uma montagem para inspeção, não uma tela adicional.
- As capturas de comparação **antes/depois** permanecem acessíveis no histórico da PR #30, fixadas ao merge commit [`bf89fc5`](https://github.com/Shiroz1n/spinda-stop/tree/bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f/artifacts/reformulation). Exemplos: [Dex desktop antes](https://github.com/Shiroz1n/spinda-stop/blob/bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f/artifacts/reformulation/before/desktop/dex.png) → [depois](https://github.com/Shiroz1n/spinda-stop/blob/bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f/artifacts/reformulation/after/desktop/dex.png); [Dex 390 px antes](https://github.com/Shiroz1n/spinda-stop/blob/bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f/artifacts/reformulation/before/mobile-390/dex.png) → [depois](https://github.com/Shiroz1n/spinda-stop/blob/bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f/artifacts/reformulation/after/mobile-390/dex.png).
- As capturas e o relatório do Visual Review completo do HEAD que abriu a PR #30 podem ser baixados do [artefato do run 39599792319](https://github.com/Shiroz1n/spinda-stop/actions/runs/39599792319/artifacts/12346501530); o GitHub informa retenção até 4 nov. 2026. O histórico do commit acima mantém as comparações depois dessa expiração.

As imagens de referência continuam em documentação de pesquisa; não são carregadas pelo app nem concedem direitos de redistribuição, uso comercial ou incorporação de arte, texto, ícones ou dados de terceiros. Origens e limites estão no [manifesto](references/lived-sites/README.md) e em [THIRD_PARTY_LICENSES.md](../../docs/THIRD_PARTY_LICENSES.md).

## Seleção de golpes

`calculator-selection/four-moves-sequence.jpg` preserva a sequência dos quatro golpes: Wood Hammer (45–53), Grassy Glide (21–24), U-turn (35–42) e Knock Off (16–19). [A captura de teclado](calculator-selection/desktop-calculator-keyboard-active-move.png) registra ativação acessível; [a captura mobile](calculator-selection/mobile-calculator-four-moves-selected.png) mostra os quatro slots em 390 px. Os estados numéricos são da fixture de teste do Spinda Stop, não das referências externas.

Quatro PNGs individuais de golpe foram removidos nesta revisão porque repetiam os quatro quadros da sequência composta. O teste de navegador continua a selecionar cada golpe e verificar a atualização do dano; os estados acessíveis exclusivos de teclado e mobile foram mantidos.

## Modos de revisão e medições

O modo rápido foi medido em 10,149 s de inspeção (12,8 s incluindo build) para Usage, Calculadora e Builder, em 1440 e 390 px; registrou 36 observações e 0 falhas. Inclui capturas, foco/teclado, overflow e erros, mas não equivale ao gate completo. O [histórico dos modos e execuções completas](../../docs/VISUAL_REVIEW.md) separa as medições por escopo.

O completo #30 percorreu 464 observações nas quatro larguras, com zero falhas e zero violações axe; levou 810,1 s na inspeção e 841 s ponta a ponta (14 min 01 s). O artefato e a PR registram essa execução. Essa revisão automatizada não substitui inspeção humana de hierarquia visual.

## Vercel e estado remoto

Na revisão da PR #30, o deployment `Ready` identificado era `https://spinda-stop-visual-staging-b72suj63g-alaninhuma-s-projects.vercel.app`, ambiente `production`, branch `main`, SHA `d5ef83f15487111e1a18cdef73f31b19eb62e14c`; ele não correspondia à PR. Nesta revisão, o conector Vercel não tem acesso concedido ao time do projeto (resposta 403), portanto não foi possível confirmar URL/commit de um deployment posterior ao merge. Nenhum deploy foi iniciado manualmente nesta revisão.

Os sprites do produto continuam usando a forma exata, com fallback nomeado e proveniência documentada. `@smogon/calc` e aprendibilidade geral são fontes distintas; não provam disponibilidade ou legalidade em Pokémon Champions.

## Limpeza desta revisão

Antes da limpeza, os arquivos em `artifacts/reformulation/` ocupavam 19.899.041 bytes. Foram removidos 63 PNGs temporários do Visual Review (27 `before/`, 36 `after/`; 6.347.417 bytes) e quatro PNGs individuais dos golpes (662.207 bytes), redundantes com a sequência composta. Permanecem as 69 referências interativas, as 15 telas DataDex, o contato de inspeção, a sequência composta e as capturas distintas de teclado e mobile. Saíram 7.009.624 bytes de imagens; com a ampliação deste índice, o conteúdo versionado da pasta passou a 12.890.694 bytes (redução líquida de 7.008.347 bytes). Isso não reduz o histórico Git. Nenhum documento ou teste foi removido.
