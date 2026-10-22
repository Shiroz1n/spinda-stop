# Contas, salas e torneios

As partidas continuam acontecendo no Pokémon Champions. O Spinda Stop organiza participantes e relatos que eles enviam voluntariamente; não acessa o jogo nem confirma partidas por conta própria.

## Escopo atual

O fluxo menor é uma sala privada de duas pessoas. O host cria o convite, ambas se inscrevem e fazem check-in, o host fecha as inscrições e inicia a sala. Uma pessoa relata o vencedor; a outra confirma ou contesta. Uma contestação exige ação de moderador e justificativa.

O primeiro torneio é privado e aceita exatamente quatro participantes. O host entra ao criar; as outras três pessoas usam o convite. Todos fazem check-in antes de o host fechar as inscrições. Ao iniciar, o servidor sorteia seeds com `crypto.randomInt`, cria duas semifinais (seed 1 contra 4; seed 2 contra 3) e só cria a final quando ambos os resultados das semifinais forem confirmados. O resultado da final define o campeão. As partidas continuam no Pokémon Champions; o site não as inicia nem verifica.

Se a moderação anular uma partida do torneio, o evento é cancelado e não existe replay automático nesta versão. A organização não oferece bye, chave dupla, salas públicas, uploads de evidência, inscrição por equipe ou pareamento de adversários. O host não pode sair de um torneio aberto; os demais podem sair antes do bloqueio.

Equipes da conta são cópias do rascunho do builder. A pessoa escolhe `private` ou `public` ao salvar; a opção inicial é privada. Carregar uma cópia para o builder é uma ação explícita e não altera a versão salva. O servidor valida a estrutura do arquivo, mas não legalidade, compatibilidade de golpes ou regulamento.

O código de amizade é opcional. A pessoa o compartilha por ação própria, só fica visível aos membros inscritos do evento, pode removê-lo e é apagado quando a sala ou torneio termina ou após sete dias. Um timer local tenta limpar a cada hora; no Vercel, a limpeza confiável depende do cron diário em Production e das leituras que limpam o evento consultado. Preview não executa cron. Não é lido do jogo e nunca aparece em uma equipe pública. O armazenamento usa AES-256-GCM; sem a chave de ambiente, a função fica desativada.

O compartilhamento de Pokémon também é opcional e separado da visibilidade da equipe salva. A pessoa escolhe uma equipe da própria conta dentro da sala ou torneio. Só os seis IDs de espécie e forma são copiados para o evento, e apenas integrantes ativos conseguem lê-los; golpes, itens, habilidades, naturezas, pontos e nome privado da equipe não saem do registro do dono. A pessoa pode substituir ou remover o compartilhamento. O snapshot é limpo quando o evento termina ou quando a pessoa deixa a inscrição.

## Modelo MySQL

| Tabela | Responsabilidade | Proteção principal |
|---|---|---|
| `users` | ID interno, provedor, ID do GitHub, handle e flag de moderação | Provedor e ID externos únicos; sem e-mail; o runtime não pode alterar a flag |
| `oauth_states` | Hash e expiração de cada `state` de OAuth | Uso único; nunca guardar o estado em claro |
| `sessions` | Hash do token aleatório e expiração | Cookie `HttpOnly`; revogação no logout |
| `api_rate_limits` | HMAC-SHA-256 de rota/endereço, janela, contador e expiração | Incremento atômico compartilhado; sem IP em claro; papel de runtime sem DDL |
| `teams` | Dono, visibilidade, versão e JSON do rascunho | Privada por padrão; só o dono altera ou exclui |
| `rooms` | Host, nome, estado e convite | Apenas hash do convite; expira em sete dias; duas pessoas nesta etapa |
| `room_members` | Inscrição, check-in, código cifrado e snapshot de espécies/formas compartilhado | Chave composta por sala e usuário; código cifrado não sai da API; equipe privada só aparece por ação do dono |
| `tournaments` | Host, estado, convite, versão do chaveamento e campeão | Capacidade fixa de quatro; convite guardado só como hash |
| `tournament_members` | Inscrição, check-in, seed, código cifrado e snapshot de espécies/forms compartilhado | Acesso restrito ao evento; código expira em sete dias e equipe termina com a inscrição ou evento |
| `matches` | Duas pessoas, rodada, vaga no chaveamento e estado | Cada partida pertence a uma sala ou torneio; participantes verificados em toda ação |
| `match_reports` | Vencedor e nota informados | Um relato por partida; reenvio conflitante é rejeitado |
| `disputes` | Motivo e decisão da contestação | Só moderador decide, com justificativa |
| `moderation_events` | Histórico append-only de decisões | Ator, evento, alvo, ação e motivo registrados |

As migrações MySQL ficam em `apps/api/migrations/`. IDs são UUIDs gerados pela API e armazenados em `CHAR(36)` com comparação binária; horários são `DATETIME(3)` com a sessão em UTC; blobs cifrados usam `VARBINARY`; equipes e snapshots ficam em colunas `JSON`. As tabelas usam `InnoDB`, `utf8mb4_bin`, foreign keys e checks. Transições de sala, torneio e partida usam transações e `SELECT ... FOR UPDATE`. Um índice único impede mais de uma partida por rodada e vaga no chaveamento. Operações de limpeza de roster que antes eram executadas por triggers PostgreSQL agora são atualizações explícitas dentro das transações de domínio.

Runtime e migrações usam credenciais MySQL distintas: `DATABASE_URL` para a aplicação e `DATABASE_MIGRATION_URL` para alterações de schema controladas. O usuário de runtime não pode executar DDL, criar/grant usuários nem alterar `users.is_moderator`; a matriz executável em banco local/CI está em `scripts/prepare-runtime-mysql-role.mjs`. A mesma separação ainda precisa ser criada e testada no MySQL remoto de Preview.

