# Importação Meta Ads somente leitura — FIN-301

Data: 2026-11-03, America/Sao_Paulo. Domínio: financeiro/marketing.
Branch: `feat/lote-1102-m-meta-ads`; base: `a1a0b0e`.
Autor: Codex, retomando arquivos parciais preservados da sessão anterior.
Estado: implementação candidata; revisão independente, PostgreSQL e aceite manual pendentes.

## Objetivo e escopo

Disponibilizar a tarefa `marketing.importar_meta_ads` ao Gestor de Tráfego,
com catálogo, custos diários e métricas reportadas pela Meta no schema `marketing`.
Segue FIN-301 da especificação aprovada do lote de 2026-11-02, sem escrita em
campanhas, otimização, novo banco de aplicação, dependência nova ou ativação externa.
Os arquivos parciais já existiam na retomada; não havia commit da frente M.

## Comportamento e decisões

- Cliente `fetch` injetável, Graph API `v26.0`, GET de campanhas e insights diários.
  Janela móvel de sete dias inclusive hoje em `America/Sao_Paulo`; cron `0 */6 * * *`.
- `META_ADS_ACCESS_TOKEN` ou `_FILE`, encapsulado em `Secret`, e
  `META_ADS_ACCOUNT_ID` no servidor. Sem o par completo, o handler não é registrado,
  a tarefa fica `INDISPONIVEL` e a descrição orienta a configuração.
  Estados `PAUSADO`/`DESATIVADO` do funcionário são preservados.
- Paginação usa somente cursor validado e rota fixa, com limite de páginas/itens,
  timeout, abort e rejeição de redirecionamentos. Nunca visita `paging.next`.
  Token em cabeçalho e erros fixos, sem corpo externo/URL/credenciais.
- Centavos em strings e `BigInt`, arredondamento half-up; somente BRL, sem FX implícito.
  Compras sobrepostas usam prioridade omni → purchase → pixel, sem soma, registrando
  `tipo_compra_meta`. Métricas da Meta não são tratadas como receita contábil.
- Persistência transacional, upsert por conta/campanha e campanha/dia, advisory lock
  por conta e verificação da lease antes/depois das gravações. Falha desfaz o lote.
- `GET /v1/marketing/campanhas` e `GET /v1/marketing/gastos?de=YYYY-MM-DD&ate=YYYY-MM-DD`
  exigem `VENDAS_API_KEY`. Valores e IDs mantêm precisão como strings.
- `marketing.aplicar_otimizacao` continua indisponível e sem atribuição.

## Arquivos

- `apps/api/migrations/0020_marketing_meta_ads.up.sql`: schema, três tabelas, índices e constraints.
- `0021_marketing_funcionario.up.sql`: catálogo indisponível até ter credencial,
  atribuição única e cron de seis horas. Migrations 0001–0006 permanecem intactas.
- `apps/api/src/marketing/{meta-client,repositorio-pg,marketing.module,marketing.controller}.ts`:
  integração de leitura, motor, persistência e API autenticada.
- `meta-client.test.ts`, `marketing-pg.test.ts`: respostas simuladas e cenários PG/HTTP.
- `packages/config/src/{marketing,marketing.test}.ts`, `index.ts`: configuração e testes.
- `apps/api/src/main.ts`, `.env.example`: composição e nomes de variáveis sem valores reais.
- Mapa do [banco único](../dados/banco-unico-nucleos.md),
  [lesson 16](../../lessons/16%20-%20Sincronizacao%20idempotente%20com%20API%20externa.md)
  e índice didático atualizados; nenhum conceito duplicado em lesson nova.

## Fontes oficiais

Conferidas em 2026-11-03: o [SDK oficial Meta, apiconfig.py](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py)
declara API v26.0; o [AdAccount oficial](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py)
contém a operação GET de insights. A implementação usa HTTP diretamente, sem instalar o SDK.

## Verificações reais

- `pnpm run build`: PASS, sete tarefas TS (inclui Next.js).
- `pnpm --filter @nucleos/api run build`: PASS após ajustes dos testes da retomada.
- `node --test apps/api/dist/marketing/meta-client.test.js packages/config/dist/marketing.test.js`:
  PASS, sete testes, sem rede autenticada.
