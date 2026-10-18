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
- Uma segunda consulta ao conector Vercel para obter uma prévia da branch retornou `403 Forbidden`; o comando `vercel` não está instalado. Nenhum deploy foi iniciado.
- A prévia local do Vite iniciou em `localhost:5173`, mas o Chrome remoto não alcança o loopback do ambiente (`ERR_CONNECTION_REFUSED`).

Para conferir a branch localmente, use `git clone https://github.com/Shiroz1n/spinda-stop.git`, entre na pasta, execute `git fetch origin feat/calculator-validated-scenarios`, `git switch --track origin/feat/calculator-validated-scenarios`, `npm ci` e `npm run dev`; abra o endereço impresso pelo Vite. No DevTools do navegador, escolha 390 px e 320 px para validar o mobile. A inspeção permanece parcial até que esses fluxos e a comparação sejam vistos em uma viewport estreita.