## Estados e autorização

- Sala: `open → locked → in_progress → completed`; o host pode cancelar antes de começar.
- Torneio: `open → locked → in_progress → completed`; o host pode cancelar antes de começar e uma partida anulada pela moderação cancela o evento.
- Membro: `registered → checked_in`; sair só é permitido enquanto a entrada estiver aberta.
- Partida: `scheduled → awaiting_confirmation → confirmed` ou `disputed → confirmed/void`; confirmar as duas semifinais cria a final.
- Só o host fecha inscrições, inicia ou cancela. Cada pessoa faz seu próprio check-in e pode relatar o vencedor.
- Só o adversário do relato pode confirmar ou contestar. Moderadores não falam em nome dos jogadores.
- Um moderador é concedido por operação de banco; não existe ação para usuário se promover.
- Um membro inscrito pode ver códigos compartilhados na própria sala. Moderadores e visitantes não recebem esses códigos.
- Um membro inscrito pode ver códigos compartilhados no próprio torneio. A chave e o estado do evento não são públicos; nesta versão não há espectador nem remoção de participante por moderador.
- Nenhum endpoint expõe as respostas brutas das fontes competitivas ou dados privados de outra conta.

## Rotas do primeiro recorte

| Rota | Acesso | Uso |
|---|---|---|
| `GET /api/auth/status`, `GET /api/auth/github`, callback e `POST /api/auth/logout` | Público ou usuário atual | OAuth do GitHub e sessão |
| `GET /api/me` | Público | Descobrir sessão sem expor token |
| `/api/teams` | Dono | Salvar, listar, editar visibilidade e excluir cópias |
| `GET /api/teams/public` | Público | Listar equipes que o dono publicou explicitamente |
| `/api/rooms`, `/api/rooms/join` | Usuário autenticado | Listar salas próprias, criar ou entrar por convite |
| `/api/rooms/:id/*` | Membro ou host, conforme a ação | Check-in, convite, início, código de amizade, compartilhar/remover equipe e cancelamento |
| `/api/tournaments`, `/api/tournaments/join` | Usuário autenticado | Listar, criar ou entrar em torneio privado por convite |
| `/api/tournaments/:id/*` | Membro ou host, conforme a ação | Consultar chave, check-in, sair, fechar, iniciar, cancelar, compartilhar/remover equipe e código de amizade |
| `/api/matches/:id/*` | Participante | Relatar, confirmar ou contestar resultado |
| `/api/moderation/disputes*` | Moderador | Revisar e decidir contestações |

As ações mutáveis exigem `Origin` igual a `APP_ORIGIN`. A API não habilita CORS. Convite usa token aleatório no fragmento (`#...`) da URL, que o navegador não envia no pedido da página; o hash é removido e o token fica somente na aba até o login terminar. A API não registra corpo, cookie ou URL de pedido.

## Autenticação e operação

- OAuth Authorization Code do GitHub, com `state` aleatório, salvo como hash e conferido contra cookie de curta duração. O escopo pedido é `read:user`; o token do provedor não é persistido.
- Só o ID do GitHub e o handle público são guardados. O aplicativo não recebe senha de usuário, e-mail, senha do jogo ou credenciais da Nintendo.
- Sessão aleatória com 30 dias, guardada no navegador em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. MySQL armazena somente SHA-256 do token.
- Convites expiram em sete dias e sua rotação invalida o anterior. Login e entrada por convite compartilham um limite de 24 tentativas por rota/endereço em 15 minutos, armazenado de forma atômica no MySQL; o identificador usa HMAC-SHA-256 com `RATE_LIMIT_HASH_SECRET` e não guarda o endereço em claro.
- Códigos de amizade usam AES-256-GCM e chave configurada fora do banco. O ciphertext é apagado ao encerrar o evento e pela limpeza horária local ou diária Vercel após a validade máxima de sete dias.
- Em desenvolvimento, Bun + Elysia ouve em `127.0.0.1`; proxy do Vite encaminha `/api`. As funções Vercel de `/api` usam o runtime Bun. CI usa MySQL 8.4 efêmero; Preview deve usar banco MySQL independente e credenciais sem acesso a Production.

O processo local persistente executa limpeza horária. `GET /api/cron/cleanup` fornece a mesma rotina para Vercel e exige `CRON_SECRET`; `vercel.json` agenda uma chamada diária às 06:00 UTC. Vercel só executa cron em Production, não no Preview. No plano Hobby a execução é diária, com precisão de até ±59 minutos; a plataforma não tenta novamente uma chamada que falhe. O Preview precisa ser limpo por chamada autenticada ou por um processo administrativo de teste.

O limite de tentativas já é compartilhado por MySQL, mas não substitui defesa contra abuso distribuído na borda. Antes de abrir cadastro em produção, confirmar as credenciais e o usuário do banco, `CRON_SECRET`, OAuth, exportação/exclusão de conta, retenção de logs e resposta a incidentes. O projeto não deve ser implantado publicamente até essa revisão operacional.

## Limites operacionais

A versão atual registra um torneio de eliminação simples com quatro pessoas e três partidas no máximo. Não permite replay; a moderação pode confirmar um relato ou anulá-lo, e anular cancela o torneio. A seed depende de sorteio criptográfico, mas não é um serviço de aleatoriedade auditável externamente. Não há salas públicas, uploads de evidência, pareamento automático, espectador ou remoção de participante por moderador.

Antes de abrir cadastro em produção, confirmar o limite e o cron com o banco remoto e configurar exportação e exclusão de conta, retenção de logs e resposta a incidentes. O projeto ainda não deve ser implantado publicamente até essa revisão operacional.
