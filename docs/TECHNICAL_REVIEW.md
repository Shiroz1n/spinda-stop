# Revisão técnica do monorepo

> Este catálogo registra a revisão anterior à PR #32 e descreve o backend PostgreSQL daquele commit. O estado da conversão para MySQL e as lacunas do Preview estão em [MYSQL_MIGRATION.md](MYSQL_MIGRATION.md). Os números e o estado Vercel abaixo são históricos. A pesquisa visual está em [VISUAL_RESEARCH.md](VISUAL_RESEARCH.md).

## Escopo e conclusão

Revisão iniciada em 21 out. 2026 na branch `chore/repository-maintenance-review`, baseada no `main` após o merge da reformulação (#30), commit `bf89fc5b6d0e4e93b8dcbf2b14e1b833e24da56f`. A PR de manutenção deve conter esta página e permanecer aberta. A PR #30 já foi mesclada conforme autorização; nenhum merge ou deploy manual foi feito para esta revisão.

O inventário cobriu `apps/web`, `apps/api`, `packages`, `scripts`, workflows, configuração, testes, binários versionados e os 30 Markdown já rastreados antes deste catálogo. A principal correção de segurança foi no endereço usado pelo rate limit; outra impede ativar uma rota de sessão de teste em deployments Vercel. A limpeza reduziu cópias de capturas de CI. Não encontrei evidência segura para apagar componentes, regras CSS, código de domínio, migrações, testes ou documentação de produto.

## Inventário antes das alterações

| Prioridade e classe | Caminho/evidência | Impacto | Correção/decisão |
|---|---|---|---|
| Alta — risco reproduzível | `apps/api/src/server.js`: quando `server.requestIP()` não existia, o primeiro valor de `X-Forwarded-For` virava a chave do rate limit. A reprodução com 30 endereços forjados passou todas as chamadas ao OAuth; com chave constante, 24 passaram e 6 receberam `429`. | A entrada do cliente podia contornar o limite local de OAuth e convite no adaptador Fetch sem IP de socket. O deployment Vercel não foi acessível para confirmar o caminho em produção. | Usar o endereço de socket ou, apenas quando `VERCEL_ENV` identifica Vercel, o cabeçalho que a borda Vercel sobrescreve. O teste reproduz a tentativa sem confiar no cabeçalho local. Fonte do contrato: [Vercel request headers](https://vercel.com/docs/headers/request-headers). |
| Média — risco plausível por configuração | `apps/api/src/server.js`: `/api/test/session` exigia `APP_ENV=test`; a configuração anterior preferia `APP_ENV` mesmo se o runtime fornecesse `VERCEL_ENV=preview/production`. | Uma variável configurada por engano poderia expor criação de sessões de teste num deployment. Não foi observado deployment com essa configuração. | `VERCEL_ENV` agora prevalece e há teste de regressão para `preview`. |
| Dispensável com evidência | `artifacts/reformulation/before/` e `after/`: 63 imagens do Visual Review, geradas novamente em cada workflow e recuperáveis no artefato/commit da PR #30. Quatro PNGs individuais dos golpes repetiam os quatro quadros da sequência composta. | 7.009.624 bytes de PNGs gerados/repetidos mantidos no checkout. | Removidos da branch; links comparativos por viewport usam o commit histórico; artefatos de CI mantêm saída reproduzível. Capturas de teclado e mobile distintas foram preservadas. |
| Usado, sem remoção segura | `apps/web/src/main.jsx` importa `styles.css`, `visual-refresh.css` e `composition-refresh.css`; `apps/api/src/server.js` contém todas as rotas ativas e domínio comunitário. | Apagar arquivos por nome ou tamanho quebraria regras/rotas cuja utilização inclui seletores/estados dinâmicos. | Mantidos após conferir imports, caminhos de execução, testes e build. Nenhuma regra CSS ou rota foi apagada por inferência. |
| Opcional, sem evidência de ganho | Build produz chunks lazy de Pokédex (478,10 KB; 58,16 KB gzip) e calculadora (521,68 KB; 126,02 KB gzip). | O chunk de calculadora supera o alerta de 500 KB não comprimidos, mas é carregado por rota e a compressão é menor. | Mantido; não atribuir ganho de performance a uma divisão não medida. Registrar carregamento real antes de reestruturar. |

## Frontend, JSX e textos

- Os arquivos JSX de páginas/componentes em `apps/web/src` são referenciados pelo roteador, shell ou componentes ativos; `main.jsx` é o entrypoint declarado em `apps/web/index.html`. ESLint, regras de hooks e build passaram. Nenhum componente foi removido sem prova de que estava morto. A produção continua dividida por rotas.
- Buscas estáticas no código da aplicação não encontraram `dangerouslySetInnerHTML`, `innerHTML` nem `eval`. React continua escapando texto interpolado; URLs, importações JSON e parâmetros de rota usam fluxos próprios e validação do domínio. Isso é inspeção de código, não uma garantia geral contra XSS.
- As três folhas CSS são importadas em `main.jsx`. Não foi feita remoção baseada só em busca de nomes de classe, pois seletores condicionais e classes dinâmicas podem não aparecer como texto estático. Build CSS: 279,55 KB minificado / 49,24 KB gzip.
- A revisão editorial aplicou `docs/UI_HUMANIZER.md` e a skill `@humanizer` às mensagens/estados alterados por este trabalho. Não alterei microcopy de Pokédex, ficha, Usage, builder, calculadora, Speed, salas ou torneios: a revisão não encontrou uma mudança de texto que pudesse ser justificada sem alterar instrução, fonte ou limite de produto. As mensagens de erro/vazio e distinções de disponibilidade/legalidade já existentes foram preservadas.

## Imagens e outros binários

Na revisão anterior havia 155 imagens documentais em `artifacts/reformulation/`; fontes de ícone, sprites do produto e dados são dependências ou URLs fixadas, não cópias locais. A revisão retirou 63 PNGs de saída do Visual Review e quatro PNGs de golpes redundantes. Depois do merge da PR #32 ainda restavam 88 imagens (86 JPEG e 2 PNG), 12.875.038 bytes, sem uso no bundle. Esta continuação removeu as 88 imagens restantes e moveu o registro textual da pesquisa para [VISUAL_RESEARCH.md](VISUAL_RESEARCH.md). Nenhuma captura é necessária ao runtime.

| Grupo removido | Quantidade e bytes | Destino da informação | Função/cobertura preservada |
|---|---:|---|---|
| `before/` e `after/` do Visual Review | 63 PNG; 6.347.417 bytes | Artefatos de Actions e histórico da PR #30. | Capturas reproduzíveis para 9 rotas nas quatro larguras. |
| Quatro capturas individuais de golpes | 4 PNG; 662.207 bytes | Sequência composta e asserções do teste de navegador. | Seleção dos quatro golpes e atualização de dano. |
| Referências ao vivo | 69 JPEG | Observações, URLs, ações, estados e decisões em `VISUAL_RESEARCH.md`; binários acessíveis no commit histórico `bf89fc5`. | Cinco ferramentas, exclusivamente desktop durante a pesquisa. |
| DataDex e contact sheet | 16 JPEG | Decisões DataDex em `VISUAL_RESEARCH.md`. | 15 telas fornecidas e uma montagem visual; binários removidos do HEAD. |
| Evidências próprias da calculadora | 1 JPEG + 2 PNG | Asserções de interação do Visual Review no navegador. | Quatro golpes, seleção por teclado e estado mobile; binários removidos do HEAD. |
| Markdown e testes | Nenhum documento ou teste excluído nesta continuação. O manifesto foi movido de `artifacts/` para `docs/`. | `VISUAL_RESEARCH.md`, `VISUAL_REVIEW.md` e testes existentes. | Observações, fluxos e limitações continuam legíveis sem os binários. |
| Testes e mocks | Nenhum removido nesta continuação. | Suítes existentes e teste do Visual Review em `apps/web/test/visual-review.mjs`. | Contrato de API, domínio, cálculo, sprites e integração PostgreSQL preservados. |

As 88 imagens restantes somavam **12.875.038 bytes** e foram removidas nesta continuação. Junto dos 7.009.624 bytes removidos na revisão anterior, o HEAD deixa de rastrear capturas de pesquisa e review. Isso não apaga objetos do histórico Git. O `.gitignore` agora ignora a pasta inteira `artifacts/`; os workflows seguem salvando suas capturas como artefatos do Actions. Sprites externos continuam fixados por revisão e IDs de forma; testes verificam as 49 Megas mapeadas, formas especiais, fallback sem substituição silenciosa e URLs de tipos/itens. Origem/direitos continuam em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Bun, Elysia e PostgreSQL

- A migração já estava implementada antes desta PR na PR #30, commit `2e75f41`: removeu `node:http`, adicionou o adaptador Fetch/Elysia, entrypoints Vercel compartilhados (`api/index.js`, `api/[...path].js`), smoke test Bun e scripts/dependências Bun. O diff dessa migração se concentra em adapter/entrypoints/configuração; operações de rota já existentes foram mantidas. Não existe um segundo backend legado em paralelo.
- Elysia continua usando os mesmos métodos/caminhos e o corpo das rotas comunitárias; a suíte compara erros, status, cookies e headers pelo Fetch. CI usa Bun 1.4.3 e PostgreSQL 16 efêmero. O teste local atual cobre o adaptador, mas não executa Bun nem PostgreSQL porque esses binários/serviços e `DATABASE_URL` não estão disponíveis neste ambiente.
- `apps/api/src/db.js` configura `pg.Pool` com limite 8, timeout de conexão e timeout de inatividade. `migrate.js` usa advisory lock, registra versão, transação por migração e encerra pool. Operações de domínio usam transações e parâmetros `$n`; interpolação identificada em `clearExpiredTournamentFriendCodes` escolhe apenas fragmento SQL constante. Não encontrei uma suspeita reproduzível de SQL injection.
- `community-api.integration.test.js` usa PostgreSQL real e cobre dono/acesso cruzado, salas, convites, torneio, moderação, OAuth e origem de escrita. CI de PR #30 passou essa suíte; CI da PR #31 passou novamente com PostgreSQL 16 efêmero, Bun smoke test e `api:migrate` no commit `a9083ad` (workflow [CI #210](https://github.com/Shiroz1n/spinda-stop/actions/runs/39606640070)).
- Na revisão anterior, o conector Vercel retornou `403`, então a URL do deployment pós-merge não foi verificada naquele momento. Em 22 out. 2026 o projeto `spinda-stop` e seu deployment Preview foram confirmados; detalhes e resposta `/api` estão em [SECURITY_AUDIT.md](SECURITY_AUDIT.md). O `outputDirectory: apps/web/dist` foi adicionado à configuração versionada nesta continuação; não houve deploy.

## Segurança

| Fluxo/risco | Evidência revisada | Ação e limite |
|---|---|---|
| Rate limit de OAuth/convites | Endereços forjados em `X-Forwarded-For` anulavam a chave quando não havia IP de socket. | Corrigido; fora de Vercel usa socket ou chave comum `unknown`; só Vercel usa o header que o provedor diz sobrescrever. Novo teste assegura 24 `302` seguidos por seis `429` para 30 cabeçalhos diferentes no adaptador sem socket. Não é rate limit distribuído. |
| Sessão de teste remota | Rota condicionada a `APP_ENV=test`; contexto de deployment também fornece `VERCEL_ENV`. | Precedência corrigida, `preview` não ativa `/api/test/session`, teste confirma `404` sem cookie. Não é observação de deployment Vercel real. |
| Sessões, CSRF e autorização por recurso | Cookies `HttpOnly`, `SameSite=Lax`, `Secure` em deployment; origem exigida nas escritas; consultas usam dono/participante/host/moderador na API e parâmetros SQL. | Fluxos e acesso cruzado já têm cobertura de integração. Nenhuma query de usuário interpolada foi encontrada. Limite: execução PostgreSQL desta branch depende do CI efêmero. |
| XSS e importação | Entrada JSON é limitada e validada; o cliente não executa conteúdo importado; sem APIs de HTML cru/eval na aplicação. | Nenhuma correção adicional indicada. Revisão estática e testes existentes não cobrem todo conteúdo possível de provedor. |
| Segredos/dependências | Scan de padrões de tokens/keys no HEAD e patches alcançáveis dos últimos 180 dias sem resultado; `npm audit` e `npm audit --omit=dev` reportaram 0 vulnerabilidades. | Nenhuma credencial real foi exposta ou removida; a busca cobre padrões conhecidos e não substitui rotação/monitoramento do provedor. |
| Operação | Rate limit e limpeza horária são por instância; pool comporta até 8 conexões por instância; Vercel Functions não garantem timers. | Limites já constam em `SECURITY.md`/`COMMUNITY_MODEL.md`; continuam recomendação antes de uso público: quota distribuída, cron autenticado/retention, exclusão/exportação de conta e resposta a incidentes. |

Nenhuma inspeção justifica declarar o sistema livre de invasões. Acesso Vercel, bancos de produção e credenciais não foram usados nesta revisão.

## Performance

- Não houve alteração em caminho de render ou cache sem métrica que mostrasse problema. Build confirma carregamento lazy das rotas; chunks de Pokédex e calculadora permanecem grandes em tamanho bruto, mas em 58,16 KB e 126,02 KB gzip. O warning do chunk de calculadora foi mantido como oportunidade de medição, não tratado como ganho garantido.
- A redução medida no HEAD é de 7.009.624 bytes na revisão anterior e 12.875.038 bytes nesta continuação. Não é redução do histórico Git nem uma medição de tempo de download de produção.
- Pool por instância e cache de Usage permanecem documentados; não foi feita medição de inicialização, memória ou latência da nova stack. Sem números reproduzíveis, nenhum ganho Bun/Elysia é alegado.

## Testes, mocks e fluxos

- Não removi testes. Os mocks do runtime Elysia isolam transporte/cookies; a suíte de integração existente usa PostgreSQL para autorização/transações. O visual review rápido mocka `/api/**` e é explicitamente um subconjunto de interface, não teste de backend.
- Teste novo de XFF cobre a chave rate limit sem socket; teste novo de deployment cobre a precedência de `VERCEL_ENV` e a ausência de cookie de sessão de teste.
- Executado localmente: teste total **132 casos: 127 passaram, 0 falharam e 5 foram ignorados** por ausência de `DATABASE_URL`; runtime Elysia **9/9**; lint passou; build passou; `npm audit` encontrou 0 vulnerabilidades. No CI da PR #31, Bun smoke, migrações, lint, testes com PostgreSQL efêmero e build passaram no commit `a9083ad` (workflow [CI #210](https://github.com/Shiroz1n/spinda-stop/actions/runs/39606640070)).
- O modo rápido tem seleção `--pages`/`--screens` e `VISUAL_REVIEW_PAGES`; foi executado localmente com `calculator,builder`: o build passou (3,1 s no comando), mas a captura não abriu porque o Chromium de Playwright não está instalado (`chromium-1248` ausente). O Visual Review workflow agora instala Chromium e executa o modo rápido nas telas de salas/torneios antes do gate completo, salvando ambos no artefato. No CI da PR #31, `rooms,tournaments` passaram em **4,6 s**: 16 observações entre desktop e mobile, 0 falhas; é subconjunto de desenvolvimento e `axe` não está incluído. O workflow salva esse resultado separadamente e o artefato completo.
- O modo completo preserva as quatro larguras, axe, fluxos comunitários e PostgreSQL efêmero. Na PR #30, antes do merge, percorreu 464 observações e passou em 841 s (14 min 01 s). Na PR #31 percorreu **464 observações, 0 falhas, axe incluído**, e passou em **810,4 s (13 min 30 s)** no commit `a9083ad`, workflow [Visual Review #162](https://github.com/Shiroz1n/spinda-stop/actions/runs/39606640276). O job completo terminou em aproximadamente 14 min 42 s incluindo preparação do runner, instalação, upload do artefato e limpeza. A execução da PR #30 levou 841 s (14 min 01 s); o modo rápido não substitui esse gate.
- `npm run api:runtime:smoke` não foi executado localmente porque Bun não está instalado. Os workflows instalam Bun 1.4.3. Os workflows instalaram Bun 1.4.3 e o smoke test passou na branch da PR #31.

## Documentação e textos

- Corrigidos estados obsoletos da PR #30 e referências a capturas em `docs/NEXT_VISUAL_REDESIGN.md`, `docs/VISUAL_REDESIGN_REVIEW.md`, `docs/SPINDA_STOP_DESIGN_SYSTEM.md`, `docs/SECOND_VISUAL_RESEARCH.md`, `docs/THIRD_PARTY_LICENSES.md` e `docs/VISUAL_RESEARCH.md`.
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md` e `DEVELOPMENT.md` agora descrevem a origem confiável do IP, a prioridade `VERCEL_ENV` e o alcance da rota de teste.
- `README.md` aponta para este catálogo. Nenhum documento de dados, mecânica, sprite, fonte/licença ou arquitetura foi apagado; os demais mantêm propósito ou decisão própria.
- As mensagens visíveis de fonte, período, dados gerais, motor de cálculo e legalidade não verificada foram mantidas. Não foi identificada alteração editorial que justificasse mudar esses limites ou as ações existentes.

## Itens mantidos como recomendação

1. Confirmar por acesso Vercel concedido o deployment pós-merge, URL, SHA, ambiente e rotas. A limitação concreta foi 403 de autorização do conector para o time.
2. Aguardar o CI da PR de manutenção: Bun smoke, PostgreSQL 16 efêmero e Visual Review rápido+completo.
3. Medir chunk e API em runtime antes de qualquer refatoração de performance.
4. Planejar controles distribuídos, retenção e exclusão/exportação de dados antes de habilitar fluxos comunitários a público amplo.