- `make build`: PASS, TypeScript/Next.js e distribuição dos pacotes Python.
- `make lint` final: FAIL na formatação preexistente de `NavLink.tsx` e `layout.tsx`,
  arquivos que esta frente não altera. Tipos, ESLint geral (0 erros, 61 avisos) e
  arquitetura passaram antes dessa falha; etapas Python posteriores não executaram.
  A primeira tentativa havia encontrado erros de tipagem no parcial M, corrigidos.
- ESLint focal final: PASS, zero erros e três avisos heurísticos no cliente
  (tabela fixa de mensagens e regexes de decimais limitados a poucos caracteres).
- Prettier focal: PASS. `git diff --cached --check`: PASS.
- `make test`: FAIL em seis testes preexistentes de `packages/config`, com caminhos
  e permissões de arquivos Unix no Windows; não representa aprovação da suíte geral.
- `lerMigracoes` sobre os oito arquivos presentes nesta worktree: PASS, validação
  sem conexão com banco. Migrations 0020/0021 têm bytes LF; aplicação SQL não validada.
- Gitleaks 8.30.1 no diff staged de código/configuração: PASS, nenhuma detecção.
- Links relativos nos cinco documentos alterados: 41 conferidos, nenhum ausente.
  Logs locais ignorados em `.run/meta-*.log`.
- PostgreSQL nesta retomada: NÃO EXECUTADO. O harness existente cria banco temporário no
  servidor core. O plano e a seção Testes do documento de banco único admitem bancos
  temporários de teste, distintos de bancos de funcionalidade; porém AGENTS §Dados exige
  ambiente isolado declarado naquela seção e só declara containers descartáveis de PoC.
  O uso do core para esses bancos temporários aguarda resposta do usuário ao coordenador.
  Não foi acessado nem migrado `nucleos_dev`.
  Resultados de logs antigos não são atribuídos à presente retomada.
- Testes PG escritos cobrem migrations/reaplicação, ausência de credencial/execução,
  pausa preservada, catálogo, upsert, rollback por lease, moeda, handler pelo motor,
  HTTP autenticado e leitura precisa. Escritos/compilados não significa executados.
- Instrumentação Node legada não utilizada neste fluxo avulso; tokens/duração por skill desconhecidos.

## Aceites e pendências

Cliente, configuração, registro de handler, migrations e API: ATENDIDOS em código e
testes unitários aplicáveis. Idempotência e rollback reais PG/HTTP: NÃO VALIDADOS nesta
retomada. Ativação com Meta real: NÃO VALIDADA, depende das credenciais de leitura.
Revisão independente e roteiro manual M: PENDENTES.

Roteiro manual: sem token, conferir mensagem no catálogo de Funcionários; com token de
System User `ads_read` no servidor, habilitar Gestor de Tráfego, executar a tarefa e
consultar campanhas/gastos. Não ativar otimizações. Conferir pause/reinício e temas em
~400 px. O front de rentabilidade pertence à frente D, fora desta entrega.

## Riscos, compatibilidade e rollback

Integração exige resolver `main.ts`, catálogo e mapa/índice com a frente B antes de
aplicar migrations em ordem numérica na integração. Nenhuma migration de aplicação
foi aplicada nesta retomada. Dados Meta podem ser revistos pelo fornecedor; a janela
de sete dias limita correções automáticas tardias. Não há conversão cambial.
Rollback operacional: remover o token e pausar a tarefa; tabelas podem permanecer.
Migrations são forward-only; não apagar schema nem editar migration já aplicada.

## Commits e diffs próprios

Commit de implementação: `4690f1c8a2982fbceb0d6ea7e94adb90c6703de3`,
`feat(marketing): importar metricas Meta Ads somente leitura`.
O fechamento documental posterior registra esse SHA e remove uma linha vazia terminal
do arquivo de patch. O [patch completo](2026-11-03-importacao-meta-ads-diffs.md) contém apenas
código, testes e configuração desta frente, excluindo documentação/lessons para evitar recursão.
