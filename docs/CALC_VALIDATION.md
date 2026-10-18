# Matriz de validação da calculadora

Revisão de `@smogon/calc` 0.12.0 e dos casos visíveis na calculadora externa da OP.GG em 18/10/2026. O pacote calcula conforme seu modo `champions`; a documentação oficial do jogo não confirma todas as mecânicas. “Conferido externamente” significa que a faixa ou stats coincidiram com a OP.GG, não que o cálculo foi medido dentro do jogo. A OP.GG não declara na interface se usa um motor independente.

| Mecânica ou entrada | Suporte no app/motor | Conferência | Estado e limite |
|---|---|---|---|
| Nível | Fixo em 50 | Stats e ranges de Garchomp coincidem com a OP.GG | Conferido por ferramenta externa; sem entrada para outros níveis |
| Stat Points e stats | Fórmula de Champions no pacote; seis campos SP, nature e stats calculados ficam visíveis | Garchomp Jolly com HP 2 / Atk 32 / Spe 32 resulta em 185 / 182 / 115 / 90 / 105 / 169 | Conferido externamente; limite total/legalidade de SP não é validado |
| Nature | Nature do catálogo aplicada à fórmula de stats | Modest e Jolly conferem nos casos Earthquake abaixo | Conferência externa de casos, não da tabela inteira |
| Forma | O catálogo inclui formas base e Mega aceitas pelo motor | Garchomp-Mega Modest resulta em 185 / 199 / 135 / 154 / 115 / 144 e Earthquake com Reflect causa 49–58 | Conferido externamente; disponibilidade atual por regulamento não é conhecida |
| Habilidade | O motor aplica habilidades do catálogo e marca algumas em `rawDesc` | Rough Skin foi preenchida nos casos de referência; o caso Mega usa Sand Force | A seleção e as regras vêm do pacote; cada habilidade não foi testada. Multiplicador numérico pode não ser exposto |
| Item | O motor aplica itens do catálogo e marca alguns em `rawDesc` | Life Orb + Reflect: Earthquake 53–62 no cenário Modest/Jolly descrito nos testes | Caso conferido externamente; restante do catálogo não foi validado |
| Golpes e tabela de tipos | O pacote fornece catálogo, categoria, poder, alvo e eficácia | Earthquake, Shadow Claw e Dragon Claw comparados; imunidade e demais golpes seguem sem caso externo | Catálogo do pacote não comprova compatibilidade legal de set |
| Golpe de área vs. alvo único | `allAdjacent`/`allAdjacentFoes` em Doubles usa o redutor de área do pacote | Earthquake 67–79 em Doubles contra um alvo; Shadow Claw mantém a faixa entre Singles e Doubles | Earthquake conferido externamente; alvo único cobre o comportamento local |
| Reflect / telas | Reflect, Light Screen e Aurora Veil; efeito muda conforme formato e crítico | Earthquake 53–62 com Reflect em Singles e 49–58 com Reflect na forma Mega | Casos de Reflect conferidos externamente; Light Screen, Veil e fator 2732/4096 não foram isolados fora do motor |
| Clima e terreno | Campos de chuva, sol, areia, granizo/neve e quatro terrenos aceitos pelo motor | Sem caso externo isolado | Não afirmar que cada efeito ou combinação seja válido no regulamento atual |
| Crítico | Toggle força ou desliga crítico conforme o motor; habilidade defensiva pode cancelar | Dragon Claw 128–152 normal e 192–228 crítico em caso Modest; Battle Armor cancela no teste local | Faixas coincidem com a referência pública; chance de crítico não é calculada |
| Multi-hit | Quantidade fixa escolhida entre as opções publicadas no catálogo; 16 rolls por acerto | Testes verificam Bullet Seed com 2 acertos e grupos separados | Sem comparação externa para todos os rolls ou para frequência do número de hits |
| Parental Bond | O pacote devolve grupos do golpe principal e do adicional | Teste local confirma separação dos dois grupos e ausência de KO agregado | Não comparado ao jogo nem a uma referência externa; sem distribuição total |
| Proteção | Golpe bloqueado retorna 0; Unseen Fist/Piercing Drill e contato atravessam parcialmente segundo o motor | Teste local distingue ambos os casos | Regra específica do pacote, sem confirmação independente atual |
| 16 rolls | São retornados pelo modo Champions para o golpe de dano | Earthquake 90–106 produz os mesmos 16 valores usados no caso de 2HKO da OP.GG | Cruzamento externo da faixa/percentual; a OP.GG não expõe os 16 rolls na interface |
| OHKO / 2HKO | Contagem uniforme sobre 16 rolls ou 256 pares para um golpe simples | 185 HP contra Earthquake 90–106: 0/16 OHKO e 237/256 (92,6%) 2HKO; OP.GG mostra 92,6% | Probabilidade condicional, só para um hit simples e cenário repetido; não é chance de vencer |
| Modificadores | Mostra tipo, STAB, spread, crítico, telas, Helping Hand, Friend Guard, queimadura e dados contextualizados expostos pelo motor | Testes verificam fatores expostos; Life Orb não informa fator numérico no resumo retornado | Itens/habilidades sem valor em `rawDesc` aparecem pelo nome com aviso de fator não exposto; não estimar |

