# Próximas etapas

O trabalho está dividido por entregas revisáveis. Nenhum PR deve tratar temporadas como regulamentos oficiais nem misturar percentuais de fontes diferentes.

| Etapa | Entrega | Condição |
|---|---|---|
| 0 — Fundação | Fontes, arquitetura, design, privacidade e validação | Concluída |
| 1 — Dex e builder | Busca, fichas gerais e seis slots locais com import/export | PR #1; mantém disponibilidade e legalidade como desconhecidas |
| 2 — Piloto de Usage | Doubles por espécie usando Battle Data, fonte/período visíveis | PR #2; sem amostra ou regulamento inventados |
| 3 — Cobertura competitiva | Inventário dos campos, limitações e plano de integração | PR #3 |
| 4 — Battle Data | Perfil por Pokémon, facetas sustentadas pelo índice e snapshots por temporada/data | PR #4; fonte única na tela, cache em memória por cinco minutos |
| 5 — MetaRoll | Perfil, ranking de espécies, histórico, ladder e matchups | PR #5; adaptador e proveniência próprios |
| 6 — Tendências no builder | Acesso contextual à ficha competitiva de cada integrante | PR #6; nunca escolhe um set automaticamente |
| 7 — Calculadora | Regras e cálculo de dano validados por casos de referência | PR próprio |
| 8 — Contas e salas | Identidade, inscrição, pareamento e resultados | PR próprio após decisões de hospedagem, privacidade e moderação |

A matriz e a disponibilidade real dos campos ficam em [COMPETITIVE_COVERAGE.md](COMPETITIVE_COVERAGE.md). A calculadora não será derivada de percentuais de Usage. Contas, salas e pareamento não fazem parte da integração de dados competitivos.
