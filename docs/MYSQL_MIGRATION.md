# Migração da API para MySQL

Estado verificado em 22 out. 2026 na PR #33. O código local desta branch converte o backend Bun + Elysia de `pg`/PostgreSQL para `mysql2/promise`/MySQL. A integração remota ainda não foi provisionada: o projeto Vercel não tem integração de banco nem `DATABASE_URL`; por isso não há URL/SHA de Preview MySQL nem chamadas reais da API hospedada para relatar. O deployment READY observado representa o HEAD anterior e ainda serve o `/api` sem banco.

## Inventário e matriz PostgreSQL → MySQL

| Tabela | Registros/relacionamentos | Conversão e invariantes preservados |
|---|---|---|
| `users` | Conta GitHub/teste, handle, moderação | UUID gerado pela aplicação; `VARCHAR`, `BOOLEAN`, `DATETIME(3)` UTC; unicidade `(provider, provider_subject)` e checks de provedor/handle/moderação. Runtime não pode alterar `is_moderator`. |
| `sessions` | Sessões por hash e expiração | Token SHA-256 em `CHAR(64)`, FK para `users` com cascade, índice de usuário e expiração; timestamps UTC. |
| `oauth_states` | Estado OAuth de uso único | Hash único com validade e índice de limpeza; `DELETE ... WHERE` parametrizado antes do callback. |
| `teams` | Equipes privadas/públicas do dono | JSONB → JSON nativo; FK com cascade, checks de visibilidade/nome/schema; índices por dono e por visibilidade/data substituem o índice parcial de equipes públicas. |
| `rooms` | Sala, host, convite e estado | UUID, convite hash único, status/capacidade/name checks e FK do host; sem cascade no host, como antes. |
| `room_members` | Participantes, check-in, código cifrado, snapshot | BYTEA → `VARBINARY`; JSONB → JSON com check de array/tamanho; checks de pares de ciphertext e estados; chaves/FKs e cascades preservadas. |
| `tournaments` | Host, chave e campeão | Checks de estado/capacidade/versão; FKs de host/campeão; índices por host/data. |
| `tournament_members` | Participantes e seeds | Checks de estado/seed, código/snapshot equivalente a sala, chave composta e cascades. |
| `matches` | Rodadas, slots e adversários | Checks de rodada, slot, jogador distinto e referência a exatamente uma sala/torneio; FKs e unicidade de partida/sala e slot de chave mantidas. |
| `match_reports` | Relato único por partida | FKs, um relato por partida, nota com limite e cascata da partida. |
| `disputes` | Contestação única por partida | Estado/justificativa validados e FKs; cascata com partida. |
| `moderation_events` | Trilha append-only | FKs do ator/alvo/evento, check de uma única referência sala/torneio; runtime só recebe INSERT. |
| `api_rate_limits` | Janelas compartilhadas entre instâncias | Upsert atômico `ON CONFLICT` → `ON DUPLICATE KEY UPDATE`; hash binário, contador positivo e expiração indexada. |
| `schema_migrations` | Versões/checksums aplicados | Tabela MySQL com SHA-256; bloqueio nomeado via `GET_LOCK`; divergência de checksum interrompe a migração. |

Consultas usam placeholders `?` do prepared statement do driver. `RETURNING` foi substituído por UUID criado no servidor e leitura subsequente limitada por ID e proprietário. `ON CONFLICT` passou a `ON DUPLICATE KEY UPDATE`. `UUID` tornou-se `CHAR(36) ascii_general_ci` para preservar comparações case-insensitive equivalentes ao tipo PostgreSQL; `JSONB` tornou-se `JSON`; `BYTEA` tornou-se `VARBINARY`; `BOOLEAN` é `BOOLEAN`; timestamps viraram `DATETIME(3)` sem timezone com a sessão e escrita explicitamente em UTC. `utf8mb4_bin` mantém os demais textos case-sensitive; tokens usam `ascii_bin`. Os efeitos que antes dependiam de triggers passaram para statements explícitos dentro das transações da aplicação.

As tabelas usam InnoDB. A migração divide DDL idempotente em statements, calcula checksum e registra a versão apenas ao final, pois MySQL pode confirmar DDL implicitamente. A execução não promete rollback integral do schema. O pipeline executa a migração duas vezes para verificar reexecução. MySQL 8.4 é o alvo; constraints `CHECK` precisam ser efetivamente aplicadas pelo provedor. UUIDs usam `ascii_general_ci` para preservar a comparação sem distinção de caixa do tipo PostgreSQL `uuid`; hashes e tokens continuam `ascii_bin`.

## Uso do banco e estado da operação

- A aplicação usa `DATABASE_URL` com usuário de runtime; migrações usam `DATABASE_MIGRATION_URL`, exclusivamente fora das funções públicas. O helper `mysql2/promise` exige TLS validado para hosts remotos, limita cada instância Vercel a duas conexões e inicializa a sessão em UTC.
- `scripts/prepare-runtime-mysql-role.mjs` é restrito a MySQL local/efêmero e concede permissões de dados por tabela/coluna, sem DDL, privilégios globais, acesso a `schema_migrations` ou capacidade de alterar `users.is_moderator`. Ele não é uma rotina de provisionamento remoto.
- CI e Visual Review usam MySQL 8.4 efêmero; a aplicação integra via usuário limitado e fixtures/migrações via usuário administrativo. Nenhuma base de produção é usada.
- No projeto Vercel `spinda-stop` (escopo `alaninhuma-s-projects`), a consulta da configuração retornou zero integrações/connector de banco e nenhum `DATABASE_URL`. A PR #33 tinha deployment Preview READY no SHA `1ace1a795dfbea969d5c4f880fa286b4aaf4fe90`; esse código ainda espera PostgreSQL e não pode servir de evidência da conversão. Os ambientes consultáveis não mostram uma URL de banco anterior, mas isso não prova que não existam dados em outra conta/provedor; não foi possível consultar contas externas.
- A configuração do projeto não fornece credenciais para criar recursos em TiDB, Railway, AWS ou outro provedor, e não há ferramenta conectada para provisioná-los. Nenhum aceite legal, compartilhamento de dados, cobrança ou deploy foi iniciado.

