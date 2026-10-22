# Pesquisa visual de produto

Este registro preserva as observações úteis da pesquisa feita para a reformulação. O pacote original tinha 69 capturas interativas de cinco ferramentas e 15 telas DataDex fornecidas pelo usuário. Em 22 out. 2026, removi os 88 arquivos de imagem do checkout porque eram documentação visual, não assets do produto, e ocupavam 12.875.038 bytes. Os arquivos ainda existem no histórico Git no commit [`bf89fc5`](https://github.com/Shiroz1n/spinda-stop/tree/bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f/artifacts/reformulation); essa limpeza não reescreve o histórico nem declara direito de redistribuição.

As sessões interativas abaixo foram feitas em desktop. O navegador de pesquisa não ofereceu emulação mobile para os sites ao vivo. As 15 telas DataDex estavam em mobile, 945×2048 px, mas URL, versão/build e ações originais não foram fornecidos. Elas ajudaram a avaliar hierarquia de catálogo, ficha, formas, abas, golpes, tipos e evolução; não são assets nem evidência de licença.

## Champions Lab — catálogo e editor de time

- **URLs:** [catálogo](https://championslab.xyz/) · [Team Builder](https://championslab.xyz/team-builder)
- **Viewport:** desktop, aproximadamente 1363×936 px.
- **Ações:** percorri o catálogo, abri o builder com Rillaboom, editei o integrante, pesquisei Wood Hammer na lista de golpes e selecionei o resultado. Também conferi os estados de time vazio e Nature Adamant.
- **Observado:** seis posições convivem com um integrante selecionado; Nature, habilidade, item e golpes são editados no mesmo fluxo. O resumo da referência pareceu aceitar cinco golpes depois da seleção; essa regra não foi adotada.
- **Aplicação:** manter os seis integrantes visíveis, editar um set por vez e oferecer escolhas guiadas. Nature, habilidade, item e golpes continuam controles separados, com fonte e limites próprios.

## Pikalytics — Pokédex, ficha e calculadora

- **URLs:** [Pokédex](https://www.pikalytics.com/pokedex) · [Rillaboom](https://www.pikalytics.com/pokedex/gen9championsvgc2026regmc/rillaboom) · [calculadora](https://www.pikalytics.com/damage-calculator)
- **Viewport:** desktop, aproximadamente 1348–1363×926–936 px.
- **Ações:** busquei e filtrei espécies, abri fichas e formas, e na calculadora alternei Singles/Doubles e contexto de geração. Selecionei golpes, testei slot vazio, Grassy Terrain, Sun, Nature Adamant, Life Orb e Mega Abomasnow.
- **Observado:** os golpes ficam perto do resultado e modificadores atualizam a faixa de dano. Em uma troca de campo, a referência também trocou o slot ativo. Alguns rótulos/formato divergiram entre visitas; números e regras não foram tratados como dados do produto.
- **Aplicação:** manter golpe, modificadores e resultado na mesma bancada; identificar o golpe ativo persistentemente e distinguir catálogo geral, disponibilidade por versão e legalidade.

## Pokémon Showdown — calculadora

- **URL:** [calculadora One vs One](https://calc.pokemonshowdown.com/index.html?mode=one-vs-one)
- **Viewport:** desktop, aproximadamente 1348–1363×926–936 px.
- **Ações:** montei Abomasnow contra Abomasnow com quatro golpes visíveis e cliquei em cada slot. Depois alterei habilidade, Nature, item, forma, campo e percorri One vs One, One vs All, All vs One, Champions, Random Battles e Other Metagames.
- **Observado:** cada golpe clicado passa a ser ativo e atualiza resultado/rolls. Nature, habilidade, item, forma, campo e modo alteram o cálculo. Aurora Veil continua sendo golpe de suporte com dano zero.
- **Aplicação:** permitir ativar qualquer um dos quatro golpes sem abrir um formulário longo; expor limitações do motor e manter estados claros por teclado e leitor de tela.

## Silph Scope — Usage, Matchups e Rentals

- **URLs:** [home](https://silph-scope.com/) · [Usage](https://silph-scope.com/usage) · [Matchups](https://silph-scope.com/matchups) · [rental 085MDPDKDD](https://silph-scope.com/rentals/085MDPDKDD)
- **Viewport:** desktop, aproximadamente 1348–1363×926–936 px.
- **Ações:** percorri ranking/detalhe, alterei a progressão Top 10/Top 25, combinei filtros de Pokémon, golpe e item em rentals, abri a equipe de seis e testei importação para o editor.
- **Observado:** ranking e detalhe selecionado permanecem ligados. Rental agrega os seis integrantes, itens, habilidades, golpes, Nature/SP, origem e importação; filtros combinados reduzem a lista.
- **Aplicação:** manter seleção e ranking relacionados, e indicar origem ao importar. Não usar as métricas ou equipes da referência sem fonte e contrato autorizados.

## VGC Multi Calc — comparação e Speed

- **URLs:** [calculadora](https://vgcmulticalc.com/) · [Team vs Many](https://vgcmulticalc.com/team-vs-many/) · [Many vs Team](https://vgcmulticalc.com/many-vs-team/) · [Speed](https://vgcmulticalc.com/speed-calc/)
- **Viewport:** desktop, aproximadamente 1348–1363×926–936 px; um modo One vs One cortava a lateral direita.
- **Ações:** abri quatro modos, alterei sets e opções e conferi o recálculo. Em Speed, filtrei Rillaboom e ativei Tailwind; o valor observado mudou de 167 para 334.
- **Observado:** cada comparação tem estrutura própria; resultados e Speed ficam associados às entradas. O valor 167→334 descreve somente aquele estado da referência.
- **Aplicação:** priorizar número e comparação na tela Speed; manter os modos de confronto em fluxos próprios e responsivos. Não copiar valores do site.

## Limites e decisões de uso

- As 69 interações foram feitas em desktop; não há capturas mobile dos sites ao vivo. A interface do Spinda Stop foi revisada separadamente em 1440, 720, 390 e 320 CSS px.
- As imagens removidas do checkout eram capturas de referência, telas DataDex fornecidas e provas de interação da calculadora. O registro acima conserva URL, viewport, ação, estado e decisão; as imagens não são carregadas pelo app.
- PokéAPI, catálogo de `@smogon/calc`, disponibilidade numa versão de jogo e legalidade em Pokémon Champions são fontes distintas. Pikalytics e Showdown não comprovam legalidade de Champions.
- Nenhum HTML, CSS, JavaScript, arte, ícone ou dado competitivo exclusivo dos sites foi copiado. Os sprites usados pelo produto e seus limites estão em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
- Capturas antes/depois da PR #30 e saídas do Visual Review continuam no histórico e nos artefatos de workflow vinculados àquela PR; o checkout atual não guarda imagens de pesquisa nem capturas geradas pelo CI.
