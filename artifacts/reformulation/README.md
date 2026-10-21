# Evidência da reformulação — PR #30

Este pacote organiza imagens reais usadas para comparar o Spinda Stop antes/depois. Capturas de referência são documentação de pesquisa, não assets carregados pela aplicação.

## Inventário

- `references/lived-sites/`: 17 screenshots individuais de Pikalytics (7), Champions Lab (2) e Silph Scope (8), em desktop. URLs, viewports conhecidos, ações/estados e decisões estão em [docs/SECOND_VISUAL_RESEARCH.md](../../docs/SECOND_VISUAL_RESEARCH.md).
- `references/datadex/`: 15 imagens DataDex fornecidas pelo usuário e um contato visual. Cada captura tem 945×2048 px; URL/build e ações originais não foram fornecidos. Não presumimos direitos além de uso como referência nesta conversa.
- `before/desktop/`, `before/mobile-390/`, `before/mobile-320/`: nove rotas capturadas na composição anterior do Spinda Stop.
- `after/desktop/`, `after/mobile-390/`, `after/mobile-320/`, `after/reflow-720/`: primeiras dobras das mesmas nove rotas depois da reformulação. Desktop/390 vêm do modo rápido; 320/720 são capturas complementares feitas no Preview local para comparar reflow. O gate completo do CI mantém seus próprios cenários, axe e fluxos PostgreSQL.
- `calculator-selection/`: quatro estados de golpe e seleção por teclado/toque do Spinda Stop.

O total de capturas de referência de terceiros arquivadas é 17 + 15 imagens DataDex. Algumas sessões de VGC Multi Calc, Pokémon Showdown, rental e outros estados foram exploradas interativamente, mas o navegador Work só exibiu screenshots no fluxo da sessão e não permitiu gravá-los no workspace. Por isso este pacote fica abaixo das 60–70 screenshots pedidas; não foram criadas imagens repetidas nem capturas sintéticas para atingir uma contagem.

## Sequência do cálculo

A amostra automatizada usa Rillaboom contra Incineroar. Os quatro golpes selecionados por clique ou toque e seus resultados são Wood Hammer (45–53), Grassy Glide (21–24), U-turn (35–42) e Knock Off (16–19). `four-moves-sequence.jpg` junta os quatro estados em ordem; os PNGs individuais preservam cada captura. `desktop-calculator-keyboard-active-move.png` mostra ativação via teclado; `mobile-calculator-four-moves-selected.png` mostra os quatro slots em viewport de 390 px.

## Limites

As capturas atuais de código local podem mostrar o fallback nomeado do sprite: a origem de imagens remota não decodificou neste ambiente. O componente continua usando o ID exato da forma e não troca silenciosamente para a imagem base. O Preview Vercel da PR ainda precisa ser localizado e inspecionado no HEAD final. Desktop e mobile das referências terceiras não foram ambos verificados; o Work Browser não disponibilizou viewport mobile.
