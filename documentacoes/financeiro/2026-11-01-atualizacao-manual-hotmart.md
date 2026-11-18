# Atualizacao manual das vendas e Client Token da Hotmart

Data: 2026-11-01, America/Sao_Paulo. Dominio: financeiro. Autor: Codex.
Solicitacao: integrar o Client Token preenchido pelo usuario, adicionar botao de atualizacao
imediata e conferir endpoints com a documentacao oficial da Hotmart.
Branch: developer. HEAD inicial: 8129a391f0f88f6d77704eb41b7cd89a2fc19379.
Base remota (merge-base origin/main): 54a9aa78812e7772493b9fa5721a2e0a268bfb33.
Estado: implementado, validado com dados simulados e, na continuacao operacional abaixo, com a Hotmart real e banco local.

## Contexto, escopo e resultado

A arvore inicial ja continha o painel de vendas e a entrega de .env, sem commits.
Essas alteracoes foram preservadas. O snapshot desta continuacao esta separado e o patch
abaixo inclui apenas a continuacao. O .env real foi preservado na implementacao inicial;
na correcao operacional registrada ao fim, somente a senha do banco foi alinhada, sem expor valores.

O botao **Atualizar agora** dispara a sincronizacao imediatamente, mostra espera, impede novo
envio durante a requisicao e renova os dados da pagina ao terminar, preservando filtros.
Mensagens fixas distinguem sucesso, resultado parcial, falha, outra execucao em andamento
e integracao desabilitada. Nao e streaming continuo nem altera a rotina de 30 minutos.
Fora de escopo: publicar servicos, alterar banco ou credenciais reais, adicionar dependencias,
autenticacao por papel e mudar URLs externas para variaveis de ambiente.

## Conferencia com a documentacao oficial

| Uso | Metodo e endereco | Resultado |
| --- | --- | --- |
| OAuth2 | POST https://api-sec-vlc.hotmart.com/security/oauth/token | Endereco correto; incluidos client_id e client_secret na query com grant_type=client_credentials e Authorization Basic |
| Vendas em producao | GET https://developers.hotmart.com/payments/api/v1/sales/history | Caminho correto; Authorization Bearer do access_token, filtros start_date/end_date em ms UTC, transaction_status, max_results e page_token |
| Vendas em sandbox | GET https://sandbox.hotmart.com/payments/api/v1/sales/history | Mesmo caminho no host de testes, conforme regra oficial de substituicao da URL base |
| Painel web para API interna | VENDAS_API_URL=http://127.0.0.1:3001 | Correto para execucao no host; nao e o endereco externo da Hotmart |

