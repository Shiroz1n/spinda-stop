# Skills de agente no Spinda Stop

Este guia conecta skills externas às regras já mantidas no repositório. Use Impeccable e Ponytail quando estiverem disponíveis no ambiente de trabalho. Se uma skill não estiver disponível, siga os documentos do projeto e não diga que a executou. Este arquivo registra como usá-las; não substitui nem copia seus arquivos originais.

## Ordem de decisão

1. Pedido atual, escopo aprovado e comportamento que o produto precisa manter.
2. `AGENTS.md`, `DEVELOPMENT.md`, arquitetura, documentação de dados e decisões de design do Spinda Stop.
3. Recomendações das skills. Uma skill não autoriza inventar dados, remover salvaguardas, chamar serviços externos, publicar, fazer merge ou alterar algo fora do pedido.

## Impeccable — padrão para todo trabalho de design

Use a skill Impeccable em qualquer tarefa de interface: planejar, criar, revisar, redesenhar ou refinar telas, fluxos, componentes, formulários, responsividade, acessibilidade, tipografia, cores, tokens ou movimento. Isso também vale para ajustes pequenos. Ela complementa os documentos do Spinda Stop; não os substitui.

### Antes de editar

- Leia `docs/UI_HUMANIZER.md`, `docs/DESIGN.md`, `docs/SPINDA_STOP_DESIGN_SYSTEM.md` e `docs/VISUAL_REVIEW.md`, além de `DEVELOPMENT.md` e dos documentos de dados, arquitetura ou licenças afetados.
- Inspecione a implementação atual, telas vizinhas, conteúdo real e estados além da abertura. Use capturas atuais como evidência; uma referência externa não define sozinha a identidade do produto.
- Se Impeccable estiver disponível, siga o setup da skill uma vez na sessão, informe um alvo real e carregue a referência do fluxo adequado antes de executá-lo. Se o setup não estiver disponível, continue pelos documentos do projeto sem inventar que o comando rodou.
- Escolha o fluxo pelo pedido: `shape` para planejar uma mudança relevante; `critique` para avaliar uma interface; `audit` para verificações técnicas de acessibilidade, performance e responsividade; `polish` para o passe final; use `layout`, `typeset`, `adapt`, `animate`, `clarify` ou outros comandos focados quando o pedido for específico. Para uma superfície nova ou substituição visual, siga o fluxo `new-work` da skill.
- Refinamento preserva identidade, conteúdo factual, comportamento e tudo que estiver fora do escopo. Redesign substitui a linguagem visual, mantendo a verdade do produto; só faça isso quando solicitado ou aprovado. Uma seção nova dentro de uma tela estabelecida herda a identidade existente.
- Um pedido de crítica, auditoria ou planejamento gera recomendações; não aplique mudanças automaticamente. Siga a referência do comando e identifique qualquer parte que não pôde ser executada.

### Direção do Spinda Stop

- A referência FireRed/GBA aparece em sinais curtos, sprites e seleção. Mantenha uma composição própria; não copie layouts, paletas, textos, código ou artes exclusivas de outros produtos.
- Projete cada rota em torno da tarefa e dos dados dela. A primeira dobra deve mostrar o objeto, o controle principal, o resultado ou a próxima ação. Evite repetir uma grade genérica de cards em telas com tarefas diferentes.
- Preserve a distinção entre dados gerais de Pokémon, dados de uso, regras e disponibilidade. Não invente estatísticas, amostras, compatibilidade de golpes, temporada oficial ou legalidade. Mantenha `unknown` diferente de `unavailable`.
- Use sprites e outros assets com origem, forma correta, licença e atribuição registradas em `docs/THIRD_PARTY_LICENSES.md`.
- Confira conteúdo longo, carregamento, vazio, erro, sucesso, seleção e recuperação. Teclado, foco visível, rótulos, contraste, movimento reduzido e toque precisam funcionar; cor não deve ser o único sinal.

### Verificação visual

- Durante a implementação, rode `npm run visual:review:fast -- --pages=<rotas-afetadas>` para inspecionar as rotas selecionadas em desktop e mobile. Abra as capturas e verifique hierarquia, conteúdo, foco, estado e overflow; axe e medições não aprovam a composição por si sós.
- Antes de concluir uma PR, rode o gate completo `npm run visual:review`, que cobre todas as telas em 1440, 720, 390 e 320 px, além de axe e fluxos comunitários. A versão rápida não substitui esse gate. Siga `DEVELOPMENT.md` e `docs/VISUAL_REVIEW.md` para preparar o ambiente.
- Faça uma inspeção visual ampla, corrija os problemas encontrados em lote e confirme o resultado em no máximo mais uma rodada. Não transforme a revisão em polimento sem fim.

## Ponytail — simplicidade com entendimento do fluxo

Use Ponytail como lente de simplicidade em tarefas de código quando estiver disponível: entenda a tarefa e trace o fluxo primeiro; reutilize o que já existe; prefira plataforma, biblioteca padrão e dependências já instaladas; adicione abstração ou dependência somente quando resolver uma necessidade comprovada.

Não simplifique removendo validação de entrada, segurança, acessibilidade, tratamento de erro que evita perda de dados, comportamento pedido ou os testes exigidos pelo repositório. `DEVELOPMENT.md` e os gates de CI continuam valendo.

- `ponytail-review` examina o diff em busca de complexidade desnecessária.
- `ponytail-audit` examina o repositório inteiro para encontrar candidatos a corte ou simplificação.
- Essas skills produzem achados; não aplicam mudanças. A estimativa de linhas removíveis é informativa, não uma meta.
- A versão de Ponytail disponível neste ambiente foca em complexidade e explicitamente não cobre bugs, segurança ou performance. Confira o `SKILL.md` da versão ativa; não trate o audit como revisão geral nem substitua revisões técnicas específicas.

### Confirme cada candidato antes de remover

Para qualquer sugestão `delete`, `stdlib`, `native`, `yagni` ou `shrink`: confira o caminho e os chamadores em todo o repositório, incluindo testes, fixtures, configuração, rotas, imports dinâmicos, referências por string, flags, workflows e contratos externos. Identifique o comportamento concreto que mudaria e o menor teste ou verificação que prova segurança. Não remova código só porque não aparece no fluxo principal ou porque o resumo do agente diz que está sem uso.

Se houver incerteza sobre uma funcionalidade, contrato, fonte de dados ou caminho de execução, registre a dúvida e mantenha o candidato fora da lista de remoções seguras. Se o pedido for somente auditar, entregue o relatório sem editar o código.

## Registro de trabalho

Em cada PR, registre as decisões que mudam a experiência, as rotas e estados inspecionados, capturas relevantes, skills realmente usadas e verificações executadas. Nunca declare que uma skill, build, teste, auditoria ou inspeção visual foi executada sem tê-la executado.