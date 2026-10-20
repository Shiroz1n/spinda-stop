# UI Humanizer — guia geral de revisão visual

Este documento serve a produtos diferentes. Ele não define a marca do Spinda Stop nem substitui um design system de projeto. Use-o para identificar decisões automáticas, revisar a interface em contexto e explicar por que cada elemento existe. A expressão “cara de IA” descreve uma combinação recorrente de escolhas genéricas; nenhum detalhe isolado prova a autoria de um site.

## Antes de desenhar

Registre, em poucas linhas: quem usa, a tarefa principal, o conteúdo real disponível, a linguagem visual pretendida e uma tela de referência do próprio produto. Defina o que deve aparecer na primeira dobra de desktop e celular. Se o produto já tem identidade aprovada, evolua a partir dela. Não aplique uma estética de marketing de SaaS a uma Pokédex, padaria, ferramenta interna ou outro produto só porque é um ponto de partida conhecido.

## Diagnóstico de padrões repetidos

| Sinal observado | Pergunta de revisão | Melhor caminho quando o padrão não ajuda | Quando pode fazer sentido |
| --- | --- | --- | --- |
| Grade uniforme de cartões com ícone, título e parágrafo | Cada bloco é uma unidade clicável? A grade facilita comparar? | Tabela, lista densa, composição editorial, painel de tarefa ou seção contínua. | Catálogo de itens independentes, com dados comparáveis. |
| Cartões dentro de cartões e muitas bordas | As divisões correspondem a ações ou relações reais? | Use agrupamento por alinhamento, espaço e divisórias; reserve a moldura forte para o foco. | Painéis que precisam de limite visual e estado próprio. |
| Chips ou badges por toda parte | O rótulo codifica tipo, filtro ativo, estado ou categoria? | Texto simples ou legenda próxima; elimine rótulos que só repetem o título. | Filtros selecionáveis, tipos e status que precisam ser varridos rapidamente. |
| Ponto pulsante ou indicador “ao vivo” | A atualização foi comprovada e o movimento informa algo? | Mostre horário de captura e estado em texto; anime apenas enquanto algo realmente acontece. | Conexão ativa ou evento em andamento com significado verificável. |
| Emoji em botão, métrica, título ou card | Ele comunica algo melhor que texto ou um ícone consistente? | Use ícone desenhado para o sistema, imagem pertinente ou só texto. | Conteúdo informal em que o emoji integra a voz do produto. |
| Página sem imagens relevantes | Existem pessoas, produtos, itens ou dados que poderiam ser vistos? | Use fotografia, arte, captura, diagrama ou sprite com origem e função claros. | Ferramenta textual em que a imagem atrapalharia a leitura. |
| Hero de SaaS genérico | O começo da página mostra o produto e a tarefa? | Mostre interface, objeto principal, busca, ação ou resultado concreto. | Página comercial de software cujo objetivo é demonstrar a oferta. |
| Eyebrow em caixa alta, tracking largo e traço | O rótulo adiciona contexto que o título não dá? | Remova; use uma legenda funcional só quando localizar seção, modo ou período. | Navegação editorial complexa ou metadado útil. |
| Título com palavra em gradiente ou trecho final em itálico | A ênfase ajuda a entender ou só tenta parecer sofisticada? | Reescreva a frase e crie hierarquia por conteúdo, escala e posição. | Identidade que já utiliza esse recurso intencionalmente. |
| Gradientes, glassmorphism e brilho difuso | A superfície expressa marca, profundidade ou estado? | Cor sólida, textura discreta, contorno ou contraste estrutural. | Uma direção visual que dependa do efeito e mantenha legibilidade. |
| Botões e shapes em pill por padrão | O raio se relaciona aos componentes e à identidade? | Defina geometria coerente; diferencie ação principal, secundária e controle. | Marca explicitamente arredondada ou affordance de seleção. |
| Hover idêntico em tudo | A transição confirma interação ou distrai? | Escolha resposta por tipo de controle; inclua foco, toque e movimento reduzido. | Feedback curto e específico de uma ação. |
| Seção “como funciona” em três passos arbitrários | A tarefa realmente tem três etapas? | Descreva o fluxo real ou mostre a interface em uso. | Processo que de fato possui três decisões consecutivas. |
| Depoimentos, contadores e provas sociais genéricas | Existem fontes, contexto e permissão para publicar? | Remova o bloco; demonstre o produto com evidência real. | Depoimentos identificáveis e autorizados, métricas verificadas. |
| Texto longo antes da tarefa | A explicação é necessária naquele ponto? | Coloque a ação e o resultado primeiro; detalhe na ajuda contextual. | Decisão complexa cujo risco exige orientação prévia. |
| Barras à esquerda e blocos de citação decorativos | Eles diferenciam conteúdo ou repetem um template? | Escolha tratamento próprio para alerta, citação ou anotação; elimine ornamentos vazios. | Citação real, contexto editorial ou estado que precisa de destaque. |

