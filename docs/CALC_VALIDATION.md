# Validação da calculadora

O projeto fixa `@smogon/calc` em 0.12.0 e verifica regras do adaptador, faixa de referência e dano spread. Os limites do motor estão em [DAMAGE_CALCULATOR.md](DAMAGE_CALCULATOR.md).

| ID | Caso conferido | Evidência |
|---|---|---|
| D-01 | Shadow Claw, Absol-Mega-Z contra Absol-Mega-Z | 99–117, igual ao resultado visível no Pokémon Showdown em 18/10/2026; teste automatizado. |
| D-02 | Earthquake em Singles e Doubles | 75–88 e 55–66, respectivamente; teste automatizado para validar o modificador spread. |
| D-03 | Double Kick com 2 acertos | O motor informa dois acertos; resultado preserva uma faixa por acerto. |
| D-04 | Espécie inválida e Stat Points negativos | A entrada é rejeitada sem produzir resultado. |
| D-05 | Protect | É classificado como movimento sem dano direto. |

Os cenários D-02 a D-05 testam o motor e o tratamento da interface; ainda não são medições independentes dentro do jogo. Não há teste de chance de KO, precisão ou simulação de turno completo.
