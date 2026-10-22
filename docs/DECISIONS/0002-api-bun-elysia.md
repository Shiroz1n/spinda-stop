# ADR 0002 — Runtime da API comunitária

- **Estado:** aceita para a API comunitária; produção ainda não habilitada.
- **Decisão:** executar `apps/api` em Bun 1.4.3 e usar Elysia 1.4.x para receber e rotear pedidos HTTP. Manter PostgreSQL e o pacote `pg`.
- **Motivo:** disponibilizar um runtime e um servidor próprios para a API sem alterar o contrato de salas, torneios, contas, banco ou respostas durante esta migração.
- **Compatibilidade:** as rotas existentes entram pelo Fetch do Elysia e preservam o despacho atual por um adaptador pequeno de `Request`/`Response`. Testes cobrem status, cookies, proteção de origem e limite de corpo; um smoke test inicia o listener real em Bun.
- **Vercel:** `api/` exporta a mesma aplicação como funções Bun para `/api` e subcaminhos. `vercel.json` seleciona `bunVersion: "1.x"`, a única família atualmente aceita pela Vercel; o patch do runtime é gerenciado pela plataforma. CI executa o smoke test local em Bun 1.4.3. `APP_ORIGIN` pode ser definido por ambiente; sem ele, Preview usa `VERCEL_BRANCH_URL` (fallback `VERCEL_URL`) e produção usa `VERCEL_PROJECT_PRODUCTION_URL` (fallback `VERCEL_URL`). A conexão de banco e OAuth ainda exige configuração separada.
- **Limites operacionais (atualização 2026-10):** o rate limit agora usa contadores compartilhados no PostgreSQL, e `/api/cron/cleanup` fornece limpeza autenticada diária para Vercel. O cron só executa em Production, nunca em Preview; em Hobby, roda uma vez por dia com precisão horária e sem retry automático. Exportação/exclusão de conta, retenção e resposta a incidentes continuam pendentes antes do acesso público.
- **Revisão:** decompor o despachante por grupos de rotas em Elysia pode ocorrer em mudanças menores, preservando os contratos existentes.
