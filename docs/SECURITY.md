# Segurança e privacidade

## Primeira fase

O construtor funciona no navegador e salva o rascunho localmente. Não há conta, API própria, analytics, envio de arquivo a um servidor ou sala de batalha. Arquivos importados são tratados como JSON com limite de 128 KB, versão e campos validados; o conteúdo nunca é executado.

O importador baixa CSVs de uma revisão fixa da PokéAPI e produz dados locais ignorados pelo Git. Nenhum segredo é necessário. Um erro de download precisa informar a fonte e permitir nova tentativa.

## Fase comunitária

Antes de criar contas e eventos, definir autenticação por sessão segura, autorização por recurso no servidor, rate limit, retenção e exclusão de dados. Códigos privados de partida nunca entram em URL, analytics ou log. Upload de comprovante, se aprovado, exige limite de tamanho, retenção curta e moderação.
