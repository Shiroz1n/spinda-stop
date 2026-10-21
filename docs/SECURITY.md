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

Não guardar credenciais da Nintendo, senha do jogo ou e-mail. Upload de comprovantes não faz parte dos fluxos atuais.
