# Revisão visual

## Conferência parcial — 18/10/2026

Usei a prévia temporária do commit `77b0ff7` (`feat/fire-red-identity`) em desktop, com viewport de 1363 × 936. Ela contém a identidade visual atual, mas antecede a comparação de cenários da calculadora do PR #11.

| Tela ou fluxo | Conferência feita |
|---|---|
| Pokédex | Busca por Garchomp; três formas apareceram e a ficha abriu. |
| Ficha | Dados gerais, origem PokéAPI e aviso de disponibilidade desconhecida foram exibidos. |
| Construtor | Set salvo no navegador, campos de set, ações para Usage e calculadora visíveis. |
| Usage — Battle Data | Busca e filtros por tipo e golpe; Garchomp permaneceu com fonte, período e lacunas identificados. Uma busca sem resultado mostrou contagem zero e mensagem de vazio. |
| Usage — MetaRoll | Troca de fonte, ficha, seleção de data diária, matchups e ladder foram consultados. Data de captura e temporada permaneceram ligadas à MetaRoll. |
| Teclado | `Tab` levou ao link de salto; o foco apareceu com contorno de 3 px. |
| Calculadora | Um cenário Doubles mostrou 16 rolagens e o aviso sobre o redutor de golpe em área. A comparação do PR #11 não estava nesta prévia. |

Nas páginas consultadas, não encontrei corte horizontal em desktop. As capturas disponíveis foram guardadas fora do repositório para revisão: `desktop-dex.jpg`, `desktop-detail.jpg`, `desktop-builder.jpg`, `desktop-usage-battle-data.jpg`, `desktop-usage-metaroll.jpg`, `desktop-usage-history.jpg`, `desktop-ladder.jpg` e `desktop-calculator-result.jpg`.

## O que falta

Esta conferência **não conclui a revisão visual**. Não consegui configurar viewport mobile no Chrome remoto, e por isso não capturei nem validei telas mobile. A rota de calculadora comparativa do PR #11 também precisa de uma prévia atual antes de avaliar visualmente esse fluxo.

Tentativas no ambiente:

- `npx playwright install chromium` recebeu um arquivo de 0 MiB do CDN e terminou com erro de ZIP truncado.
- `apt-get update` falhou ao iniciar o usuário isolado `_apt` (`setgroups: Operation not permitted`); não há navegador local instalado.
- O Chrome remoto funciona, mas expõe viewport fixo de 1363 × 936 e não aceita os atalhos de DevTools enviados pela automação.
- A criação de uma prévia mais recente pelo conector Vercel foi rejeitada na validação do campo `gitSource`, antes de iniciar um deploy.

Para conferência local, clone o repositório, execute `npm ci`, depois `npm run dev` e abra o endereço que o Vite imprimir. O teste mobile deve cobrir pelo menos 390 px e 320 px, além de desktop, antes de remover esta pendência.
