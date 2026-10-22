# Auditoria de segurança e organização

> **Relatório histórico:** descreve o modelo PostgreSQL e as verificações executadas na revisão original. A migração atual para SQLite local removeu essa configuração e seus scripts; a arquitetura vigente está em [Segurança](SECURITY.md), [SQLite local](SQLITE_LOCAL.md) e [ADR 0003](DECISIONS/0003-sqlite-local.md). Os resultados abaixo não são verificações SQLite desta branch.

> **Assets:** o inventário de 88 imagens nesta revisão é histórico. Este follow-up as remove do HEAD e conserva os metadados de pesquisa em [Pesquisa visual](VISUAL_REFERENCE_RESEARCH.md); a tabela de inventário abaixo não deve ser lida como estado atual dos binários.

Escopo: `main` em `093446582ac72c77180d2e9e405553920e0ecb2a` (pós-merge da PR #31), revisado na branch `security/repo-audit-2026-10`. O branch remoto antigo `chore/repository-maintenance-review` já está contido nesse merge; não havia PR aberta. A API já estava portada para Bun + Elysia antes desta auditoria; esta mudança reduz privilégios e reforça verificações ao redor dessa implementação. A revisão não acessou banco ou dados de produção.

## Inventário e catálogo

| Área | Arquivo/rota | Achado e evidência | Gravidade | Correção | Verificação | Risco restante |
|---|---|---|---|---|---|---|
| Banco / CI | `.github/workflows/ci.yml`, `apps/api/src/db.js`, `/api/*` | A configuração de CI anterior usava a identidade proprietária do PostgreSQL também para executar a API. Um SQL injection ou falha de autorização com essa identidade poderia alterar schema e colunas de privilégio. | Alta, confirmada na configuração de CI; uso equivalente em produção é desconhecido | Migrações e fixtures usam `DATABASE_MIGRATION_URL`; a API usa `DATABASE_URL` com papel restrito. | CI cria PostgreSQL 16 efêmero, migra com a conta administrativa, prepara o papel de runtime e roda toda a suíte com a conta limitada. | Não foi possível ler a configuração PostgreSQL ou variáveis do projeto Vercel. O operador precisa provisionar e confirmar a separação antes de habilitar a API remota. |
| Banco / privilégios | `scripts/prepare-runtime-db-role.mjs`, `apps/api/test/community-api.integration.test.js` | O modelo anterior não testava privilégios de runtime nem garantia ausência de DDL e alterações de `users.is_moderator`. | Alta, risco confirmado pelo desenho anterior; abuso não observado | Script local/CI limita permissões por tabela e colunas, recusa papéis proprietários/membros e revoga permissões diretas antigas. `users` só aceita os campos de identidade permitidos; `moderation_events` é append-only e não legível pelo runtime. | Teste de integração tenta alterar promoção, criar tabela e ler auditoria; fluxos existentes exercitam inserções e transições autorizadas com o papel limitado. | Testes PostgreSQL não puderam ser executados neste ambiente; o job de CI efêmero é o gate. Privilégios herdados de `PUBLIC` no PostgreSQL continuam sujeitos à configuração padrão do provedor. |
| SQL injection | Consultas em `apps/api/src/server.js`; `/api/teams` | Valores de busca, IDs e dados de equipe usam parâmetros `pg`; fragmento dinâmico encontrado na expiração de convite depende de boolean interno e texto constante, não de entrada do cliente. | Sem vulnerabilidade confirmada nesta revisão; risco plausível coberto por teste | Mantido o acesso parametrizado; adicionado caso com SQL como dado em nome de equipe, caminho com payload e isolamento entre duas contas. | `team writes keep SQL-shaped names as data and cannot cross account ownership` em `apps/api/test/community-api.integration.test.js`. | O teste precisa rodar na CI PostgreSQL; não foi executado contra banco remoto. |
| Autorização por recurso | `/api/teams`, `/api/rooms/:id/*`, `/api/tournaments/:id/*`, `/api/matches/:id/*`, `/api/moderation/*` | Rotas consultadas validam sessão e ownership, participação, host ou moderador no servidor; testes existentes cobrem usuário externo, equipe privada, participante e transições comunitárias. | Sem falha reproduzível encontrada; impacto potencial alto | Preservado o modelo. O teste de SQL e ownership agora cobre leitura/edição/exclusão de equipe privada usando dois usuários. | `npm test`; os cenários PostgreSQL completos são executados em CI com contas de teste. | A revisão estática e os testes não provam ausência de falhas em todas as combinações concorrentes ou futuras. |
| Sessão / configuração | `apps/api/src/server.js`, `apps/api/test/elysia-runtime.test.js` | A rota de sessão de teste considerava `APP_ENV`; em deployment Vercel o contexto efetivo é `VERCEL_ENV`. Uma variável genérica mal definida poderia conflitar com o ambiente de hospedagem. | Média, risco condicional | `VERCEL_ENV` agora prevalece ao decidir produção, cookies Secure e chave de criptografia obrigatória. | Teste cobre `VERCEL_ENV=production` mesmo com `APP_ENV=test`. Cookies de sessão permanecem `HttpOnly`, `SameSite=Lax`; mutações verificam `Origin`. | O ambiente Vercel não foi acessível para confirmar valores configurados. |
| Disponibilidade / limite | `apps/api/src/server.js` | O rate limiter mantinha mapa por chave/IP sem teto; chaves variadas poderiam aumentar memória do processo. | Média, risco plausível | Limite de 10.000 buckets, limpeza amortizada e resposta fechada `429` quando o limite está cheio. | Teste unitário cobre o limite de buckets; `npm test`. | Continua por processo e não limita tráfego agregado entre instâncias Vercel. Não substitui rate limiting distribuído. |
| Segredos / deploy | `.gitignore`, `.env.example`, `.github/workflows/secret-scan.yml` | `.vercel/` não estava ignorado; CI não tinha scanner de segredos dedicado. | Média, prevenção | `.vercel/` ignorado; exemplo contém apenas credenciais fictícias locais; workflow Gitleaks é read-only, sem comentários, artefatos ou resumo de achados. | `git check-ignore`, revisão da configuração e varredura local do histórico alcançável. | Configurações e artefatos privados do GitHub/Vercel não foram acessíveis; segredo real descoberto posteriormente exige rotação no emissor. |
| Frontend / bundle | `apps/web`, `packages`, `dist/` | Busca estática não encontrou sinks de HTML/JS executável; conteúdo de usuário renderiza por texto React; links externos com nova aba usam `noreferrer`. | Sem problema reproduzível encontrado | Nenhuma função ou componente foi removido sem evidência de código morto. Build e bundle serão verificados na rotina final da PR. | `npm run lint`, `npm run build` e inspeção de artefatos. | Não houve teste manual de browser nesta revisão; alterações de UI não fazem parte da correção. |
| Vercel | `vercel.json`, `api/index.js`, `api/[...path].js` | A busca listou `spinda-stop-visual-staging`, `spinda-stop-visual-review` e `spinda-stop-visual-review-preview`; o detalhe de projeto e deployments retornou 403 por falta de autorização ao time proprietário. | Pendência externa | Foram adicionados headers `nosniff`, `DENY`, política de referrer e Permissions-Policy. Nenhum deployment foi criado. | Configuração versionada e testes unitários inspecionados. | URL/commit/ambiente do Preview, variáveis, logs e headers servidos não puderam ser confirmados sem acesso Vercel. |
| Governança GitHub | Branch `main` / proteção de branches | Endpoint de leitura retornou `protected: false` e nenhum check obrigatório. Os workflows têm permissão read-only, mas seus resultados podem não bloquear merge. | Média, configuração confirmada | Sem ferramenta de escrita para regras de branch nesta conexão; registrada como ação operacional. | `GET /repos/Shiroz1n/spinda-stop/branches/main` (leitura). | Proprietário deve exigir PR e checks de CI/secret scan antes de aceitar mudanças diretas em `main`. |
| Dependências / organização | `package-lock.json`, workflows, assets e docs | `npm audit` não encontrou advisories; assets versionados verificados não mostraram cópias privadas de sprites ou dumps de banco. Não houve evidência suficiente para excluir código, teste, documento ou imagem. | Baixa / melhoria opcional | Nenhuma remoção especulativa. Documentação de ambiente e limites de segurança foi alinhada com o código. | `npm audit`, inventário Git e revisão de referências/imports. | Auditoria de dependências reflete o lockfile atual e não cobre risco zero futuro. |

## Segredos e ambientes

- A busca segura sobre 2.290 blobs Git alcançáveis não encontrou padrões de chave/token que justificassem rotação. O `.env.example` contém somente valores fictícios e placeholders.
- `.env*` continua ignorado com exceção explícita de `.env.example`; `.vercel/` agora também é ignorado. Nenhum arquivo local de ambiente foi adicionado ao índice.
- CI recebe credenciais fictícias e PostgreSQL efêmero. Preview/Production devem guardar OAuth, `DATABASE_URL` e `FRIEND_CODE_ENCRYPTION_KEY` no ambiente privado do provedor; nunca exponha esses valores via `VITE_*`.
- `DATABASE_MIGRATION_URL` é administrativa e não deve ser configurada na função Vercel. Rotação de credenciais remotas não foi necessária com a evidência disponível e não pôde ser feita sem acesso ao projeto.
- Bundle de produção não deve conter `DATABASE_URL`, segredo OAuth, chave de cifra, conexão `pg` ou entrada da API. A verificação de build é executada nesta PR; nenhum valor sensível será impresso.

## Rotas, autorização e PostgreSQL

Rotas de OAuth/status e `GET /api/me` são públicas ou descrevem apenas a sessão atual. `/api/teams` é autenticada e limitada ao dono; equipes públicas exigem publicação explícita. Salas e torneios exigem sessão, convite e/ou vínculo de host/membro conforme a ação. Relatos exigem participante; decisões em `/api/moderation/*` exigem moderador. As mutações verificam `Origin`; a API não habilita CORS. O endpoint `/api/test/session` só deve existir no contexto de teste local.

A API usa PostgreSQL através do pool `pg` (`max: 8`, timeout de conexão de 5 s); queries recebem valores como parâmetros e transições de torneio/sala usam transações e locks. IDs são UUID e constraints/foreign keys ficam nas migrações em `apps/api/migrations/`. `api:db:prepare` só aceita loopback/Compose e `APP_ENV` local/test, e não roda com `VERCEL_ENV`. Não concede privilégio DDL ao runtime.

## Bun + Elysia e Vercel

A migração já estava concluída antes desta PR: `apps/api/src/server.js` monta a aplicação Elysia, `api/index.js` e `api/[...path].js` encaminham as funções Vercel para a mesma aplicação; `npm run api:start` e o smoke test usam Bun. O banco continua PostgreSQL. Esta revisão mudou a separação de credenciais e os testes, não refez o servidor.

O repositório seleciona `bunVersion: 1.x`; CI usa Bun 1.4.3. A busca encontrou três projetos com nomes relacionados ao Spinda Stop, mas `get_project` e `list_deployments` retornaram 403 para o time `alaninhuma-s-projects`. A lista de times autorizados veio vazia. Sem acesso ao escopo proprietário, não foi possível observar URL, SHA, ambiente, variáveis ou deployment. Não houve deploy ou promoção.

## Arquivos removidos

| Grupo removido | Destino do conteúdo/função | Motivo |
|---|---|---|
| Nenhum | Não aplicável | A auditoria não comprovou candidatos mortos. Mantivemos testes de fluxos comunitários e imagens/documentos com referência ou uso funcional, em vez de removê-los por busca textual isolada. |

Inventário binário: 88 imagens documentais (86 JPEG, 2 PNG), **12.875.038 bytes antes e depois** nesta PR. São 69 capturas de referência interativa, 15 imagens DataDex fornecidas, um contato visual e três evidências próprias da calculadora. As capturas externas estão isoladas em `artifacts/reformulation/references/`, documentadas como material de pesquisa e não são importadas pelo produto; os sprites da aplicação continuam vindo das origens versionadas e atribuídas em `docs/THIRD_PARTY_LICENSES.md`. Não removi testes ou Markdown: nenhuma remoção teve evidência mais forte que as referências de uso e os manifestos atuais.

## Estado e limites

**Já existia:** Bun + Elysia, PostgreSQL, autorização por objeto no servidor, queries parametrizadas, sessão OAuth em cookie, códigos de convite por hash e código de amizade cifrado, testes de lifecycle e ownership.

**Corrigido nesta PR:** credencial distinta de migração e runtime na CI/local, script local de permissões mínimas, testes de tentativa de DDL e escalada, limite de memória do rate limiter, precedência `VERCEL_ENV`, ignore de `.vercel/`, secret scan no GitHub, headers básicos e documentação de operação.

**Pendente fora desta PR:** confirmar o papel e a política de conexão no PostgreSQL de Preview/Production; inspecionar variáveis e Preview efetivo da Vercel; antes de abrir comunidade publicamente, provisionar limite distribuído, rotina agendada de limpeza, retenção e fluxo de exportação/exclusão de conta.

## Verificações locais

| Comando | Resultado nesta execução |
|---|---|
| `npm run lint` | Passou. |
| `npm test` | 138 testes; 131 passaram, 7 de integração PostgreSQL foram ignorados por `DATABASE_URL` ausente, 0 falhas. Inclui os dois testes de recusa de ambiente Vercel/host remoto. |
| `npm audit --audit-level=moderate` | 0 vulnerabilidades no lockfile instalado. |
| `npm run build` | Passou. Vite 8.3.4 transformou 191 módulos; chunk `damageCalculator` 521,68 kB (126,02 kB gzip) ainda aciona o aviso padrão acima de 500 kB. |
| `node --check` em API, testes e script DB; `git diff --check` | Passaram. |
| Inspeção dos 57 arquivos do bundle | Nenhuma referência a `DATABASE_URL`, segredos OAuth/chave de cifra, import do cliente `pg` ou módulos `apps/api/src`. |
| Inventário de binários rastreados | 88 imagens / 12.875.038 bytes antes e depois; nenhum arquivo removido nesta branch. |

O ambiente desta execução não fornece Bun, Docker, `psql`, Gitleaks nem Chromium Playwright instalado. Portanto, os testes PostgreSQL reais, a preparação do papel, o smoke test Bun e o fluxo navegável completo ficam para CI; a revisão não usou banco de produção. A CI da PR executa PostgreSQL 16 efêmero, migração, preparação do papel restrito, smoke Bun, lint, testes e build. O workflow Visual Review separado executa os fluxos de navegador e capturas em CI. Consulte os checks da PR antes de considerar os testes de integração aprovados.
