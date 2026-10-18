# Licenças de dependências

## Identidade visual do Spinda Stop

O cabeçalho e o favicon solicitam o sprite `327.png` de Spinda da coleção Black/White pela mesma URL versionada: [arquivo na revisão usada](https://github.com/PokeAPI/sprites/blob/7a7d66b1620e646f69afd48dc1273da9033ede9c/sprites/pokemon/versions/generation-v/black-white/327.png). O `<link rel="icon">` aponta para o arquivo PNG hospedado em `raw.githubusercontent.com` nessa revisão. Os demais sprites, incluindo imagens de formas quando mapeadas, tipos e itens, vêm da mesma revisão. O Spinda Stop não mantém cópias locais desses arquivos.

O [`LICENCE.txt` da revisão](https://github.com/PokeAPI/sprites/blob/7a7d66b1620e646f69afd48dc1273da9033ede9c/LICENCE.txt) declara CC0 para o repositório e identifica os direitos autorais das imagens como pertencentes à The Pokémon Company. Uma licença do repositório ou do código do Spinda Stop não licencia automaticamente as imagens nem transfere direitos sobre personagens ou marcas. A [discussão de manutenção do repositório](https://github.com/PokeAPI/sprites/issues/152#issuecomment-675806649) também observa essa distinção. O sprite é carregado da origem solicitada pelo projeto, sem redistribuir uma cópia local; isso registra a proveniência e não afirma uma licença de uso adicional.

O repositório não contém favicon, ícone de aplicativo ou ilustração local de Spinda. O favicon remoto usa o mesmo `327.png` fixado que aparece no cabeçalho. Não há manifesto instalável porque o app ainda não implementa instalação como PWA.

Tipos e itens seguem as mesmas URLs fixadas de PokeAPI/sprites. Se a imagem não carregar ou não existir para a forma específica, a interface mostra o nome e o fallback em vez de trocar silenciosamente pela imagem da forma base. O componente e a lista de IDs usados ficam em `apps/web/src/data/pokemonSprites.js`.

### Formas recentes de Mega Evolução

As imagens exatas de formas recentes que ainda não aparecem na revisão fixada da PokéAPI são carregadas remotamente do índice público de sprites do Pokémon Showdown: [`/sprites/gen5/`](https://play.pokemonshowdown.com/sprites/gen5/). Em 18/10/2026, conferimos os nomes de arquivo por forma no índice e `garchomp-megaz.png` em si (PNG 96×96); a imagem mostra a Mega Garchomp Z e não a Mega Garchomp base. Comparações também confirmaram arquivos próprios para as variantes Z de Absol e Lucario.

O mapa exato em `SHOWDOWN_FORM_SPRITES` cobre 27 das 47 formas recentes do catálogo que têm sprite IDs próprios, incluindo as variantes Mega Z de Absol, Garchomp e Lucario. As outras entradas não tinham uma imagem Showdown com nome e correspondência exatos nessa verificação. Não inferimos sprites de Staraptor, Heatran ou Raichu Mega X/Y. A revisão fixada de PokeAPI/sprites tampouco continha `other/showdown/10309.gif` quando consultada. Esses casos continuam com fallback até existir uma correspondência específica.

Os sprites ficam no domínio do Showdown; o repositório não copia nenhum arquivo de arte. Não encontramos uma declaração específica de licença de redistribuição para essas imagens. A licença do código do simulador ou do site não é tratada como licença da arte. Registramos a origem sem afirmar direito adicional, endosso oficial ou cobertura pela licença MIT do Spinda Stop.

Nomes, personagens e imagens de Pokémon continuam pertencendo a seus titulares; atribuição ao repositório que hospeda os arquivos não transfere direitos. O MIT deste projeto cobre somente o código original.

## `@smogon/calc` 0.12.0

O motor de cálculo está disponível sob a licença MIT. A origem é [smogon/damage-calc](https://github.com/smogon/damage-calc); o arquivo de licença oficial está em [LICENSE](https://github.com/smogon/damage-calc/blob/master/LICENSE). O pacote publica a licença como MIT nos metadados do npm.

Copyright (c) 2013-2025 Honko and other contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Pokémon Showdown (oráculo de validação)

O script `scripts/validate-damage-oracle.mjs` usa uma cópia local compilada de Pokémon Showdown, fixada no commit registrado em `docs/CALC_VALIDATION.md`. Essa cópia é pré-requisito opcional de desenvolvimento; não é dependência do app, não é incluída no bundle e nenhum arquivo do simulador é redistribuído pelo Spinda Stop. O projeto Pokémon Showdown publica o simulador sob a licença MIT: [repositório e licença](https://github.com/smogon/pokemon-showdown/blob/f0e61e58ad297885578231746036438e1b42f40a/LICENSE).
