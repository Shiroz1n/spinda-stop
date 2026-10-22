# Pesquisa visual — referências de interface

Esta página conserva as observações que orientaram a reformulação da PR #30. As imagens de terceiros e as capturas temporárias foram retiradas do HEAD para não manter cópias binárias de pesquisa no código-fonte. A documentação abaixo registra URLs, viewport, ações, estados e padrões aproveitados; não afirma que as imagens continuam neste repositório. A captura reproduzível do produto fica nos artefatos de Visual Review do GitHub Actions.

## Referências interativas

| Ferramenta e URLs | Viewport e ações executadas | Estado observado e aplicação no Spinda Stop |
|---|---|---|
| [Champions Lab](https://championslab.xyz/) · [Team Builder](https://championslab.xyz/team-builder) | Desktop, cerca de 1363×936 px; catálogo, editor de Rillaboom, lista pesquisável, busca e seleção de Wood Hammer. Sem controle de viewport mobile disponível. | Seis posições e um integrante ativo no mesmo fluxo; campos de Nature, habilidade, item e golpes junto ao set. No Spinda Stop, os seis slots permanecem visíveis, um set é editado por vez e existem quatro slots guiados de golpe. O resumo observado chegou a mostrar cinco movimentos; isso não virou regra do produto. |
| [Pikalytics Pokédex](https://www.pikalytics.com/pokedex) · [Rillaboom](https://www.pikalytics.com/pokedex/gen9championsvgc2026regmc/rillaboom) · [calculadora](https://www.pikalytics.com/damage-calculator) | Desktop, cerca de 1348–1363×926–936 px; busca/filtros, fichas e formas; troca de Singles/Doubles, geração, golpe, slot vazio, terreno, clima, Nature, item e Mega Abomasnow. Sem viewport mobile disponível. | Golpe fica perto do resultado e seleção/modificadores recalculam dano. Algumas visitas divergiram em rótulos de formato e conteúdo; os números foram descartados. O Spinda Stop usa a lista e o resultado na mesma bancada e separa esses controles de seus avisos de fonte/suporte. |
| [Pokémon Showdown Damage Calculator](https://calc.pokemonshowdown.com/index.html?mode=one-vs-one) | Desktop, cerca de 1348–1363×926–936 px; quatro golpes visíveis e clique em cada um; trocas de habilidade, Nature, item, forma, terreno e modos One vs One, One vs All, All vs One, Champions, Random Battles e Other Metagames. Sem viewport mobile disponível. | Cada slot clicado virou o ativo e atualizou imediatamente dano/rolls; modificadores mudaram o resultado. Aurora Veil permaneceu como golpe de suporte com dano zero. A calculadora do Spinda Stop mantém quatro slots selecionáveis com estado acessível e sinaliza limites do motor. |
| [Silph Scope](https://silph-scope.com/) · [Usage](https://silph-scope.com/usage) · [Matchups](https://silph-scope.com/matchups) · [Rental 085MDPDKDD](https://silph-scope.com/rentals/085MDPDKDD) | Desktop, cerca de 1348–1363×926–936 px; ranking Top 10/Top 25, temporadas, filtros de Usage e rental combinados, seis integrantes e importação de equipe. Sem viewport mobile disponível. | A seleção do Pokémon continuou ligada ao ranking/ficha; filtros reduziram rentals sem esconder os seis sets e a ação de importação. O Spinda Stop aplica essa relação aos dados existentes, sem copiar times ou métricas de terceiros. |
| [VGC Multi Calc](https://vgcmulticalc.com/) · [Team vs Many](https://vgcmulticalc.com/team-vs-many/) · [Many vs Team](https://vgcmulticalc.com/many-vs-team/) · [Speed Calc](https://vgcmulticalc.com/speed-calc/) | Desktop, cerca de 1348–1363×926–936 px; One vs One, Team vs Many, Many vs Team, Speed, busca por Rillaboom, Tailwind e mudanças de set/campo. Sem viewport mobile disponível; One vs One cortou parte da lateral. | Modos de comparação têm estruturas próprias; números e Speed permanecem ligados às entradas. O Spinda Stop separa os modos e não reutiliza números ou o layout cortado. |

As páginas foram navegadas e interagidas em desktop; o navegador disponível na pesquisa não oferecia emulação mobile. Por isso não há alegação de interação mobile nesses serviços. O produto foi revisado separadamente em viewports de 1440, 720, 390 e 320 CSS px.

## DataDex fornecido pelo usuário

Foram examinadas 15 imagens mobile do DataDex, em torno de 945×2048 px cada. A URL, a versão/build e as ações originais não foram fornecidas. A pesquisa usou o DataDex como referência de varredura do catálogo e de hierarquia da ficha. As imagens e a folha de contato foram removidas do repositório; esta menção não autoriza redistribuir a arte ou os dados exibidos.

## Evidência gerada pelo Spinda Stop

As capturas locais de seleção dos quatro golpes e de comparação antes/depois também foram removidas do checkout. `apps/web/test/visual-review.mjs` continua exercitando cada slot, o golpe ativo, teclado, mobile, dano e formas; o workflow `Visual review` anexa as capturas e o relatório ao run da branch, fora do repositório. A ausência dessas imagens no HEAD não remove a cobertura de interação.

## Contagens removidas e limites

| Grupo anteriormente versionado | Arquivos | Uso no produto | Destino da informação/verificação |
|---|---:|---|---|
| Capturas interativas de cinco sites | 69 JPEG | Nenhum; pesquisa documental, sem imports no código/CSS ou bundle. | URL, viewport, ação, estado, limite e padrão útil mantidos nesta página. |
| Imagens DataDex enviadas pelo usuário e contact sheet | 16 JPEG | Nenhum; não importadas pelo app. | Quantidade, resolução aproximada e limitação de proveniência registradas acima. |
| Capturas próprias de quatro golpes | 3 JPEG/PNG | Nenhum; capturas de revisão. | Fluxo permanece no Playwright e é refeito no artefato do Actions. |

Os 88 arquivos de imagem foram removidos do HEAD; a pasta `artifacts/` foi adicionada ao `.gitignore`. Isso não reescreve nem reduz o histórico Git, e arquivos de workflow continuam sendo anexados como artefatos com retenção própria. Os sprites do produto seguem usando URLs versionadas e créditos em [Licenças de terceiros](THIRD_PARTY_LICENSES.md). Disponibilidade geral de golpes e legalidade de Pokémon Champions continuam sendo conceitos distintos.
