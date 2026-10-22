# SQLite local

O backend comunitário roda em Bun + Elysia e persiste em um arquivo SQLite local. A configuração padrão é `.local/spinda-stop.sqlite`, resolvida a partir da raiz do repositório mesmo quando o comando é iniciado em outra pasta. `SPINDA_DB_PATH` pode apontar para outro caminho local. O diretório e o arquivo são privados no Git e no envio ao Vercel.

## Esquema e semântica

As três migrações versionadas criam as 12 tabelas comunitárias:

| Grupo | Tabelas |
|---|---|
| Conta e autenticação | `users`, `sessions`, `oauth_states` |
| Equipes e salas | `teams`, `rooms`, `room_members` |
| Torneios e partidas | `tournaments`, `tournament_members`, `matches`, `match_reports` |
| Moderação | `disputes`, `moderation_events` |

Índices de conta, evento, data e chaveamento mantêm as buscas e unicidades existentes. `matches` e `moderation_events` exigem exatamente um vínculo com sala ou torneio. Chaves estrangeiras mantêm cascatas em equipes, sessões, inscrições e partidas. Checks continuam validando estados, capacidade, IDs distintos, limites de nome/motivo, tokens com hash de 64 caracteres e a integridade do conjunto de campos de código de amizade. JSON de equipe e snapshot compartilhado ficam como `TEXT` com `json_valid`, tipo de array e limite de seis espécies. Os quatro triggers de limpeza preservam o descarte de snapshots ao encerrar um evento ou uma inscrição.

### Inventário de persistência migrado

| Tabela | Dados e integridade preservados | Índices e gatilhos |
|---|---|---|
| `users` | ID textual com formato UUID canônico, provedor limitado, nome de usuário, moderador `0/1`, datas; par provedor/ID externo único. | Índice primário e unicidade composta. |
| `sessions` | Hash de token com 64 caracteres; usuário obrigatório e cascata ao excluir conta; expiração. | `sessions_user_id_idx`. |
| `oauth_states` | Hash de estado com 64 caracteres e expiração de uso único. | Chave primária. |
| `teams` | Dono com cascata, nome de 1–48 caracteres, visibilidade, JSON válido e versão 1. | `teams_owner_updated_idx`; índice parcial `teams_public_updated_idx`. |
| `rooms` | Host obrigatório, nome, estados válidos, capacidade fixa em 2, hash de convite único com 64 caracteres e prazos. | `rooms_host_created_idx`; índice único do convite. |
| `room_members` | Chave composta sala/usuário, ambas com cascata; estados, check-in e quatro campos de código de amizade todos nulos ou todos preenchidos; snapshot JSON limitado a seis entradas. | `room_members_user_idx`; gatilho limpa snapshot ao fim da sala ou saída da pessoa. |
| `tournaments` | Host com cascata, campeão opcional, nome, estados válidos, capacidade fixa em 4, convite único, versão de chaveamento não negativa. | `tournaments_host_created_idx`; índice único do convite. |
| `tournament_members` | Chave composta torneio/usuário com cascatas; estados, seeds 1–4, código de amizade completo ou nulo e snapshot JSON limitado a seis entradas. | `tournament_members_user_idx`; gatilho limpa snapshot ao fim do torneio ou saída da pessoa. |
| `matches` | Participantes distintos; ou vínculo de sala sem torneio/vaga, ou vínculo de torneio com vaga; estados e rodada válidos. Vínculos de evento cascata ao excluir evento. | Unicidade de partida de sala; `matches_tournament_slot_idx` único e parcial por torneio/rodada/vaga. |
| `match_reports` | Uma denúncia por partida, cascata com partida e referências a quem relatou e venceu; nota até 250 caracteres. | `match_id` único. |
| `disputes` | Uma contestação por partida, cascata com partida; autor, moderador opcional, motivo de 1–500 caracteres, estados e resolução de até 500. | `match_id` único. |
| `moderation_events` | Ator obrigatório, alvo opcional e exatamente um evento sala/torneio; motivo de 1–500 caracteres. | FK do evento com cascata; chave primária textual. |
| `schema_migrations` | Nome da migração como versão, SHA-256 do arquivo e horário ISO UTC. Divergência de checksum interrompe a inicialização. | Chave primária por versão. |

As migrações `001_community.sql`, `002_tournaments.sql` e `003_shared_rosters.sql` cobrem as 12 tabelas comunitárias, índices, checks, FKs e quatro gatilhos. SQLite executa cada arquivo dentro de uma transação `BEGIN IMMEDIATE`; alterações de schema não são executadas na inicialização de requisições. Os testes verificam FKs, rollback, checks JSON, unicidade, limpeza por gatilho e integridade.

