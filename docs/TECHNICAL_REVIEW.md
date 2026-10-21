# Revisão técnica do monorepo

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

Todos os 155 binários rastreados antes da limpeza eram imagens documentais em `artifacts/reformulation/`; fontes de ícone, sprites do produto e dados são dependências ou URLs fixadas, não cópias locais. A busca por hashes não encontrou duplicatas byte a byte. A pasta de referências mantém 69 estados de cinco sites e 15 imagens DataDex fornecidas pelo usuário, com URLs, viewports, ações e limites no manifesto. São material documental, não assets incorporados no app nem declaração de direito de redistribuição.

| Grupo removido | Quantidade e bytes | Destino da informação | Função/cobertura preservada |
|---|---:|---|---|
| `artifacts/reformulation/before/` | 27 PNG; incluídos no total `before/`+`after/` de 6.347.417 bytes | Links 1440/390/320/720 px para o commit histórico `bf89fc5`; capturas de revisão também no artefato GitHub Actions da PR #30. | Comparação visual antes/depois. Não se confunde o artefato temporário (retém até 4 nov. 2026) com o histórico Git. |
| `artifacts/reformulation/after/` | 36 PNG; incluídos no total `before/`+`after/` acima | Mesmo destino histórico e artefato do Visual Review completo. | 9 rotas nas quatro larguras; screenshots CI não ficam no checkout de manutenção. |
| `calculator-selection/desktop-calculator-move-{1..4}-*.png` | 4 PNG; 662.207 bytes | `four-moves-sequence.jpg` e asserções de seleção no Playwright. | Quatro golpes/atualizações de dano; as capturas exclusivas de teclado e mobile continuam versionadas. |
| Markdown | Nenhum removido. | Os documentos de origem continuam como fonte de verdade; esta página concentra o catálogo da auditoria. | Decisões, dados, licenças e procedimentos preservados. |
| Testes e mocks | Nenhum removido. | Suítes existentes; foram acrescentadas duas verificações de runtime Elysia. | Contrato de API, domínio, cálculo, sprites e integração PostgreSQL preservados. |

