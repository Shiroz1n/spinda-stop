# ADR 0003 — MySQL para a API comunitária

- **Estado:** escolhida para implementação; o banco remoto de Preview ainda depende de acesso/aceite do provedor.
- **Decisão:** substituir PostgreSQL/`pg` por MySQL 8.4/InnoDB na API Bun + Elysia. Não manter dois adaptadores de banco.
- **Motivo:** decisão do produto para a base definitiva. A conversão preserva as rotas e os limites de domínio com MySQL nativo, constraints verificáveis e permissões por coluna.
- **Execução:** `mysql2/promise` 3.24.6 conecta tanto no Bun local/CI quanto nas funções Elysia da Vercel; `DATABASE_URL` é somente runtime e `DATABASE_MIGRATION_URL` fica fora da função pública. A versão implantada do Preview ainda não foi testada com MySQL.
- **Schema:** InnoDB, `utf8mb4`/`utf8mb4_bin`, UUID em `CHAR(36) ascii_general_ci` (equivalente à comparação de `uuid` sem distinção de caixa) e hashes em `ascii_bin`, JSON nativo e `DATETIME(3)` UTC. Migrações usam checksum e advisory lock; como DDL MySQL provoca commits implícitos, cada comando é idempotente e a versão só é registrada após todos os comandos terminarem.
- **Segurança:** CI migra um MySQL 8.4 efêmero e executa a aplicação com papel limitado; o script de grants remotos não é executado automaticamente. A concessão remota requer credencial administrativa do provedor e validação real dos grants.
- **Operação:** o banco deve ser separado por ambiente. Esta ADR não autoriza criar uma base paga nem configurar Production. O catálogo de conversão, a comparação de provedores e os bloqueios atuais estão em [MYSQL_MIGRATION.md](../MYSQL_MIGRATION.md).
- **Substitui:** a decisão de PostgreSQL e `pg` em [ADR 0002](0002-api-bun-elysia.md); Bun + Elysia continuam sendo o runtime e o framework.
