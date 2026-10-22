# Segurança e privacidade

## Aplicativo local

O construtor mantém um rascunho local por padrão. Arquivos importados são tratados como JSON limitado a 128 KB, versionado e validado; o conteúdo nunca é executado. Analytics não está habilitado.

O importador baixa CSVs de uma revisão fixa da PokéAPI e produz dados locais ignorados pelo Git. Nenhum segredo é necessário. Um erro de download precisa informar a fonte e permitir nova tentativa.

## Contas e salas

Os fluxos comunitários de conta, sala e torneio estão em `apps/api` e usam SQLite local, OAuth do GitHub, sessões por cookie e autorização por recurso. Escopo e limites ficam em [COMMUNITY_MODEL.md](COMMUNITY_MODEL.md).

- Sessões usam token aleatório; SQLite guarda apenas o hash. Cookies são `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Mudanças exigem `Origin` igual a `APP_ORIGIN`. A API não habilita CORS.
- Convites são tokens aleatórios guardados como hash e enviados no fragmento da URL. O estado do OAuth também é aleatório, de uso único e guardado como hash.
- Código de amizade nunca vai para URL ou log. O valor é cifrado em AES-256-GCM e só pode ser aberto por membro do evento; apaga ao encerrar ou ao expirar.
- Equipes são privadas por padrão. A cópia pública depende de escolha explícita. Nenhuma equipe é validada como legal no jogo.
- O rate limit de login e convite reside na memória do processo. Em deployment Vercel, a chave usa `X-Forwarded-For`, sobrescrito pela borda; fora dele, usa o endereço de socket recebido por Elysia ([documentação Vercel](https://vercel.com/docs/headers/request-headers)). Em adaptadores sem endereço confiável e sem Vercel, os pedidos compartilham a chave `unknown`, em vez de poder escolher a chave pelo cabeçalho. Isso não protege serviço multi-instância e precisa de limite distribuído antes de uso público.
- `/api/test/session` só existe com `APP_ENV=test`; `VERCEL_ENV` tem precedência sobre `APP_ENV` para impedir que a rota seja ativada acidentalmente em Preview ou Production.
- A limpeza horária depende de um processo Bun persistente. Vercel Functions não garantem timers entre pedidos; a API Vercel permanece bloqueada até haver armazenamento persistente e uma rotina agendada confiável.
- Ainda faltam exportação/exclusão de conta, limite distribuído, política operacional de retenção e resposta a incidentes. As rotas não devem ser abertas ao público em produção até essa etapa.

## SQLite local, segredos e variáveis de ambiente

- `SPINDA_DB_PATH` define o arquivo local; o padrão é `.local/spinda-stop.sqlite`, resolvido em relação à raiz do repositório. `.local`, arquivos SQLite, sidecars WAL e backups ficam ignorados pelo Git e pelo envio Vercel. A aplicação não serve esses arquivos como assets e o build web não importa módulos de `apps/api`.
- Cada conexão aplica e confirma `PRAGMA foreign_keys=ON`; valores externos usam placeholders SQLite. As tabelas usam checks e FKs para conter estados, cardinalidade e relações. `BEGIN IMMEDIATE` mantém operações atômicas e a fila por conexão serializa atualizações locais.
- SQLite não possui usuários nem GRANT por tabela. A API e o runner de migração rodam com a mesma identidade de sistema operacional; qualquer código/processo com acesso de arquivo pode ler, alterar e executar DDL. `apps/api/src/db.js` cria o diretório com `0700` e o banco com `0600` quando possível. Essa fronteira é adequada ao uso local de uma pessoa, não equivale a um papel de runtime isolado de DDL em serviço multiusuário.
- `.env`, `.env.*`, `.vercel/`, banco, sidecars, backups e `artifacts/` ficam fora do Git. `.env.example` tem somente nomes, valores vazios e o caminho default local. `FRIEND_CODE_ENCRYPTION_KEY` e credenciais OAuth são opcionais locais, privadas e nunca `VITE_*`. Build e inspeção do bundle fazem parte da CI.
- O workflow de CI usa bancos SQLite temporários, aplica migrações e executa API/testes com Bun. Testes de integração apagam seus próprios diretórios ao terminar. Nenhum teste conecta ao banco Vercel nem a Production.
- No projeto Vercel inspecionado, não havia `DATABASE_URL` nem `DATABASE_MIGRATION_URL`. A API responde `503 persistent_storage_required` antes de abrir um caminho local porque o filesystem de Functions não é persistente/compartilhado. Nenhum deployment de SQLite foi criado; produção não foi alterada.
- O workflow `Secret scan` roda Gitleaks em commits de PR/push e pode ser acionado manualmente para percorrer o histórico; a saída fica sem comentário, resumo ou artefato.
- A configuração versionada da Vercel envia `nosniff`, bloqueia framing, limita o referrer e desativa câmera, geolocalização e microfone. Não foi adicionada uma CSP sem validar toda a lista de sprites externos; isso continua como hardening a avaliar com teste de runtime.

O banco local contém contas GitHub identificadas por ID/handle, hashes de sessão, equipes privadas e registros de evento. Proteja o arquivo e backups como dados privados. Não guardar credenciais da Nintendo, senha do jogo ou e-mail. Upload de comprovantes não faz parte dos fluxos atuais.
