# Próximas etapas

| Fase | Entrega | Condição para avançar |
|---|---|---|
| 0 — Fundação | Fontes, termos, arquitetura, design e critérios de validação. **Concluída.** | Fontes e limites documentados. |
| 1 — Dex e construtor | Catálogo geral, busca e filtros; seis slots; rascunho local e import/export. **Pronta para revisão nesta branch.** | Cobertura do dataset conferida; legalidade claramente não verificada. |
| 2 — Análise | Tipos, regras versionadas e mensagens que explicam cada alerta. | Fixtures e regulamento confirmado. |
| 3 — Usage | Piloto de Doubles com Pokémon Champions Battle Data, busca, filtros, atribuição e período devolvido pela API. | Este PR mantém a fonte isolada. Denominador e vínculo entre temporada e regulamento seguem desconhecidos; MetaRoll permanece alternativa separada. Histórico e comparação entre fontes precisam de revisão própria. |
| 4 — Matchups e calculadora | Dano comparável, 16 rolls, condições e matriz de conformidade. | Casos de referência conferidos e release fixado. |
| 5 — Comunidade | Contas, salas, inscrição, check-in, pareamento e resultados. | Provedor de auth, hospedagem, privacidade e moderação definidos. |

Ladder, Players e Rentals só entram quando existir uma fonte documentada para cada dado. Singles fica separado de Doubles e não herda suas regras.
