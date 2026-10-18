# Licenças de dependências

## Identidade visual do Spinda Stop

O cabeçalho mostra o sprite de Spinda `327.png` da coleção Black/White em [PokeAPI/sprites](https://github.com/PokeAPI/sprites/blob/7a7d66b1620e646f69afd48dc1273da9033ede9c/sprites/pokemon/versions/generation-v/black-white/327.png). A mesma revisão fornece os sprites de espécie, formas, tipos e itens. O navegador solicita esses arquivos ao host PokeAPI; não servimos uma cópia dos sprites a partir do Spinda Stop.

O arquivo [`LICENCE.txt`](https://github.com/PokeAPI/sprites/blob/7a7d66b1620e646f69afd48dc1273da9033ede9c/LICENCE.txt) declara CC0 para o repositório e, ao mesmo tempo, diz que todo o conteúdo de imagens é copyright de The Pokémon Company. Essa declaração do repositório não concede por si só direitos sobre as imagens Pokémon nem afeta marcas. Por isso os sprites são solicitados diretamente ao host PokeAPI; o Spinda Stop não mantém uma cópia local desses arquivos. O mascote visível no cabeçalho é o `327.png` da coleção Black/White no commit fixado acima — não o arquivo indicado pelo link do Pokémon Database.

Os favicons SVG de `favicon.svg` e `favicon-16.svg` são desenhos vetoriais locais inspirados na assimetria do rosto de Spinda. O ícone PNG de 32 px, o ícone de 512 px e o Apple touch icon de 180 px usam uma ilustração pixel art original criada para o Spinda Stop com ImageGen em 18 de outubro de 2026 e convertida com escala nearest-neighbor, sem suavização. Ela foi inspirada no sprite de referência, não é uma cópia dos pixels oficiais. Não há manifesto instalável porque o app ainda não implementa instalação como PWA.

Tipos e itens seguem as mesmas URLs fixadas de PokeAPI/sprites. Se a imagem não carregar ou não existir para a forma específica, a interface mostra o nome e o fallback em vez de trocar silenciosamente pela imagem da forma base. O componente e a lista de IDs usados ficam em `apps/web/src/data/pokemonSprites.js`.

Nomes, personagens e imagens de Pokémon continuam pertencendo a seus titulares; atribuição ao repositório que hospeda os arquivos não transfere direitos. O MIT deste projeto cobre somente o código original.

## `@smogon/calc` 0.12.0

O motor de cálculo está disponível sob a licença MIT. A origem é [smogon/damage-calc](https://github.com/smogon/damage-calc); o arquivo de licença oficial está em [LICENSE](https://github.com/smogon/damage-calc/blob/master/LICENSE). O pacote publica a licença como MIT nos metadados do npm.

Copyright (c) 2013-2025 Honko and other contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Pokémon Showdown (oráculo de validação)

O script `scripts/validate-damage-oracle.mjs` usa uma cópia local compilada de Pokémon Showdown, fixada no commit registrado em `docs/CALC_VALIDATION.md`. Essa cópia é pré-requisito opcional de desenvolvimento; não é dependência do app, não é incluída no bundle e nenhum arquivo do simulador é redistribuído pelo Spinda Stop. O projeto Pokémon Showdown publica o simulador sob a licença MIT: [repositório e licença](https://github.com/smogon/pokemon-showdown/blob/f0e61e58ad297885578231746036438e1b42f40a/LICENSE).
