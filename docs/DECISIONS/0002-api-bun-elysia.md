# ADR 0002 — Runtime da API comunitária

> **Histórico:** a escolha de PostgreSQL desta decisão foi substituída pelo [ADR 0003 — SQLite local](0003-sqlite-local.md). Bun + Elysia seguem como runtime e framework.

- **Estado:** aceita para a API comunitária; produção ainda não habilitada.
- **Decisão:** executar `apps/api` em Bun 1.4.3 e usar Elysia 1.4.x para receber e rotear pedidos HTTP. Manter PostgreSQL e o pacote `pg` na fase registrada aqui.
- **Motivo:** disponibilizar um runtime e um servidor próprios para a API sem alterar o contrato de salas, torneios, contas, banco ou respostas durante esta migração.
- **Compatibilidade:** as rotas existentes entram pelo Fetch do Elysia e preservam o despacho atual por um adaptador pequeno de `Request`/`Response`. Testes cobrem status, cookies, proteção de origem e limite de corpo; um smoke test inicia o listener real em Bun.
- **Vercel:** `api/` exporta a mesma aplicação como funções Bun para `/api` e subcaminhos. `vercel.json` seleciona `bunVersion: "1.x"`, a única família atualmente aceita pela Vercel; o patch do runtime é gerenciado pela plataforma. CI executa o smoke test local em Bun 1.4.3. `APP_ORIGIN` pode ser definido por ambiente; sem ele, Preview usa `VERCEL_BRANCH_URL` (fallback `VERCEL_URL`) e produção usa `VERCEL_PROJECT_PRODUCTION_URL` (fallback `VERCEL_URL`). A conexão de banco e OAuth ainda exige configuração separada.
- **Limites operacionais:** Elysia e Bun não mudam o estado atual do rate limit em memória, a ausência de exclusão/exportação de conta ou os requisitos de retenção e resposta a incidentes. Timers locais não são uma rotina confiável em funções serverless; a API não deve ser habilitada publicamente em produção até existir limpeza agendada e controles distribuídos.
- **Revisão:** decompor o despachante por grupos de rotas em Elysia pode ocorrer em mudanças menores, preservando os contratos existentes.