## Casos reproduzíveis

Os casos abaixo estão automatizados em `apps/web/test/damage-calculator.test.js`.

| ID | Cenário | Resultado local | Referência externa / observação |
|---|---|---:|---|
| D-01 | Absol-Mega-Z Jolly, 31 Atk SP, Justified, Absolite Z usa Shadow Claw contra Absol-Mega-Z Jolly com 3 Def SP, Singles | 99–117 | Coincide com a faixa pública exibida no caso da calculadora Pokémon Showdown Champions |
| D-02 | Garchomp sem SP usa Earthquake contra Garchomp sem SP | Singles 75–88; Doubles 55–66 | Regressão do motor; o alvo do Earthquake é spread |
| D-03 | Garchomp Jolly, HP 2 / Atk 32 / Spe 32, Earthquake contra Garchomp com 2 HP SP | Singles 90–106; 185 HP | OP.GG mostra 92,6% de 2HKO; local calcula 237/256 = 92,578125% |
| D-04 | Mesmo atacante, Earthquake em Doubles contra um alvo | 67–79 e os 16 rolls fixos | Faixa coincidente com a referência externa; percentuais de KO são apenas condicionais |
| D-05 | Garchomp Modest com Life Orb usa Earthquake contra Garchomp Jolly sob Reflect | 53–62 | Faixa coincidente com a OP.GG; o motor local não expõe um fator numérico de Life Orb |
| D-06 | Garchomp-Mega Modest com Garchompite usa Earthquake contra Garchomp Jolly sob Reflect | 49–58 | Faixa coincidente com a OP.GG |
| D-07 | Garchomp Modest usa Dragon Claw em Garchomp Modest, com e sem crítico | 128–152; crítico 192–228 | Faixas coincidentes com a referência pública |
| D-08 | Bullet Seed com 2 acertos e Double-Edge com Parental Bond | Um grupo de 16 por acerto/golpe | Testes do adaptador; sem comparação independente de todos os rolls |
| D-09 | Proteção normal e atravessada por Unseen Fist | Zero vs. dano reduzido | Semântica observada na implementação do pacote e testes locais |
| D-10 | Espécie inválida e SP negativo | Entrada rejeitada | Validação do adaptador |

## Referências consultadas

- [Implementação Champions do motor](https://github.com/smogon/damage-calc/blob/master/calc/src/mechanics/champions.ts) e [fórmulas de stats](https://github.com/smogon/damage-calc/blob/master/calc/src/stats.ts).
- [Calculadora externa da OP.GG](https://op.gg/pokemon-champions/calculator), usada para comparar os casos, sem pressupor independência interna ou endosso oficial.
- [Página oficial de mecânicas](https://champions.pokemon.com/pt-br/gameplay/), consultada para separar informações de regras sazonais das fórmulas que a página não publica.

## Ainda sem validação suficiente

Não há conferência contra partida controlada no próprio jogo. As combinações de habilidade/item/clima/terreno, críticos cancelados, alvos múltiplos, golpes de dano fixo, efeitos residuais, modificadores de forma e todos os golpes não foram validados um a um. Também seguem fora do modelo: precisão e evasion, chance de crítico, distribuição de hits, legalidade do set/regulamento, troca e dano residual por turno, recuperação, itens consumidos e sequência de ações. O resultado deve ser lido como cenário do motor fixado, com limites explícitos, e não como previsão perfeita de batalha.
