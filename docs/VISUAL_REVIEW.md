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
