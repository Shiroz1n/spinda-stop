# ADR 0001 — Stack e dados locais

- **Estado:** aceita para a fase 1.
- **Decisão:** React + Vite + JavaScript + Tailwind; npm workspaces. Funções de domínio em pacote puro.
- **Dados gerais:** CSVs da PokéAPI em revisão fixa, importados para JSON local no primeiro `dev` ou `build`; artefato gerado não entra no Git.
- **Sem backend nesta fase:** equipe salva no navegador; não há contas ou torneios ainda.
- **Motivo:** entregar Dex e editor com build repetível, sem escolher infraestrutura antes de precisar dela.
- **Revisão:** reavaliar cache, direitos de dados e rotina de atualização antes de publicar uma versão hospedada.
