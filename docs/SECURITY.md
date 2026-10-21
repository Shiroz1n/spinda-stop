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
- O rate limit de login e convite reside na memória do processo. Em deployment Vercel, a chave usa `X-Forwarded-For`, sobrescrito pela borda; fora dele, usa o endereço de socket recebido por Elysia ([documentação Vercel](https://vercel.com/docs/headers/request-headers)). Em adaptadores sem endereço confiável e sem Vercel, os pedidos compartilham a chave `unknown`, em vez de poder escolher a chave pelo cabeçalho. Isso não protege serviço multi-instância e precisa de limite distribuído antes de uso público.
- `/api/test/session` só existe com `APP_ENV=test`; `VERCEL_ENV` tem precedência sobre `APP_ENV` para impedir que a rota seja ativada acidentalmente em Preview ou Production.
- A limpeza horária depende de um processo Bun persistente. Vercel Functions não garantem timers entre pedidos; configure uma rotina agendada e autenticada antes de abrir a API nesse ambiente.
- Ainda faltam exportação/exclusão de conta, limite distribuído, política operacional de retenção e resposta a incidentes. As rotas não devem ser abertas ao público em produção até essa etapa.

## PostgreSQL e variáveis de ambiente

- `DATABASE_URL` é a conexão de runtime. Ela deve usar um login que não seja dono das tabelas, não possa criar/alterar schema, conceder papéis ou alterar `users.is_moderator`. `DATABASE_MIGRATION_URL` é reservada a migrações executadas de forma controlada e não deve ser configurada na função Vercel.
- O script `scripts/prepare-runtime-db-role.mjs`, chamado por `npm run api:db:prepare`, é restrito a `APP_ENV=development|test`, hosts loopback/Compose e contextos sem `VERCEL_ENV`. Ele concede somente operações de dados previstas; `users` recebe `INSERT` limitado a provedor/subject/handle e `UPDATE(handle)`, e `moderation_events` é append-only para runtime.
- O workflow de CI usa PostgreSQL efêmero, migra com a identidade administrativa e executa a API/testes com a identidade de runtime. Fixtures e limpeza usam a conexão administrativa separada.
- Em Preview e Production, o papel e as permissões do banco precisam ser criados pelo operador no provedor PostgreSQL. Esta revisão não leu variáveis da Vercel nem alterou banco remoto; confirme a separação antes de habilitar os fluxos comunitários.
- `.env`, `.env.*` e `.vercel/` ficam fora do Git. O `.env.example` contém apenas URLs e senhas fictícias de desenvolvimento. O workflow `Secret scan` roda Gitleaks em commits de PR/push e pode ser acionado manualmente para percorrer o histórico; a saída fica sem comentário, resumo ou artefato.
- A configuração versionada da Vercel envia `nosniff`, bloqueia framing, limita o referrer e desativa câmera, geolocalização e microfone. Não foi adicionada uma CSP sem validar toda a lista de sprites externos; isso continua como hardening a avaliar com teste de runtime.

Não guardar credenciais da Nintendo, senha do jogo ou e-mail. Upload de comprovantes não faz parte dos fluxos atuais.
