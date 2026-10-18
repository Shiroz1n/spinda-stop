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
| 8 — Calculadora | Tela de dano, campos de combate, regras do motor e casos de referência reproduzíveis | PR #8; resultados e limites documentados, não valida legalidade do set |
| 9 — Contratos das fontes | `all.json` conferido em resposta real; significados de `ratingHistory`, `megas` e `ladder-cutoffs` registrados como lacunas | Não exibir os campos sem contrato e período definidos pela fonte |
| 10 — Contas e salas | Modelo, privacidade, permissões e sala privada pequena | PR #14 define o contrato; PR seguinte implementa o fluxo com PostgreSQL e autenticação |
| 11 — Torneios | Check-in, chaveamento, registro e contestação | PR próprio depois da sala; partidas continuam acontecendo no jogo |

A matriz e a disponibilidade real dos campos ficam em [COMPETITIVE_COVERAGE.md](COMPETITIVE_COVERAGE.md). A calculadora não deriva dano de percentuais de Usage. O modelo comunitário está em [COMMUNITY_MODEL.md](COMMUNITY_MODEL.md); salas e torneios não fazem parte da integração de dados competitivos.