Fontes consultadas em 2026-11-01: [autenticacao](https://developers.hotmart.com/docs/pt-BR/start/app-auth/),
[historico](https://developers.hotmart.com/docs/es/v1/sales/sales-history),
[sandbox](https://developers.hotmart.com/docs/pt-BR/start/sandbox/),
[paginacao](https://developers.hotmart.com/docs/en/start/pagination/) e
[changelog dos status](https://developers.hotmart.com/docs/pt-BR/changelog).
O sandbox foi conferido tambem no navegador, pois a extracao textual da pagina e limitada.

Corrigida a lista enviada em transaction_status: PRE_ORDER e PROCESSING_TRANSACTION incluidos,
DELAYED removido. Sao 17 status. A paginacao continua seguindo page_info.next_page_token.
Nao foi presumido que consultas documentadas comprovam a validade das credenciais reais.

## Alteracoes por arquivo

- packages/config/src/vendas.ts: le HOTMART_CLIENT_TOKEN ou HOTMART_CLIENT_TOKEN_FILE em
  Secret, exige ID/Secret junto ao token, rejeita conflito de fontes e token com whitespace
  interno; vendas.test.ts cobre esses cenarios sem vazar valores.
- apps/api/src/vendas/hotmart-client.ts: prioriza o token Basic fornecido, aceita o prefixo
  existente sem duplica-lo e preserva Base64(ID:Secret) como fallback. Autenticacao inclui
  os parametros documentados. Nao se registra a URL autenticada nos erros.
- apps/api/src/vendas/dominio.ts: status alinhados a documentacao.
- apps/api/src/vendas/vendas.controller.ts: POST /v1/vendas/sincronizacao/atualizar aguarda
  executar() e retorna o resultado sob o mesmo guard bearer; o POST anterior 202 permanece.
- hotmart-client.test.ts, sincronizacao.test.ts, vendas.http.test.ts e atualizacao.test.ts
  em apps/api/src/vendas/: regressao de token, URLs, status, autorizacao e espera da execucao.
- apps/web/lib/vendas-api.ts: POST privado ao novo endpoint, timeout de 180s e validacao
  da resposta. lib/vendas-atualizacao.ts converte resultados em mensagens fixas.
- apps/web/app/(app)/setores/financeiro/vendas/actions.ts: Server Action aguarda resultado
  e chama revalidatePath; _components/AtualizarVendas.tsx: formulario com useActionState,
  estado pendente e mensagens acessiveis; page.tsx: inclui botao no cabecalho.
- apps/web/app/vendas-atualizacao.test.ts: testa POST privado, resultados e erros, sem rede.
- .env.example e README.md: explicam Client Token e a URL interna; nenhum endpoint externo
  foi levado ao .env real e nenhuma credencial do usuario foi alterada.

Documentos atualizados: entrega original do painel nesta pasta, entrega de .env em
documentacoes/transversal, README.md, este registro e seu patch. Material didatico:
[lesson 16](../../lessons/16%20-%20Sincronizacao%20idempotente%20com%20API%20externa.md),
[lesson 17](../../lessons/17%20-%20Painel%20de%20dados%20com%20Server%20Components%20no%20Next.js.md)
e [indice](../../lessons/README.md). Nenhuma migracao ou dependencia nova.

## Decisoes, riscos e compatibilidade

Escolhido endpoint que aguarda o resultado em vez de interpretar um 202 como sucesso: a
revalidacao ocorre apos a gravacao. O lock de sincronizacao existente protege a concorrencia
com o agendador; ocupada e um resultado explicito e nao inicia uma segunda rodada.
O token externo continua no servidor; o navegador recebe somente mensagens e dados do painel.
O timeout web nao cancela a sincronizacao na API: se ocorrer, o operador deve observar o estado
antes de tentar novamente. Este botao respeita a janela incremental/reconciliacao existente,
nao baixa todo o historico de novo a cada clique.

O painel ainda nao possui login real/autorizacao por papel. A action herda essa limitacao:
o backend exige o bearer de servico e o ambiente deve permanecer local, conforme escopo atual.
Nao se adicionou uma sessao ficticia. Erros do cliente Hotmart continuam fixos, sem corpo
externo ou URL; isso importa porque os parametros OAuth2 documentados contem credenciais.
Logs de sincronizacao e estado persistido permanecem os pontos de observacao.

Rollback: remover o botao/Server Action/novo endpoint usando apenas o patch desta continuacao.
Para voltar ao Basic derivado, retirar HOTMART_CLIENT_TOKEN e *_FILE e reiniciar a API.
Nao e necessario desfazer banco; nao reverter os arquivos anteriores de vendas inteiros.

## Validacao

- pnpm --filter @nucleos/config build e pnpm --filter @nucleos/api build: passaram.
- pnpm --filter @nucleos/web lint e pnpm --filter @nucleos/web build: passaram.
- node --test packages/config/dist/vendas.test.js: 5 testes passaram.
- node --test apps/api/dist/banco.test.js 'apps/api/dist/vendas/*.test.js': 32 testes passaram.
- pnpm --filter @nucleos/web test: 25 testes passaram.
- ESLint dos arquivos TS alterados: sem erros, 3 warnings de seguranca preexistentes
  (caminho de arquivo, indexacao de consulta e heuristica de timing).
- Prettier --check nos arquivos TS/TSX alterados: passou.
- node infrastructure/docker/scripts/verificar-deploy.mjs: passou.
- dependency-cruiser: passou, sem violacoes (134 modulos e 272 dependencias).
- bash scripts/check-no-env.sh: passou; .env real ignorado e nenhum .env versionado.
- Navegador Chrome com Next.js em 127.0.0.1:39600 e API simulada em 127.0.0.1:39601:
  clique real no botao exibiu Atualizando vendas com disabled; apos 15 segundos houve mensagem
  de sucesso, receita simulada de R$ 0 para R$ 100, uma venda, grafico renovado e filtros
  de/ate preservados na URL. Registro do servidor confirmou uma unica atualizacao. Somente
  dados ficticios e chave de teste, sem banco ou chamada externa. Aba de teste encerrada.
- Links relativos dos documentos e lessons conferidos; snapshot e diff exclusivos revisados.
- O loader validou o .env real e confirmou presenca de ID/Secret, Client Token e chave de
  vendas, imprimindo somente booleanos. Isso nao comprova autenticacao na Hotmart.
- Testes usam fetch/pool/repositorio falsos e HTTP local; nao acessam banco ou Hotmart real.
  Seguiu-se a restricao de servicos reais do AGENTS.md. Python: NA, sem alteracao nesta entrega.
- make setup nao repetido (sem dependencias novas); make lint/test completos nao repetidos
  devido aos bloqueios de PATH Windows, leitura POSIX e artefatos dist antigos documentados
  na entrega de .env. Foram usados os checks pertinentes diretamente.

## Commits, diffs e pendencias

Nenhum commit criado nesta tarefa. Nenhum diff staged desta continuacao.
[Patch unstaged desta continuacao](2026-11-01-atualizacao-manual-hotmart-diffs.md), comparado
com o snapshot anterior a integrar o token e o botao, incluindo arquivos novos.

Pendencias: login/autorizacao por papel continuam na frente original. Credenciais e sincronizacao real validadas na continuacao operacional abaixo. Nenhum deploy,
push, PR ou commit foi realizado. O acesso real ocorreu somente na continuacao abaixo.

## Continuacao operacional: painel sem dados (2026-11-01)

O usuario iniciou a API no terminal e reportou a indisponibilidade do painel. Nesta etapa
foi diagnosticado o runtime real, preservando todos os diffs anteriores na branch developer,
HEAD 8129a391f0f88f6d77704eb41b7cd89a2fc19379. Nenhum commit criado nesta tarefa.

Causas encontradas:

- Na primeira verificacao, a API em 3001 estava parada e o web estava sem a configuracao
  nova. O web foi reiniciado com .env da raiz, passando a apontar para o backend local.
- Apos o usuario iniciar a API, /healthz respondia 200, mas as rotas de vendas retornavam
  500. A conexao direta de diagnostico retornou 28P01 (autenticacao PostgreSQL recusada).
- DATABASE_PASSWORD do .env nao correspondia a credencial do container que ja atendia
  a porta 15432. O arquivo de credenciais de desenvolvimento nao era uma fonte confiavel
  para um volume/container previamente criado por outra execucao.

Correcao: a credencial do container existente foi capturada somente em memoria e validada
por SELECT 1 no banco local. Apenas DATABASE_PASSWORD foi alinhada no .env, sem alterar a
senha do Postgres, sem copiar valores para log ou documento e sem reinicializar o volume.
A API deste checkout foi reiniciada para carregar o valor corrigido; web em 3000, API em
3001 e Postgres em 15432 permanecem locais. A sincronizacao automatica da subida consultou
a Hotmart e concluiu com sucesso, processando 81 registros. O backend manteve a rotina
de 30 minutos. Credenciais e tokens nao foram exibidos.

Validacoes reais, em ordem de conclusao:

- node .run/diagnostico-vendas.mjs: config valida, /healthz 200; antes da correcao, rotas
  de vendas 500 e banco 28P01; depois, /v1/vendas/sincronizacao e /v1/vendas/painel 200,
  sincronizacao habilitada com status sucesso e mensagem null, indicadores com vendas.
- Consulta de catalogo: financeiro.vendas e financeiro.sincronizacao_estado existem.
- Log filtrado da API: sincronizacao sucesso (81 registros), sem valores de credenciais.
- node .run/verify-live-web.mjs: pagina do painel 200, indicadores e botao presentes,
  mensagem de indisponibilidade ausente. Nenhum HTML com dados reais foi impresso no log.
- A extensao do navegador estava indisponivel na ultima conferencia; a pagina real foi
  validada por sua resposta HTTP renderizada. O teste visual simulado anterior permanece.
- Conferidos Git status/diff e links dos documentos. Builds e testes de codigo nao foram
  repetidos: nao houve mudanca em fonte, schema ou dependencias nesta continuacao.

Arquivos desta continuacao: .env local (um campo de senha, ignorado e nao versionado),
este registro, lesson 12 e lessons/README.md. Scripts de diagnostico e lancamento em .run/
sao auxiliares locais ignorados, sem credenciais literais; nao integram a distribuicao.
Nao ha diff staged/unstaged de codigo ou configuracao versionada nesta continuacao.
O valor sensivel alterado em .env nao foi persistido em um patch; nao se inventou diff
de um arquivo ignorado. O patch anterior desta entrega permanece inalterado.

Modelo operacional: iniciar os dois processos do mesmo sistema e necessario; 3001 e o
endereco interno do backend, nao abertura de firewall. Reiniciar o backend carrega o .env
novo; alterar o .env nao altera automaticamente a senha que ja existe no banco.
Rollback desta correcao exigiria restituir a credencial anterior do operador; ela nao foi
guardada em uma copia adicional. Nao ha rollback de schema/dados porque nao houve migracao,
exclusao ou alteracao de credencial no banco. Em caso de nova rotacao, alinhar consumidor
e banco e reiniciar a API; nunca destruir o volume para corrigir uma senha divergente.

Sem pendencias conhecidas para a conexao e o carregamento do painel. A autorizacao por
papel continua pendente no produto conforme a frente original.
