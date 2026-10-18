# Calculadora de dano

A tela `/calculator` usa `@smogon/calc` 0.12.0 no navegador. Os sets ficam no dispositivo e não são enviados a uma API. O motor tem um modo de mecânicas de Pokémon Champions, mas isso não confirma sozinho que cada regra atual do jogo esteja correta.

## O que o cálculo representa

- Nível 50. Stat Points são passados como pontos de atributo do modo Champions: HP é `base + SP + 75` (ou 1 para base 1); os outros stats são `floor((base + SP + 20) × nature)`, com modificador 1,1 / 1 / 0,9.
- Espécies, formas, golpes, habilidades, itens e natures vêm do catálogo fixado dentro da dependência. Isso não valida se a combinação é permitida no jogo ou no regulamento atual.
- O motor calcula 16 rolls para um golpe de dano. A página mostra todos os 16 para um golpe de um acerto. Em multi-hit, mostra 16 por acerto dentro de “Ver resultados”; não combina as distribuições nem estima a frequência de cada quantidade de acertos.
- Em Doubles, golpes de `allAdjacent` ou `allAdjacentFoes` mostram a quantidade de alvos válidos. Com um alvo não há redutor; com dois ou mais, o motor aplica 0,75×. A faixa mostrada continua sendo por alvo. Golpes de alvo único não recebem esse redutor.
- OHKO e 2HKO aparecem apenas quando as premissas do cenário permitem. São contagens condicionais dos 16 rolls: exigem acerto e mantêm o crítico selecionado. O alvo começa no HP máximo. Para 2HKO, a tela omite o valor se o alvo ou atacante tem item, se a habilidade do alvo pode mudar o dano ou o campo entre golpes, se um golpe de contato ativa uma habilidade reativa conhecida, se o próprio golpe reduz o atributo ofensivo para o uso seguinte, se um golpe em área é usado em Doubles, ou se há status, clima, terreno ou condições de campo. Para OHKO, omite em Sturdy, Focus Sash, habilidades que alteram a resposta ao primeiro golpe (como Disguise) e qualquer item do alvo. Efeitos que só acontecem depois do primeiro dano (por exemplo, Sand Spit ou Seed Sower) afetam o 2HKO, não o OHKO. Isso não inclui precisão, chance de crítico, efeitos reativos ainda não catalogados ou chance de vencer.
- O painel lista as entradas escolhidas (incluindo forma, natureza, item, habilidade resolvida, status, boosts, golpe e campo) e os fatores e efeitos que o resultado do motor expõe. Para alguns itens e habilidades, o motor só informa que o efeito foi aplicado, sem fator numérico; a tela mostra o nome e não inventa um multiplicador.
- A comparação começa copiando os dois Pokémon e o campo do cenário A para um cenário B independente. No B, também é possível mudar espécies, natures, habilidades, itens, status, Stat Points, estágios, golpe, formato, acertos, clima, terreno e condições de campo. Cada resultado mantém seus rolls e modificadores separados; nenhum set do construtor é alterado.
- No construtor, escolha outro integrante da equipe e abra o Pokémon atual como atacante ou como alvo. Os dois sets e o primeiro golpe preenchido do atacante vão para a calculadora; isso é um ponto de partida editável, não uma recomendação de set.
- A rota direta começa sem espécie nem golpe pré-selecionado. Ao abrir pelo builder sem um segundo integrante, o Pokémon escolhido permanece no lado indicado e a outra escolha fica vazia.
- Um atacante pode ser comparado contra dois a seis alvos. O atacante, o golpe, o campo e o set defensivo são compartilhados; cada alvo recebe um cálculo, rolls, faixa e erro independentes. Nenhum set salvo é alterado.

O motor contempla stats, tipos, formas, muitos efeitos de golpes, habilidades, itens, clima, terreno, telas, crítico, spread e múltiplos acertos. A cobertura varia por mecânica e versão. A matriz em [CALC_VALIDATION.md](CALC_VALIDATION.md) diz o que foi cruzado, o que depende apenas do motor e o que continua sem confirmação.

O fluxo de um atacante contra vários alvos não é um cálculo de time completo: cada alvo usa o mesmo set defensivo compartilhado e sua própria espécie. **Vários integrantes do time contra um alvo** ainda não está implementado; no builder, abra o confronto de um integrante por vez.

## Limites visíveis na tela

A calculadora mostra o total de Stat Points informado, mas não valida limites ou legalidade. O validador comunitário do Pokémon Showdown para o formato Champions fixa 66 SP totais e 32 por atributo; não tratamos isso como uma confirmação publicada oficialmente pelo jogo e não impomos esses limites no formulário. Também não valida compatibilidade de golpes, disponibilidade de formas e itens por regulamento, precisão, frequência de crítico, frequência de hits, nem simula uma partida ou turno completo. A lista de clima e terreno indica apenas opções que o pacote aceita; não afirma que cada combinação exista em toda regra de Doubles do jogo. O modo `Singles` é uma opção de cálculo do pacote, não uma declaração de suporte competitivo atual.

Oito cenários foram comparados, roll a roll, com o simulador Pokémon Showdown no commit fixado na [matriz](CALC_VALIDATION.md); o comando e os pré-requisitos estão no script [`validate:damage-oracle`](../scripts/validate-damage-oracle.mjs). Essa verificação valida concordância com outra implementação comunitária, não com uma partida controlada. Pokémon Champions não publica aqui uma tabela completa das fórmulas de dano; essa lacuna permanece.

## Fontes e atribuição

- Motor: [Pokémon Showdown Damage Calculator](https://github.com/smogon/damage-calc), pacote [`@smogon/calc`](https://www.npmjs.com/package/@smogon/calc), fixado em 0.12.0, licença MIT. A tela atribui o motor junto ao resultado; a licença está em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
- Regra pública oficial consultada: [Mecânica de jogo de Pokémon Champions](https://champions.pokemon.com/pt-br/gameplay/). A página confirma regras sazonais e Mega Evolução no primeiro conjunto de regras de Ranqueadas, mas não documenta a fórmula de stats ou de dano.
- Referência externa de comparação: [calculadora Pokémon Champions da OP.GG](https://op.gg/pokemon-champions/calculator). É uma ferramenta comunitária, não uma fonte oficial. A implementação interna da OP.GG não é declarada na interface; portanto, não assumimos independência do motor.
