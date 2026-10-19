# Speed Tiers

`/speed-tiers` calcula e compara Speed bruta para espécies e formas do catálogo local. O resultado é uma ordenação calculada, não um ranking de uso, ladder ou tier oficial.

## Modelos

- **Champions · SP:** nível 50; `floor((Speed base + SP + 20) × nature)`, com multiplicador 1,1 / 1 / 0,9. A comparação permite até 32 SP no atributo; o builder também confere o limite total de 66 SP antes de aplicar a prévia. Esses limites seguem o formato comunitário usado pelo projeto e não são uma confirmação oficial do jogo.
- **Padrão · EV/IV:** fórmula padrão de stat no nível informado, com nível entre 1 e 100, IV entre 0 e 31 e EV entre 0 e 252. Este modelo geral não representa uma confirmação de regra do Pokémon Champions.

Escolha um alvo e ajuste sua configuração. A tabela compara candidatos com a mesma natureza e o mesmo ajuste individual; empates são explícitos. “Para passar” mostra o menor SP ou EV que resulta em Speed **estritamente maior** que a do alvo, mantendo as demais entradas do candidato. No modo Champions, o cálculo nunca recomenda mais de 32 SP. Quando o candidato não passa com a natureza selecionada, a tela mostra à parte se uma natureza favorável mudaria o resultado.

O builder compara os seis integrantes em paralelo. Ajustes da prévia são temporários. **Aplicar ao set** grava SP e, se a natureza foi alterada, seleciona uma natureza salva com o mesmo efeito em Speed. A ação só fica disponível para uma distribuição de até 32 SP por atributo e 66 SP no total. A nova natureza também pode afetar outros stats do set.

## Limites

Boosts de estágios, Choice Scarf, habilidades, Tailwind, paralisia, Trick Room e outros efeitos contextuais não entram na comparação. Trick Room muda a ordem de atuação, não o stat bruto. Não leia a tabela como previsão completa da ordem de um turno.

Stats base e identidades de forma vêm do catálogo sincronizado com PokéAPI. As fórmulas são testadas em `apps/web/test/speed-tiers.test.js`; valores de Garchomp nos modelos Champions e padrão são cruzados com `@smogon/calc`. Isso verifica concordância entre cálculos, não legalidade de um set.