| Semântica PostgreSQL anterior | Representação SQLite | Tratamento |
|---|---|---|
| UUID com default do banco | `TEXT`; `randomUUID()` na API | A API fornece IDs novos antes do `INSERT`; IDs recuperados continuam a usar `RETURNING`. |
| `timestamptz` | `TEXT` ISO-8601 UTC | Defaults e prazos usam `strftime`; a comparação lexical é segura porque todos os valores usam a forma UTC canônica. |
| `boolean` | `INTEGER` limitado a `0`/`1` | A fronteira HTTP converte a flag de moderação em booleano JavaScript. |
| `jsonb` | `TEXT` validado por SQLite JSON | A camada de dados serializa valores vinculados e reidrata colunas `*_json`. |
| `bytea` | `BLOB` | A cifra AES-GCM e seus bytes continuam sem conversão para texto. |
| `FOR UPDATE` e transações | `BEGIN IMMEDIATE` | A conexão local serializa consultas e transações. Escritores externos ainda usam locks SQLite e `busy_timeout=5000`; o contrato é uma instância local da API, não escrita paralela em várias instâncias. |
| Quatro triggers PostgreSQL | Quatro triggers SQLite `AFTER UPDATE` | Limpeza ocorre na mesma gravação e também é coberta por fluxo de integração. |

As queries usam parâmetros SQLite `?1`, `?2` etc. A aplicação não concatena entrada externa em SQL. Nomes dinâmicos de coluna/ordenação não são aceitos pelo cliente. `RETURNING`, conflitos únicos parciais e `count(...) FILTER` são verificados pela suíte no SQLite que acompanha Bun 1.4.3.

`foreign_keys=ON` é aplicado e lido de volta em cada conexão. Arquivos em disco usam WAL, `busy_timeout=5000` e `synchronous=FULL`: WAL permite leitores durante uma escrita e mantém durabilidade normal; ele não permite múltiplos escritores simultâneos. A camada local mantém uma conexão e uma fila assíncrona para transações atômicas. Para a escala local do projeto isso reduz complexidade de concorrência; não é configuração para múltiplos processos ou NFS. O diretório local é criado com permissão `0700` e o banco com `0600` quando o sistema operacional permite.

O runner lê as migrações em `apps/api/migrations/`, registra nome, SHA-256 e horário aplicado em `schema_migrations`, executa uma migração por `BEGIN IMMEDIATE` e valida `foreign_key_check`. Reexecutar é seguro; alterar o conteúdo de uma migração já aplicada causa falha e exige uma nova versão. DDL não roda durante requisições.

## Do zero

Requer Node.js 22.12 ou mais recente e Bun 1.4.3. Não exige Docker, PostgreSQL nem serviço externo.

```sh
npm ci
cp .env.example .env
npm run api:migrate
npm run api:start
```

Em outro terminal, na raiz do repositório:

```sh
npm run dev
```

O Vite encaminha `/api` para `127.0.0.1:8787`. Confira `http://127.0.0.1:5173/api/health` e `http://127.0.0.1:5173/api/auth/status`. `/api/health` consulta a conexão e verifica que existe ao menos uma migração aplicada. Login interativo requer OAuth App de desenvolvimento com callback `http://127.0.0.1:5173/api/auth/github/callback`; sem OAuth, as ferramentas locais sem conta continuam disponíveis. Para testar códigos de amizade, defina `FRIEND_CODE_ENCRYPTION_KEY` localmente com 32 bytes aleatórios em hexadecimal.

`.env.example` documenta nomes e valores vazios/padrão seguros. Copie para `.env` se precisar ajustar o ambiente; `.env` nunca deve ser commitado. Não copie chaves reais para o arquivo de exemplo.

## Testes, backup e reset

`npm test` executa os testes de API com `bun test`. Cada arquivo de integração cria seu próprio banco temporário, aplica as migrações reais e apaga o diretório ao terminar. Testes unitários web/domínio continuam em Node. A CI não requer servidor PostgreSQL. `npm run api:runtime:smoke` inicia um listener HTTP real Bun + Elysia em porta efêmera.

Faça backup do banco ativo com snapshot consistente; não copie apenas o arquivo `.sqlite` enquanto WAL está ativo:

```sh
npm run api:backup
# ou escolha o destino
npm run api:backup -- .local-backups/meu-backup.sqlite
```

O comando usa `VACUUM INTO`, cria um arquivo independente com permissão restrita e verifica integridade e chaves estrangeiras. Restaure sempre em caminho novo, sem sobrescrever um banco em uso:

```sh
npm run api:restore -- .local-backups/meu-backup.sqlite .local/restaurado.sqlite
```

Pare o servidor Bun antes do reset. O reset só aceita o arquivo padrão `.local/spinda-stop.sqlite`, recusa `SPINDA_DB_PATH` personalizado, contextos Vercel e sidecars WAL ativos, e aplica novamente as migrações:

```sh
npm run api:reset
```

Backups e banco local podem conter IDs de conta, equipes privadas, sessões e dados de evento; mantenha-os fora de diretórios públicos e guarde cópias em local privado. A chave de cifra de código de amizade precisa do próprio backup protegido: sem ela o ciphertext preservado não pode ser aberto.

## Migração de dados existente

