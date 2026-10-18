# Segurança e privacidade

## Aplicativo local

O construtor mantém um rascunho local por padrão. Arquivos importados são tratados como JSON limitado a 128 KB, versionado e validado; o conteúdo nunca é executado. Analytics não está habilitado.

O importador baixa CSVs de uma revisão fixa da PokéAPI e produz dados locais ignorados pelo Git. Nenhum segredo é necessário. Um erro de download precisa informar a fonte e permitir nova tentativa.

## Contas e salas

O primeiro fluxo comunitário está em `apps/api` e usa PostgreSQL, OAuth do GitHub, sessões por cookie e autorização por recurso. Escopo e limites ficam em [COMMUNITY_MODEL.md](COMMUNITY_MODEL.md).

- Sessões usam token aleatório; PostgreSQL guarda apenas o hash. Cookies são `HttpOnly`, `SameSite=Lax` e `Secure` em produção.
- Mudanças exigem `Origin` igual a `APP_ORIGIN`. A API não habilita CORS.
- Convites são tokens aleatórios guardados como hash e enviados no fragmento da URL. O estado do OAuth também é aleatório, de uso único e guardado como hash.
- Código de amizade nunca vai para URL ou log. O valor é cifrado em AES-256-GCM e só pode ser aberto por membro da sala; apaga ao encerrar ou ao expirar.
- Equipes são privadas por padrão. A cópia pública depende de escolha explícita. Nenhuma equipe é validada como legal no jogo.
- O rate limit de login e convite reside na memória do processo. Ele não protege serviço multi-instância e precisa de reforço antes de implantação pública.
- Ainda faltam exportação/exclusão de conta, limite distribuído, política operacional de retenção e resposta a incidentes. As rotas não devem ser abertas ao público em produção até essa etapa.

Não guardar credenciais da Nintendo, senha do jogo ou e-mail. Upload de comprovantes não faz parte do primeiro fluxo.
