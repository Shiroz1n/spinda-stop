# Próximas etapas

O trabalho está dividido por entregas revisáveis. Nenhum PR deve tratar temporadas como regulamentos oficiais nem misturar percentuais de fontes diferentes.

| Etapa | Entrega | Condição |
|---|---|---|
| 0 — Fundação | Fontes, arquitetura, design, privacidade e validação | Concluída |
| 1 — Dex e builder | Busca, fichas gerais e seis slots locais com import/export | PR #1; mantém disponibilidade e legalidade como desconhecidas |
| 2 — Piloto de Usage | Doubles por espécie usando Battle Data, fonte/período visíveis | PR #2; sem amostra ou regulamento inventados |
| 3 — Cobertura competitiva | Inventário dos campos, limitações e plano de integração | PR #3 |
| 4 — Battle Data | Perfil por Pokémon, facetas sustentadas pelo índice e snapshots por temporada/data | PR #4; fonte única na tela, cache em memória por cinco minutos |
| 5 — MetaRoll: fichas e histórico | Perfil, ranking de espécies, histórico e temporadas arquivadas | PR #5; adaptador e proveniência próprios |
| 6 — MetaRoll: matchups e ladder | Matchups publicados e ladder de até 1000 jogadores | PR #6; não usar números do ladder como amostra de Pokémon |
| 7 — Tendências no builder | Link por integrante para a ficha contextual de Usage, com troca de fonte | PR #7; navegação não altera o set |
| 8 — Calculadora | Regras cobertas, cálculo de dano e casos de referência reproduzíveis | PR próprio; declarar os limites do motor usado |
| 9 — Contratos das fontes | Esclarecer campos MetaRoll observados sem semântica e validar `all.json` | Integrar só após documentação ou confirmação da fonte |
| 10 — Contas e salas | Identidade, inscrição, pareamento e resultados | PR próprio após decisões de hospedagem, privacidade e moderação |

A matriz e a disponibilidade real dos campos ficam em [COMPETITIVE_COVERAGE.md](COMPETITIVE_COVERAGE.md). A calculadora não será derivada de percentuais de Usage. Contas, salas e pareamento não fazem parte da integração de dados competitivos.