No estado remoto inspecionado, o projeto Vercel `spinda-stop` no escopo `alaninhuma-s-projects` não expõe `DATABASE_URL` nem `DATABASE_MIGRATION_URL`; também não há arquivo de banco no repositório. Isso não prova que uma instância PostgreSQL inexista em outra conta ou provedor. Nenhum banco foi apagado, alterado ou consultado, e esta migração não exportou dados reais. Se houver uma instância anterior com dados, preserve-a e faça backup verificável antes de uma exportação PostgreSQL → SQLite; valide contagens, relações, JSON, horários e blobs em uma cópia isolada antes de decidir o destino. Um SQLite recém-criado é vazio, exceto por schema; nenhum seed comunitário é necessário.

## Hospedagem

Vercel Functions têm filesystem efêmero e compartilhamento de arquivos não persistente entre execuções. Por isso os handlers Vercel respondem `503 persistent_storage_required` para `/api/*` antes de abrir qualquer banco. O rewrite do Vercel encaminha caminhos aninhados ao adaptador Elysia antes do fallback SPA, para que `/api/health` não pareça bem-sucedido com HTML `200`. Nenhum `.db` é criado em `/tmp` ou incluído no bundle, e a interface recebe uma mensagem de disponibilidade em vez de uma confirmação falsa de salvamento.

O projeto e suas variáveis Vercel não foram alterados manualmente. A integração GitHub–Vercel cria um Preview automaticamente ao abrir/atualizar a PR; a resposta `503` explícita das rotas comunitárias é o estado esperado enquanto não houver hospedagem persistente. Nenhum deploy manual ou de Production foi feito nesta migração.

Hospedagem futura depende de uma decisão separada:

- **Servidor/VPS com volume persistente:** apontar `SPINDA_DB_PATH` para o volume, limitar a API a uma instância, definir rotina de snapshots/restauração e testar disco, espaço e atualização do SO.
- **Plataforma com disco persistente:** validar retenção do volume em deploys, região, exclusividade do mount, restauração e limite de instâncias antes de habilitar `/api`.
- **SQLite remoto:** exige uma integração de cliente/serviço própria e revisão de transações, locks, latência, backup e limites; não está implementada nem testada aqui.

Não trate essas opções como deployments prontos. A implementação atual é para um processo local persistente; rate limiting continua por processo e a limpeza horária depende desse processo permanecer ativo. Não abra salas, torneios ou contas ao público em um ambiente serverless sem resolver armazenamento persistente, rate limiting distribuído e agendamento de limpeza.

## Organização de assets

A base `main` ainda tinha 88 imagens em `artifacts/reformulation/` porque a limpeza da PR #33 foi fechada sem merge. Esta branch remove esses arquivos do HEAD: 86 JPEGs e 2 PNGs, 12.875.038 bytes no total. A pesquisa não encontrou referências nos imports, CSS, manifests, testes ou caminhos dinâmicos do produto; URL, viewport, ações e observações úteis foram preservados em [Pesquisa visual](VISUAL_REFERENCE_RESEARCH.md). Capturas de review continuam sendo geradas nos workflows e carregadas como artefatos do Actions; `.gitignore` e `.vercelignore` ignoram `artifacts/` inteiro. O histórico Git não foi reescrito, portanto a remoção reduz apenas o HEAD.

| Arquivo/configuração PostgreSQL removido ou substituído | Evidência e motivo | Informação/função substituta |
|---|---|---|
| `compose.yaml` | Subia somente PostgreSQL local; não era usado por frontend, Elysia ou outro serviço. | Execução local sem servidor externo; passos estão em [DEVELOPMENT.md](../DEVELOPMENT.md). |
| `scripts/prepare-runtime-db-role.mjs` e `apps/api/test/db-role-setup.test.js` | Criavam/testavam `GRANT` e papéis PostgreSQL, conceitos que `bun:sqlite` não oferece. | Limite documentado como acesso do SO ao arquivo; testes verificam modo `0600`, recusam contexto Vercel e cobrem FKs/checks/transações. Não se afirma equivalência de privilégio por tabela. |
| Dependência `pg`, URLs `DATABASE_URL`/`DATABASE_MIGRATION_URL` e `POSTGRES_PASSWORD` | Não há conexão PostgreSQL no backend após a conversão; nenhum script ativo consulta esses nomes. | `bun:sqlite` nativo, `SPINDA_DB_PATH` e runner SQLite explícito. Nenhuma URL de banco é incluída no bundle. |
| `artifacts/reformulation/README.md` e `references/lived-sites/README.md` | Índice e manifesto estavam dentro de uma pasta binária excluída; 88 imagens não eram assets do app. | Metadados do índice e dos grupos foram consolidados em [Pesquisa visual](VISUAL_REFERENCE_RESEARCH.md), com ações, estados e limites. |

## Referências técnicas

- [Bun SQLite](https://bun.sh/docs/runtime/sqlite): API síncrona e transação callback síncrona; a implementação usa transações manuais para manter o callback assíncrono das rotas dentro do lock.
- [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html): são habilitadas e verificadas por conexão.
- [SQLite WAL](https://www.sqlite.org/wal.html): `-wal`/`-shm` são parte do estado ativo; o backup não copia apenas o arquivo principal.
- [SQLite PRAGMAs](https://www.sqlite.org/pragma.html): integridade e constraints são verificadas no runner/testes.
- [Vercel SQLite](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel): filesystem de função não oferece persistência para banco local.
