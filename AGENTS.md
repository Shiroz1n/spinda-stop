# Instruções de desenvolvimento

- Antes de editar, leia o pedido, `DEVELOPMENT.md` e os documentos da área afetada.
- Em tarefas de interface, leia `docs/UI_HUMANIZER.md` e `docs/SPINDA_STOP_DESIGN_SYSTEM.md` antes de alterar componentes ou estilos. Use o primeiro para questionar padrões genéricos e o segundo como direção do produto; registre decisões e capturas, sem alegar que a leitura de um Markdown equivale a executar uma skill externa.
- Trabalhe em branch curta; não desenvolva diretamente em `main`.
- Mantenha regras, proveniência e disponibilidade fora dos componentes visuais.
- Nunca marque um Pokémon como permitido ou disponível sem fonte, formato e regulamento.
- Trate `unknown` como diferente de `unavailable`; não invente dados, estatísticas ou compatibilidade de golpes.
- Não use endpoints privados do jogo nem faça scraping agressivo de sites da comunidade.
- Não adicione artes, sprites ou dados competitivos sem registrar origem, condições de uso e atribuição.
- Prefira funções puras, dependências pequenas e interfaces nativas acessíveis.
- Execute lint, testes e build pertinentes; registre resultados reais no pull request.
- Use Conventional Commits em inglês. Não faça merge nem deploy sem autorização.