## Comparação de provedores MySQL

| Opção | Compatibilidade/limites relevantes | Custo e recuperação | Resultado nesta revisão |
|---|---|---|---|
| TiDB Cloud Starter, MySQL-compatible | Protocolo MySQL e FKs, mas engine TiDB multi-tenant; versão Starter observada em documentação é baseada no TiDB 8.5.3, que não oferece grants por coluna. O limite de quota pode negar conexões. | Sem custo até a quota mensal elegível (5 GiB row storage, 5 GiB columnar e 50M RU); continua apenas com billing/spending limit. Retenção de backup do Starter é curta e sem PITR. | Bom para teste efêmero gratuito, mas não atende o mesmo nível de grants colunares; não escolhido como base definitiva sem teste real de locks, checks e retenção. Criar exige conta/aceites de terceiro, e a integração Vercel não está instalada. |
| Railway MySQL | Template roda imagem MySQL em nó único; tráfego externo usa TCP Proxy. A documentação consultada não garante TLS/MySQL server certificate nesse caminho; esta aplicação exige TLS validado fora de localhost. Egress pelo proxy é cobrado. | Hobby custa US$ 5/mês com US$ 5 de crédito de uso; excesso é cobrado. Backups de volume podem reter diário 6 dias, semanal 27 e mensal 89; PITR exige configuração adicional. | Tecnicamente próximo do MySQL nativo, mas TLS e conexão Vercel precisam ser comprovados antes de usar; não contratado. |
| AWS RDS for MySQL 8.4 | MySQL gerenciado, TLS e contas/grants nativos. Região e caminho de saída de funções Vercel (IP/rede) precisam ser configurados; não há integração MySQL existente no projeto. | On-Demand, sem mínimo de instância, mas cobra horas, storage e backup conforme região/tamanho; o valor concreto depende de retenção, classe, IOPS e tráfego e precisa ser confirmado no AWS Pricing Calculator antes da criação. | Opção tecnicamente mais previsível para schema/grants e operação, mas paga e requer acesso/decisão de custo e conectividade; não criado. |

Não escolhi o banco por uma mera etiqueta de Marketplace. Para fechar o Preview, é necessária uma decisão concreta: (A) autorizar uma conta/provisionamento AWS RDS e aprovar o orçamento mostrado pelo calculator; ou (B) autorizar Railway Hobby (mínimo US$ 5/mês mais eventual excesso) após validar TLS; ou (C) aceitar TiDB Starter como MySQL-compatible de Preview, com as limitações de engine, grants, quota e backup acima. Criar uma integração de terceiro pode pedir login/aceite e compartilhar metadados do projeto; isso depende de autorização explícita na tela do provedor. Enquanto isso, não se deve expor a API comunitária.

## Referências técnicas consideradas

- [Bun SQL](https://bun.sh/docs/runtime/sql): avaliado; adotado `mysql2/promise` para usar a implementação existente de pool/queries parametrizadas e testar o mesmo driver na Vercel. O CI executará migração e permissões sob Bun 1.4.3.
- [Elysia validation](https://elysiajs.com/essential/validation) e [Elysia na Vercel](https://vercel.com/docs/frameworks/backend/elysia): as rotas mantêm adaptador Fetch/Response e validação de domínio já existente; confirmar na CI que os handlers continuam compatíveis. A hospedagem MySQL ainda não foi exercitada.
- [MySQL 8.4 — foreign keys](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html), [implicit commit](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html) e [GRANT](https://dev.mysql.com/doc/refman/8.4/en/grant.html): InnoDB, DDL idempotente/versionado e privilégios separados.
- [TiDB Starter plans](https://docs.pingcap.com/tidbcloud/select-cluster-tier/), [TiDB privilege management](https://docs.pingcap.com/tidb/stable/column-privilege-management/), [Railway MySQL](https://docs.railway.com/databases/mysql), [Railway pricing](https://docs.railway.com/pricing/plans), [Railway backups](https://docs.railway.com/volumes/backups), [AWS RDS MySQL pricing](https://aws.amazon.com/rds/mysql/pricing/): limites, custo e recuperação comparados acima.

## Verificação e pendências

As verificações automatizadas estão descritas no histórico de CI da PR e precisam rodar no SHA desta conversão: `npm ci`, `npm run api:migrate` duas vezes, `npm run api:db:prepare`, Bun HTTP smoke, `npm run lint`, `npm test` e `npm run build`. Os testes de integração exigem MySQL real; rodá-los sem `DATABASE_URL` é um teste parcial. O servidor MySQL local não pôde iniciar neste ambiente porque o sandbox bloqueou a criação do socket Unix, então não reivindicamos testes locais de migração/integração.

Ainda faltam: escolher e provisionar provedor/região/ambiente Preview; aplicar schema com credencial migratória; criar e verificar grants remotos; configurar somente `DATABASE_URL` de Preview; implantar e testar rotas/fluxos reais; confirmar OAuth de Preview; validar rate limit e limpeza sob o provedor; e revisar backups/restore. Não há plano de conversão PostgreSQL → MySQL executado, pois nenhuma base ou dados foram encontrados acessíveis; antes de qualquer corte deve-se confirmar outras contas e fazer exportação/verificação se houver registros.