Os 63 PNGs `before/` e `after/` somavam 6.347.417 bytes; os quatro PNGs por golpe, 662.207 bytes. Total de imagens removidas: **7.009.624 bytes**. A pasta tinha 19.899.041 bytes antes da edição; o tamanho final inclui a ampliação deste README e é registrado na própria [página do pacote de evidências](../artifacts/reformulation/README.md). Essa redução afeta o HEAD, não o histórico Git. Sprites externos continuam fixados por revisão e IDs de forma; testes verificam as 49 Megas mapeadas, formas especiais, fallback sem substituição silenciosa e URLs de tipos/itens. Origem/direitos continuam em [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Bun, Elysia e PostgreSQL

- A migração já estava implementada antes desta PR na PR #30, commit `2e75f41`: removeu `node:http`, adicionou o adaptador Fetch/Elysia, entrypoints Vercel compartilhados (`api/index.js`, `api/[...path].js`), smoke test Bun e scripts/dependências Bun. O diff dessa migração se concentra em adapter/entrypoints/configuração; operações de rota já existentes foram mantidas. Não existe um segundo backend legado em paralelo.
- Elysia continua usando os mesmos métodos/caminhos e o corpo das rotas comunitárias; a suíte compara erros, status, cookies e headers pelo Fetch. CI usa Bun 1.4.3 e PostgreSQL 16 efêmero. O teste local atual cobre o adaptador, mas não executa Bun nem PostgreSQL porque esses binários/serviços e `DATABASE_URL` não estão disponíveis neste ambiente.
- `apps/api/src/db.js` configura `pg.Pool` com limite 8, timeout de conexão e timeout de inatividade. `migrate.js` usa advisory lock, registra versão, transação por migração e encerra pool. Operações de domínio usam transações e parâmetros `$n`; interpolação identificada em `clearExpiredTournamentFriendCodes` escolhe apenas fragmento SQL constante. Não encontrei uma suspeita reproduzível de SQL injection.
- `community-api.integration.test.js` usa PostgreSQL real e cobre dono/acesso cruzado, salas, convites, torneio, moderação, OAuth e origem de escrita. CI de PR #30 passou essa suíte; nova execução PostgreSQL para a PR de manutenção deve ser confirmada nos checks remotos antes de considerar o gate concluído.
- A configuração Vercel seleciona Bun `1.x`; as duas funções de entrada reexportam o mesmo app. O conector Vercel retornou `403` por acesso ausente ao time do projeto e a listagem por repositório não retornou projeto. Assim, URL, commit e ambiente de um deployment posterior a `bf89fc5` permanecem **não verificados**. O deployment antigo do relatório da PR #30 apontava para o SHA `d5ef83f`, anterior ao merge. Nenhum deploy foi iniciado manualmente.

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
- A única redução medida é o checkout de imagens de revisão: 7.009.624 bytes removidos no HEAD. Não é redução do histórico Git nem uma medição de tempo de download de produção.
- Pool por instância e cache de Usage permanecem documentados; não foi feita medição de inicialização, memória ou latência da nova stack. Sem números reproduzíveis, nenhum ganho Bun/Elysia é alegado.

## Testes, mocks e fluxos

- Não removi testes. Os mocks do runtime Elysia isolam transporte/cookies; a suíte de integração existente usa PostgreSQL para autorização/transações. O visual review rápido mocka `/api/**` e é explicitamente um subconjunto de interface, não teste de backend.
- Teste novo de XFF cobre a chave rate limit sem socket; teste novo de deployment cobre a precedência de `VERCEL_ENV` e a ausência de cookie de sessão de teste.
- Executado localmente: teste total **132 casos: 127 passaram, 0 falharam e 5 foram ignorados** por ausência de `DATABASE_URL`; runtime Elysia **9/9**; lint passou; build passou; `npm audit` encontrou 0 vulnerabilidades. CI PR #30 Bun smoke e integração PostgreSQL passaram antes da manutenção. Checks completos da nova branch ainda precisam terminar.
- O modo rápido tem seleção `--pages`/`--screens` e `VISUAL_REVIEW_PAGES`; foi executado localmente com `calculator,builder`: o build passou (3,1 s no comando), mas a captura não abriu porque o Chromium de Playwright não está instalado (`chromium-1248` ausente). O Visual Review workflow agora instala Chromium e executa o modo rápido nas telas de salas/torneios antes do gate completo, salvando ambos no artefato. Esperar o resultado remoto para registrar uma duração desta branch.
- O modo completo preserva as quatro larguras, axe, fluxos comunitários e PostgreSQL efêmero. Na PR #30, antes do merge, percorreu 464 observações e passou em 841 s (14 min 01 s). O gate completo da branch de manutenção é requisito antes de aprovar esta revisão; não é substituído pelo rápido.
- `npm run api:runtime:smoke` não foi executado localmente porque Bun não está instalado. Os workflows instalam Bun 1.4.3. A execução da PR #30 passou; o check atualizado deve confirmar a branch final.

## Documentação e textos

- Corrigidos estados obsoletos da PR #30 e referências a screenshots no checkout em `docs/NEXT_VISUAL_REDESIGN.md`, `docs/VISUAL_REDESIGN_REVIEW.md`, `docs/SPINDA_STOP_DESIGN_SYSTEM.md`, `docs/VISUAL_REVIEW.md` e `artifacts/reformulation/README.md`.
- `docs/ARCHITECTURE.md`, `docs/SECURITY.md` e `DEVELOPMENT.md` agora descrevem a origem confiável do IP, a prioridade `VERCEL_ENV` e o alcance da rota de teste.
- `README.md` aponta para este catálogo. Nenhum documento de dados, mecânica, sprite, fonte/licença ou arquitetura foi apagado; os demais mantêm propósito ou decisão própria.
- As mensagens visíveis de fonte, período, dados gerais, motor de cálculo e legalidade não verificada foram mantidas. Não foi identificada alteração editorial que justificasse mudar esses limites ou as ações existentes.

## Itens mantidos como recomendação

1. Confirmar por acesso Vercel concedido o deployment pós-merge, URL, SHA, ambiente e rotas. A limitação concreta foi 403 de autorização do conector para o time.
2. Aguardar o CI da PR de manutenção: Bun smoke, PostgreSQL 16 efêmero e Visual Review rápido+completo.
3. Medir chunk e API em runtime antes de qualquer refatoração de performance.
4. Planejar controles distribuídos, retenção e exclusão/exportação de dados antes de habilitar fluxos comunitários a público amplo.
