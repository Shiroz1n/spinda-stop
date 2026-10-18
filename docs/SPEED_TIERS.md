# Speed Tiers

`/speed-tiers` calcula e compara Speed bruta para espécies e formas do catálogo local. O resultado é uma ordenação calculada, não um ranking de uso, ladder ou tier oficial.

## Modelos

- **Champions · SP:** nível 50; `floor((Speed base + SP + 20) × nature)`, com multiplicador 1,1 / 1 / 0,9. O controle aceita de 0 a 999 SP para explorar a fórmula. Isso não afirma que essa faixa, um total ou uma distribuição sejam legais no jogo.
- **Padrão · EV/IV:** fórmula padrão de stat no nível informado, com nível entre 1 e 100, IV entre 0 e 31 e EV entre 0 e 252. Este modelo geral não representa uma confirmação de regra do Pokémon Champions.

Escolha um alvo e ajuste sua configuração. A tabela compara candidatos com a mesma natureza e o mesmo ajuste individual; empates são explícitos. “Para passar” mostra o menor SP ou EV que resulta em Speed **estritamente maior** que a do alvo, mantendo as demais entradas do candidato. Se não puder ultrapassá-lo dentro da faixa do modelo, a tela informa isso.

O builder compara os seis integrantes em paralelo. Ajustes da prévia são temporários. **Aplicar ao time** grava SP e, se a natureza foi alterada, seleciona uma natureza salva com o mesmo efeito em Speed. A nova natureza também pode afetar outros stats do set.

## Limites

Boosts de estágios, Choice Scarf, habilidades, Tailwind, paralisia, Trick Room e outros efeitos contextuais não entram na comparação. Trick Room muda a ordem de atuação, não o stat bruto. Não leia a tabela como previsão completa da ordem de um turno.

Stats base e identidades de forma vêm do catálogo sincronizado com PokéAPI. As fórmulas são testadas em `apps/web/test/speed-tiers.test.js`; valores de Garchomp nos modelos Champions e padrão são cruzados com `@smogon/calc`. Isso verifica concordância entre cálculos, não legalidade de um set.
