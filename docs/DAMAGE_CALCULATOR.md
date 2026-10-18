# Calculadora de dano

A tela `/calculator` usa `@smogon/calc` 0.12.0, o mesmo pacote que alimenta a calculadora do Pokémon Showdown. O cálculo roda no navegador e não envia os sets para uma API.

## Regras usadas

- O motor selecionado é o conjunto de mecânicas de Pokémon Champions do pacote. O nível é fixo em 50.
- Stat Points são passados ao motor sem conversão para EVs. A implementação calcula HP como `base + SP + 75` (mantendo HP 1 quando o HP base é 1); os outros atributos usam `floor((base + SP + 20) × nature)`, com modificador 1,1 / 1 / 0,9.
- A faixa vem dos 16 resultados de dano do motor. Golpes spread em Doubles aplicam o redutor de dano do pacote e a faixa representa um alvo.
- A tela aceita espécie, golpe, nature, habilidade, item, status, Stat Points, estágios, crítico, clima, terreno e condições de campo implementadas. O número de acertos de golpes multi-hit só pode ser um dos valores publicados nos dados do motor.
- A tela não valida regulamento, distribuição legal de Stat Points, compatibilidade de golpes, precisão, probabilidade de crítico ou a chance de cada número de acertos.

Essas fórmulas e mecânicas descrevem o motor fixado no projeto; não são uma afirmação independente de que toda regra atual do jogo foi reproduzida. A ficha calculada não é uma simulação de turno completo.

## Casos de referência

| Caso | Configuração | Resultado | Conferência |
|---|---|---:|---|
| Shadow Claw | Absol-Mega-Z Jolly, 31 Atk SP, Justified e Absolite Z contra Absol-Mega-Z Jolly com 3 Def SP, em Singles | 99–117 | Igual à faixa exibida no caso público da [calculadora do Pokémon Showdown](https://calc.pokemonshowdown.com/champions.html) em 18/10/2026; repetido no teste `damage-calculator.test.js`. |
| Earthquake | Garchomp Serious sem SP contra Garchomp Serious sem SP | Singles: 75–88; Doubles: 55–66 | Regressão do motor; confirma a diferença para golpe spread ao alternar o formato. |
| Double Kick | Garchomp sem SP contra Garchomp sem SP, 2 acertos | Faixa somada de dois acertos | Teste confirma que a faixa tem dois resultados por acerto e que o golpe usa o número fixo fornecido pelo motor. |

Os casos são reproduzíveis com `npm test`. Só Shadow Claw foi comparado com um resultado visível do site oficial; os demais casos conferem o comportamento local do motor e não substituem testes contra o jogo.

## Atribuição

Motor: [Pokémon Showdown Damage Calculator](https://github.com/smogon/damage-calc), pacote [`@smogon/calc`](https://www.npmjs.com/package/@smogon/calc), versão 0.12.0, licença MIT. A interface identifica o motor junto ao resultado. O texto da licença está em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