Um link externo, um SVG local ou CSS gerado não torna um ícone “de IA”. Avalie se o asset é apropriado, tem origem documentada, carrega com eficiência e funciona nos estados necessários. Não julgue qualidade pela pasta onde o arquivo está salvo.

## Regras de composição e conteúdo

1. Comece pelo objeto do usuário: produto, pessoa, Pokémon, pedido ou tarefa. Faça a informação essencial aparecer sem percorrer avisos e introduções.
2. Escolha a estrutura que serve aos dados. Tabelas para comparação, listas para varredura, formulários para edição; cards para entidades que se beneficiam de agrupamento individual.
3. Dê peso visual conforme a importância. Uma ação principal por contexto, estados selecionados inequívocos, informações secundárias recolhidas quando apropriado.
4. Escreva nomes de controles que descrevam ações. Remova frases de marketing, instruções redundantes, três adjetivos em sequência, texto de bastidor e números sem fonte.
5. Adicione personalidade com decisões específicas do domínio: iconografia, imagens, ritmo e linguagem coerentes. Não confunda personalidade com decoração em todos os elementos.
6. Use cor e forma em conjunto com texto quando transmitem estado. Garanta leitura de contraste, teclado, toque, 320 px, zoom e preferência por movimento reduzido.
7. Estados de carregamento, ausência de dados, erro e atualização precisam de significado e ação. Não preencha vazios com estatísticas ou cards fictícios.

## Processo para outra pessoa ou agente

1. Inspecione a página existente e pelo menos dois estados reais além da abertura: seleção, filtro, erro, vazio, formulário preenchido ou comparação. Faça capturas em desktop e celular.
2. Liste, para cada elemento em dúvida: função, informação carregada, consequência da remoção e substituição proposta. Preserve o que funciona.
3. Esboce a composição antes de alterar todas as rotas. A proposta deve mostrar conteúdo real e a primeira dobra de celular.
4. Implemente tokens e componentes apenas quando a repetição tiver propósito. Não crie um componente genérico para três blocos com semânticas distintas.
5. Teste fluxos e revise capturas manualmente. Lint, build, axe e ausência de overflow verificam partes do trabalho, mas não aprovam a composição.

## Critério de aceite

Outra pessoa deve identificar o produto e a tarefa em poucos segundos; encontrar o controle principal; distinguir conteúdo real, seleção e erro; entender imagens e métricas; e completar um fluxo no celular e no desktop. No PR, registre exemplos **antes → decisão → depois**, além de problemas ainda abertos. Não declare um visual “humanizado” apenas porque removeu gradientes ou badges.

## Relação com outros documentos

O design system do produto prevalece para paleta, tipografia e componentes. Segurança, acessibilidade, direitos de imagem, dados e regras de domínio continuam obrigatórios. As referências de frontend e escrita natural consultadas para compor este guia orientam a revisão; este arquivo não afirma que uma skill externa esteja instalada em outras sessões.
