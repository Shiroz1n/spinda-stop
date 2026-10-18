# Contas, salas e torneios

As partidas continuam acontecendo no Pokémon Champions. O Spinda Stop organiza participantes e relatos que eles enviam voluntariamente; não acessa o jogo nem confirma partidas por conta própria.

## Primeiro fluxo

O primeiro recorte usa uma sala privada de duas pessoas. O host cria o convite, ambos se inscrevem e fazem check-in, o host fecha as inscrições e inicia a sala. Uma pessoa relata o vencedor; a outra confirma ou contesta. Uma contestação exige ação de moderador e justificativa. Torneios e salas maiores ficam em PR separado.

Equipes da conta são cópias do rascunho do builder. A pessoa escolhe `private` ou `public` ao salvar; a opção inicial é privada. Carregar uma cópia para o builder é uma ação explícita e não altera a versão salva. O servidor valida a estrutura do arquivo, mas não legalidade, compatibilidade de golpes ou regulamento.

O código de amizade é opcional. A pessoa o compartilha por ação própria, só fica visível aos membros inscritos, pode removê-lo e é apagado quando a sala termina ou após sete dias. Não é lido do jogo e nunca aparece em uma equipe pública. O armazenamento usa AES-256-GCM; sem a chave de ambiente, a função fica desativada.

## Modelo PostgreSQL

| Tabela | Responsabilidade | Proteção principal |
|---|---|---|
| `users` | ID interno, provedor, ID do GitHub, handle e flag de moderação | Provedor e ID externos únicos; sem e-mail |
| `oauth_states` | Hash e expiração de cada `state` de OAuth | Uso único; nunca guardar o estado em claro |
| `sessions` | Hash do token aleatório e expiração | Cookie `HttpOnly`; revogação no logout |
| `teams` | Dono, visibilidade, versão e JSON do rascunho | Privada por padrão; só o dono altera ou exclui |
| `rooms` | Host, nome, estado e convite | Apenas hash do convite; expira em sete dias; duas pessoas nesta etapa |
| `room_members` | Inscrição, check-in e código cifrado | Chave composta por sala e usuário; ciphertext nunca sai da API |
| `matches` | Duas pessoas e estado da partida | Participantes verificados em toda ação |
| `match_reports` | Vencedor e nota informados | Um relato por partida; reenvio conflitante é rejeitado |
| `disputes` | Motivo e decisão da contestação | Só moderador decide, com justificativa |
| `moderation_events` | Histórico append-only de decisões | Ator, sala, alvo, ação e motivo registrados |
| `tournaments` | Configuração de torneio e versão do chaveamento | Entra em migração própria, depois da sala |

As migrações SQL ficam em `apps/api/migrations/`. IDs são UUIDs; horários são `timestamptz` em UTC. Transições de sala e partida usam transações e bloqueios de linha. O tamanho inicial está limitado a duas pessoas; ampliar o limite exige criar e testar o chaveamento de torneio.

## Estados e autorização

- Sala: `open → locked → in_progress → completed`; o host pode cancelar antes de começar.
- Membro: `registered → checked_in`; sair só é permitido enquanto a entrada estiver aberta.
- Partida: `scheduled → awaiting_confirmation → confirmed` ou `disputed → confirmed/void`.
- Só o host fecha inscrições, inicia ou cancela. Cada pessoa faz seu próprio check-in e pode relatar o vencedor.
- Só o adversário do relato pode confirmar ou contestar. Moderadores não falam em nome dos jogadores.
- Um moderador é concedido por operação de banco; não existe ação para usuário se promover.
- Um membro inscrito pode ver códigos compartilhados na própria sala. Moderadores e visitantes não recebem esses códigos.
- Nenhum endpoint expõe as respostas brutas das fontes competitivas ou dados privados de outra conta.

## Rotas do primeiro recorte

| Rota | Acesso | Uso |
|---|---|---|
| `GET /api/auth/status`, `GET /api/auth/github`, callback e `POST /api/auth/logout` | Público ou usuário atual | OAuth do GitHub e sessão |
| `GET /api/me` | Público | Descobrir sessão sem expor token |
| `/api/teams` | Dono | Salvar, listar, editar visibilidade e excluir cópias |
| `GET /api/teams/public` | Público | Listar equipes que o dono publicou explicitamente |
| `/api/rooms`, `/api/rooms/join` | Usuário autenticado | Listar salas próprias, criar ou entrar por convite |
| `/api/rooms/:id/*` | Membro ou host, conforme a ação | Check-in, convite, início, código de amizade e cancelamento |
| `/api/matches/:id/*` | Participante | Relatar, confirmar ou contestar resultado |
| `/api/moderation/disputes*` | Moderador | Revisar e decidir contestações |

As ações mutáveis exigem `Origin` igual a `APP_ORIGIN`. A API não habilita CORS. Convite usa token aleatório no fragmento (`#...`) da URL, que o navegador não envia no pedido da página; o hash é removido e o token fica somente na aba até o login terminar. A API não registra corpo, cookie ou URL de pedido.

## Autenticação e operação

- OAuth Authorization Code do GitHub, com `state` aleatório, salvo como hash e conferido contra cookie de curta duração. O escopo pedido é `read:user`; o token do provedor não é persistido.
- Só o ID do GitHub e o handle público são guardados. O aplicativo não recebe senha de usuário, e-mail, senha do jogo ou credenciais da Nintendo.
- Sessão aleatória com 30 dias, guardada no navegador em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em produção. PostgreSQL armazena somente SHA-256 do token.
- Convites expiram em sete dias e sua rotação invalida o anterior. Tentativas de login e convite têm limite básico por IP no processo.
- Códigos de amizade usam AES-256-GCM e chave configurada fora do banco. O ciphertext é apagado ao encerrar a sala e por rotina após a validade máxima de sete dias.
- Em desenvolvimento, o serviço ouve em `127.0.0.1`; proxy do Vite encaminha `/api`. CI usa PostgreSQL 16 efêmero. Banco, OAuth, chave e domínio de produção não foram configurados nem publicados.

O rate limit é local ao processo e não basta para uma implantação com múltiplas instâncias. Antes de abrir cadastro em produção, configurar limite distribuído, exportação/exclusão de conta, retenção de logs e resposta a incidentes. O projeto não deve ser implantado publicamente até essa revisão operacional.

## Próximas partes

O PR seguinte amplia o fluxo para torneios: inscrição e check-in de grupo, chaveamento versionado, rodadas, registro de resultado, contestação e progresso. A chave deriva apenas de quem fez check-in e não representa integração com o jogo. Salas públicas, uploads de evidência e pareamento automático ficam fora do primeiro torneio.
