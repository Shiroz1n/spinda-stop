# Calculadora de dano

A tela `/calculator` usa `@smogon/calc` 0.12.0 no navegador. Os sets ficam no dispositivo e não são enviados a uma API. O motor tem um modo de mecânicas de Pokémon Champions, mas isso não confirma sozinho que cada regra atual do jogo esteja correta.

## O que o cálculo representa

- Nível 50. Stat Points são passados como pontos de atributo do modo Champions: HP é `base + SP + 75` (ou 1 para base 1); os outros stats são `floor((base + SP + 20) × nature)`, com modificador 1,1 / 1 / 0,9.
- Espécies, formas, golpes, habilidades, itens e natures vêm do catálogo fixado dentro da dependência. Isso não valida se a combinação é permitida no jogo ou no regulamento atual.
- O motor calcula 16 rolls para um golpe de dano. A página mostra todos os 16 para um golpe de um acerto. Em multi-hit, mostra 16 por acerto dentro de “Ver resultados”; não combina as distribuições nem estima a frequência de cada quantidade de acertos.
- Em Doubles, golpes cujo alvo é `allAdjacent` ou `allAdjacentFoes` recebem o redutor de área do motor; a faixa mostrada é contra um alvo. Golpes de alvo único não recebem esse redutor.
- OHKO e 2HKO são contagens condicionais dos rolls: exigem acerto, mantêm o crítico selecionado e repetem o mesmo cenário. Não incluem precisão, chance de crítico, mudança de clima/tela, recuperação, itens consumidos ou outros eventos entre turnos. Multi-hit e golpes de Parental Bond não exibem essas probabilidades.
- O painel lista os fatores e efeitos que o resultado do motor expõe. Para alguns itens e habilidades, o motor só informa que o efeito foi aplicado, sem fator numérico; a tela mostra o nome e não inventa um multiplicador.

O motor contempla stats, tipos, formas, muitos efeitos de golpes, habilidades, itens, clima, terreno, telas, crítico, spread e múltiplos acertos. A cobertura varia por mecânica e versão. A matriz em [CALC_VALIDATION.md](CALC_VALIDATION.md) diz o que foi cruzado, o que depende apenas do motor e o que continua sem confirmação.

## Limites visíveis na tela

A calculadora não valida o total ou a legalidade dos Stat Points, a compatibilidade de golpes, disponibilidade de formas e itens por regulamento, precisão, frequência de crítico, frequência de hits, nem simula uma partida ou turno completo. A lista de clima e terreno indica apenas opções que o pacote aceita; não afirma que cada combinação exista em toda regra de Doubles do jogo. O modo `Singles` é uma opção de cálculo do pacote, não uma declaração de suporte competitivo atual.

Resultados iguais aos de outra calculadora são uma conferência externa do caso escolhido, não uma validação oficial nem prova de que as duas ferramentas usam motores independentes. Pokémon Champions não publica aqui uma tabela completa das fórmulas de dano; essa lacuna permanece.

## Fontes e atribuição

- Motor: [Pokémon Showdown Damage Calculator](https://github.com/smogon/damage-calc), pacote [`@smogon/calc`](https://www.npmjs.com/package/@smogon/calc), fixado em 0.12.0, licença MIT. A tela atribui o motor junto ao resultado; a licença está em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
- Regra pública oficial consultada: [Mecânica de jogo de Pokémon Champions](https://champions.pokemon.com/pt-br/gameplay/). A página confirma regras sazonais e Mega Evolução no primeiro conjunto de regras de Ranqueadas, mas não documenta a fórmula de stats ou de dano.
- Referência externa de comparação: [calculadora Pokémon Champions da OP.GG](https://op.gg/pokemon-champions/calculator). É uma ferramenta comunitária, não uma fonte oficial. A implementação interna da OP.GG não é declarada na interface; portanto, não assumimos independência do motor.
