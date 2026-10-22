# Segurança e privacidade

## Aplicativo local

O construtor mantém um rascunho local por padrão. Arquivos importados são tratados como JSON limitado a 128 KB, versionado e validado; o conteúdo nunca é executado. Analytics não está habilitado.

O importador baixa CSVs de uma revisão fixa da PokéAPI e produz dados locais ignorados pelo Git. Nenhum segredo é necessário. Um erro de download precisa informar a fonte e permitir nova tentativa.

## Contas e salas

Os fluxos comunitários de conta, sala e torneio estão em `apps/api` e usam PostgreSQL, OAuth do GitHub, sessões por cookie e autorização por recurso. Escopo e limites ficam em [COMMUNITY_MODEL.md](COMMUNITY_MODEL.md).

- Sessões usam token aleatório; PostgreSQL guarda apenas o hash. Cookies são `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Mudanças exigem `Origin` igual a `APP_ORIGIN`. A API não habilita CORS.
- Convites são tokens aleatórios guardados como hash e enviados no fragmento da URL. O estado do OAuth também é aleatório, de uso único e guardado como hash.
- Código de amizade nunca vai para URL ou log. O valor é cifrado em AES-256-GCM e só pode ser aberto por membro do evento; apaga ao encerrar ou ao expirar.
- Equipes são privadas por padrão. A cópia pública depende de escolha explícita. Nenhuma equipe é validada como legal no jogo.
- O rate limit de login e convite fica em `api_rate_limits`, no PostgreSQL, compartilhado entre instâncias. O identificador de rota e endereço usa HMAC-SHA-256 com `RATE_LIMIT_HASH_SECRET`; tentativas são contadas atomicamente em janelas de 15 minutos, com limite operacional de 10.000 buckets ativos. Inserts concorrentes podem passar temporariamente desse limite; novas chaves são recusadas enquanto a tabela excede o teto. O limite não substitui controles de abuso na borda.
- `/api/test/session` só existe com `APP_ENV=test`; `VERCEL_ENV` tem precedência sobre `APP_ENV` para impedir que a rota seja ativada acidentalmente em Preview ou Production.
- `GET /api/cron/cleanup` exige `Authorization: Bearer $CRON_SECRET`, executa transação e remove sessões, estados OAuth e buckets expirados, além de apagar códigos de amizade fora da validade ou de eventos encerrados. `vercel.json` agenda uma execução diária às 06:00 UTC; Vercel Hobby executa cron apenas em Production, com precisão de até ±59 minutos, e não agenda Preview. Antes de Production, configure `CRON_SECRET`, confirme o papel PostgreSQL e revise retenção e resposta a incidentes.
- Ainda faltam exportação/exclusão de conta, política operacional de retenção e resposta a incidentes. As rotas não devem ser abertas ao público em produção até essa etapa.

## PostgreSQL e variáveis de ambiente

- `DATABASE_URL` é a conexão de runtime. Ela deve usar um login que não seja dono das tabelas, não possa criar/alterar schema, conceder papéis ou alterar `users.is_moderator`. `DATABASE_MIGRATION_URL` é reservada a migrações executadas de forma controlada e não deve ser configurada na função Vercel.
- `pg.Pool` limita cada instância serverless a duas conexões e encerra conexões ociosas após 10 s; desenvolvimento local mantém o limite 8/30 s. Em provedores com endpoint de pool, `DATABASE_URL` deve usar a URL TLS pooled recomendada pelo provedor.
- Em Vercel, configure `DATABASE_URL`, `RATE_LIMIT_HASH_SECRET` e `CRON_SECRET` como valores secretos em cada ambiente que executa a API. OAuth requer `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`; `FRIEND_CODE_ENCRYPTION_KEY` habilita códigos e é obrigatória em Production. `APP_ORIGIN` só é necessário para uma origem própria/canônica. Nunca use prefixos `VITE_` nesses valores.
- O script `scripts/prepare-runtime-db-role.mjs`, chamado por `npm run api:db:prepare`, é restrito a `APP_ENV=development|test`, hosts loopback/Compose e contextos sem `VERCEL_ENV`. Ele concede somente operações de dados previstas; `users` recebe `INSERT` limitado a provedor/subject/handle e `UPDATE(handle)`, e `moderation_events` é append-only para runtime.
- O workflow de CI usa PostgreSQL efêmero, migra com a identidade administrativa e executa a API/testes com a identidade de runtime. Fixtures e limpeza usam a conexão administrativa separada.
- Em Preview e Production, o papel e as permissões do banco precisam ser criados no provedor PostgreSQL; `scripts/prepare-runtime-db-role.mjs` permanece intencionalmente limitado a banco local/efêmero. `api_rate_limits` só recebe SELECT dos campos de janela/expiração/contador e INSERT/UPDATE/DELETE, sem DDL. A CI verifica essas permissões com PostgreSQL efêmero.
- `.env`, `.env.*` e `.vercel/` ficam fora do Git. O `.env.example` contém apenas URLs e senhas fictícias de desenvolvimento. O workflow `Secret scan` roda Gitleaks em commits de PR/push e pode ser acionado manualmente para percorrer o histórico; a saída fica sem comentário, resumo ou artefato.
- A configuração versionada da Vercel envia `nosniff`, bloqueia framing, limita o referrer e desativa câmera, geolocalização e microfone. Não foi adicionada uma CSP sem validar toda a lista de sprites externos; isso continua como hardening a avaliar com teste de runtime.

Não guardar credenciais da Nintendo, senha do jogo ou e-mail. Upload de comprovantes não faz parte dos fluxos atuais.
