# Modelo comunitário

Este documento define o primeiro recorte de contas, equipes, salas e torneios. As partidas continuam acontecendo no Pokémon Champions; o Spinda Stop só organiza participantes e resultados informados por eles. Não existe integração com o jogo.

## Regras de produto

- Uma sala inicial é privada, tem convite e aceita de 2 a 8 participantes. Listagem pública de salas fica para depois.
- A inscrição e o check-in são ações explícitas. O host pode fechar a entrada e iniciar a sala.
- Um resultado é informado por um participante. O adversário confirma ou contesta; uma contestação exige decisão de moderador e motivo registrado.
- O código de amizade é opcional, nunca é importado do jogo, nunca aparece em equipe pública e não é necessário para entrar ou jogar.
- O participante escolhe compartilhar o código naquela sala. Ele fica visível apenas para os participantes da sala, pode ser removido e expira quando a sala termina ou após sete dias.
- Equipes e salas são privadas por padrão. Publicar uma equipe requer uma ação separada e não publica a conta, o código de amizade ou as salas do usuário.
- Não guardamos e-mail, senha do jogo, senha do usuário, senha de sala ou credenciais da Nintendo. A primeira autenticação proposta é OAuth do GitHub.

## Entidades PostgreSQL

| Tabela | Campos mínimos | Regras |
|---|---|---|
| `users` | `id`, `provider`, `provider_subject`, `handle`, `created_at`, `disabled_at` | `provider + provider_subject` únicos. Não armazenar e-mail por padrão. |
| `sessions` | `id`, `user_id`, `token_hash`, `expires_at`, `created_at` | O cookie contém token aleatório; o banco guarda somente seu hash. |
| `teams` | `id`, `owner_id`, `name`, `visibility`, `data_json`, `schema_version`, `created_at`, `updated_at` | `visibility` começa como `private`; só o dono edita. Sets mantêm sua forma e Stat Points sem declarar legalidade. |
| `rooms` | `id`, `host_id`, `name`, `status`, `capacity`, `invite_hash`, `invite_expires_at`, `registration_closes_at`, `created_at`, `finished_at` | Armazenar hash do convite; capacidade entre 2 e 8 no primeiro fluxo. |
| `room_members` | `room_id`, `user_id`, `status`, `checked_in_at`, `friend_code_ciphertext`, `friend_code_nonce`, `created_at` | Uma inscrição por usuário e sala. Código cifrado com AES-GCM e chave fora do banco; nunca em log. |
| `matches` | `id`, `room_id`, `round_number`, `player_a_id`, `player_b_id`, `status`, `created_at`, `resolved_at` | Jogadores precisam estar inscritos na mesma sala; não há resultado automático do jogo. |
| `match_reports` | `id`, `match_id`, `reporter_id`, `winner_id`, `note`, `created_at` | Um relato por participante. Sem upload de imagem nesta fase. |
| `disputes` | `id`, `match_id`, `opened_by`, `reason`, `status`, `resolution`, `moderator_id`, `created_at`, `resolved_at` | Só o adversário do relato pode contestar; decisão exige moderador e justificativa. |
| `moderation_events` | `id`, `actor_id`, `room_id`, `target_user_id`, `action`, `reason`, `created_at` | Registro append-only; ações incluem fechar entrada, retirar participante, anular partida e resolver contestação. |
| `tournaments` | `id`, `room_id`, `format`, `bracket_type`, `bracket_version`, `created_at` | Entra num PR próprio após a sala pequena; chave gerada a partir de quem fez check-in. |

Usar chaves estrangeiras, `CHECK` para estados/capacidade, `UNIQUE(room_id, user_id)` e migrações SQL versionadas. Escritas que mudam uma partida ou chave usam transação para impedir duas confirmações concorrentes. Guardar horário em UTC.

## Estados e permissões

### Sala e inscrição

`open → locked → in_progress → completed`; o host pode cancelar antes de `completed`. Uma sala `open` aceita entrada por convite. O usuário entra como `registered`, faz check-in para `checked_in` e pode sair enquanto a sala estiver `open`. O host pode impedir novas inscrições, retirar alguém antes do início e iniciar com pelo menos dois participantes que fizeram check-in. Depois de iniciada, o host não edita silenciosamente a lista.

### Resultado

`scheduled → awaiting_confirmation → confirmed` ou `disputed → confirmed/void`. Um participante envia o vencedor e uma nota curta; o outro confirma ou abre disputa. Só um moderador resolve a disputa. Reenvios idênticos são idempotentes; um segundo resultado conflitante não sobrescreve o primeiro.

### Matriz de acesso

| Ação | Qualquer visitante | Membro da sala | Host | Moderador |
|---|---:|---:|---:|---:|
| Ver sala privada | Não | Sim | Sim | Apenas para moderação necessária |
| Entrar usando convite válido | Não | — | Sim | Sim |
| Check-in ou saída antes do início | Não | Próprio usuário | Sim | Sim |
| Ver código de amizade compartilhado | Não | Sim, enquanto inscrito | Sim, como membro | Não por padrão |
| Fechar entrada/iniciar sala | Não | Não | Sim | Sim |
| Registrar ou confirmar resultado | Não | Participantes da partida | Se participante | Não em nome de jogador |
| Contestar resultado | Não | Adversário do relato | Se participante | Não |
| Resolver disputa ou anular partida | Não | Não | Não | Sim, com justificativa |

Toda rota que altera estado valida usuário autenticado, papel, vínculo com a sala, estado atual e propriedade no servidor. A interface não é controle de autorização.

## Autenticação e operação

- API Node separada do Vite; PostgreSQL 16+ como fonte de verdade e migrations SQL no repositório.
- OAuth GitHub Authorization Code com `state` de uso único; não receber nem persistir senha do usuário. Em produção, configurar callback e secrets fora do código.
- Sessão aleatória em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, duração limitada, hash no banco e rotação ao autenticar. Verificar `Origin`/CSRF em ações mutáveis.
- Limitar convites inválidos e login por IP/conta; não colocar tokens de convite em analytics ou logs. Guardar somente hash do convite.
- Criptografar código de amizade no servidor com chave AES-GCM de ambiente/KMS; excluir ciphertext e nonce ao encerrar a sala ou após sete dias. Permitir remoção antes disso.
- `moderation_events` registra ações sem guardar conteúdo privado desnecessário. Planejar exclusão/exportação de conta antes de abrir cadastro ao público.
- Banco de produção, OAuth e domínio são configurações futuras; nenhuma migração ou deploy de produção está autorizado por este plano.

## Ordem de implementação

1. PR de arquitetura e contratos (este documento).
2. PR de sala pequena: migrations, login OAuth, equipes privadas, sala com convite, inscrição, check-in, código opcional cifrado, partida, confirmação/disputa e moderação mínima. Testes de permissões e transições antes de integrar o banco real.
3. PR de torneios: inscrições/check-in, chaveamento versionado, rodadas, partidas e progresso, reusando resultados e moderação.
4. Só depois: salas públicas, pareamento, uploads de evidência e recursos sociais.
