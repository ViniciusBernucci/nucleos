# Especificação — Lote 2026-11-02: Financeiro completo + Funcionários Virtuais

Especificação canônica do lote. O manifesto ([lote-2026-11-02-financeiro-funcionarios.md](lote-2026-11-02-financeiro-funcionarios.md))
traz ordem, frentes e status; os prompts ([…-prompts.md](lote-2026-11-02-financeiro-funcionarios-prompts.md))
apenas apontam para cá. Em conflito, vale este arquivo, depois as fontes originais:

- Backlog financeiro: [02_11_26.md](../backlog/00-BACKLOG%20MANUAL/02_11_26.md) (etapas 1–10).
- Funcionários: [prompt_implementacao_funcionarios.md](../backlog/00-BACKLOG%20MANUAL/prompt_implementacao_funcionarios.md)
  (seções citadas como `PF §N`).
- Estado atual: [painel de vendas](../financeiro/2026-11-01-painel-de-vendas-hotmart.md),
  [atualização manual Hotmart](../financeiro/2026-11-01-atualizacao-manual-hotmart.md),
  [fluxo de caixa](../financeiro/2026-11-02-fluxo-de-caixa.md), [banco único](../dados/banco-unico-nucleos.md),
  ADR-021 (fila durável em Postgres), ADR-007/005 (IA via gateway Python), ADR-012 (deny-by-default),
  ADR-015 (custos por agente), ADR-023 (object storage).

---

## 1. Decisões do planejamento

| # | Decisão | Origem |
| --- | --- | --- |
| D1 | O módulo de Funcionários Virtuais (PF inteiro) entra neste lote, **antes** das rotinas financeiras; toda rotina nova nasce como handler registrado no motor de Funcionários. | Usuário |
| D2 | Webhook Hotmart: receptor implementado e testado com payloads simulados; ativação real pendente de URL pública. Polling de 30 min + reconciliação continuam sendo a fonte garantida. | Usuário |
| D3 | Etapa 9 (Fiscal/notas) **fora do lote**. O catálogo mantém `fiscal.*` como `PLANNED`; o funcionário "Assistente Fiscal" existe em `DRAFT`. O item "Notas Fiscais" do menu não é criado. | Usuário |
| D4 | Marketing: somente **Meta Ads**, somente **leitura** (gastos/métricas). Google Ads fica `PLANNED`; `marketing.aplicar_otimizacao` fica `UNAVAILABLE`. | Usuário |
| D5 | CFO Virtual usa **Claude** via `services/ai-gateway` (Python), com ferramentas somente leitura sobre agregados calculados pela API. Sem dados pessoais no contexto. | Usuário |
| D6 | Autorização: **chave de serviço + administrador único implícito** (só o servidor Next chama a API). `required_permissions` é gravado e checado por um `Autorizador` que hoje concede tudo ao admin; ligar ao login real é pendência. Uso apenas local. | Usuário |
| D7 | Banco único `nucleos_dev`; schemas novos `organizacao`, `funcionarios`, `marketing`; o restante em `financeiro`. Nomes de tabelas/colunas em **português**, como nas migrations existentes (o PF usa nomes em inglês apenas como conceito). | CLAUDE.md + convenção do repo |
| D8 | Fila/agendador do motor segue **ADR-021**: Postgres como fonte de verdade, reivindicação com `FOR UPDATE SKIP LOCKED`, lease + fencing por `tentativa`, relógio do banco. Sem Redis/BullMQ, sem infraestrutura nova. | ADR-021 |
| D9 | Valores sempre em centavos (`bigint`); moeda explícita em vendas; demais tabelas em BRL. Datas de negócio no fuso `America/Sao_Paulo`. | Convenção existente |
| D10 | DRE em regime de **competência** (data de aprovação da venda; competência da despesa). Fluxo de caixa em regime de **caixa** (data do movimento). Gastos de anúncio entram na DRE pela tabela `marketing.gastos_diarios`; o pagamento da fatura de mídia entra só no caixa (categoria marcada `excluir_da_dre`), evitando dupla contagem. | Planejamento (hipótese segura, revisável) |
| D11 | O sistema **não inventa** saldo disponível na Hotmart: "disponível para saque" é informado pelo usuário com origem/data; "a receber" é estimativa por regra de prazo configurável, sempre rotulada como estimativa. | Backlog etapa 3 |
| D12 | "Atualizar totais por categoria" não vira job: é consulta indexada. Indicadores mensais são materializados por `financeiro.atualizar_indicadores` para dashboard e CFO. | Planejamento |
| D13 | Funcionário financeiro da rotina de 30 min: nome inicial **"Analista de Atualizações Financeiras"** (critério PF §20), com descrição citando o alias "Sincronizador Financeiro" do backlog. Editável. | Planejamento (hipótese) |
| D14 | CFO Virtual fica no setor **Diretoria** (PF §6, tarefa `diretoria.analisar_financas`) e é exibido também na página Financeiro → "Funcionários e CFO". | PF + backlog |
| D15 | "Orçamentos e Metas" do menu proposto não tem requisitos no backlog: **fora do lote**. | Planejamento |

Dependências novas (exigem autorização explícita no início da execução; sem ela, o ticket fica BLOQUEADO):

| Pacote | Onde | Ticket | Alternativa sem dependência |
| --- | --- | --- | --- |
| `cron-parser` (versão exata) | `apps/api` | FUN-002 | Parser próprio limitado a 5 campos (mais código e testes) |
| `@aws-sdk/client-s3` (versão exata) | `apps/api` | FIN-104 (anexos) | Anexos em `bytea` no Postgres, limite 5 MB |
| `anthropic` (Python) | `services/ai-gateway` | FIN-303 | Nenhuma razoável (BLOQUEADO) |
| `ajv` | já existe em `packages/contracts` (8.20.0) | FUN-004 | — reutilizar |

Credenciais novas (no `.env`, nunca em código/log/doc): `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID`,
`HOTMART_WEBHOOK_HOTTOK`, `ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY` (serviço→serviço),
`MINIO_*` (se FIN-104 usar MinIO). Seguir o padrão atual de `packages/config` (variável ou `*_FILE`).

---

## 2. Modelo de dados (visão geral)

```
organizacao.setores ─┬─< funcionarios.funcionarios ─< funcionarios.atribuicoes >─ funcionarios.definicoes_tarefa
                     │                                        │
                     └─< funcionarios.definicoes_tarefa       ├─< funcionarios.agendamentos
                                                              └─< funcionarios.execucoes ─< funcionarios.fila (ADR-021)
funcionarios.eventos (outbox de eventos internos/externos, idempotente por chave)

financeiro.vendas ─< financeiro.vendas_eventos (histórico de status)   financeiro.vendas_comissoes
financeiro.webhooks_hotmart (recebimentos brutos mínimos, sem PII)
financeiro.alertas
financeiro.fornecedores, financeiro.centros_custo, financeiro.contas_pagar (parcelas), financeiro.anexos
financeiro.contas_financeiras ─< financeiro.lancamentos (+conta_financeira_id, +centro_custo_id, +conta_pagar_id)
financeiro.saques_hotmart, financeiro.saldos_informados, financeiro.regras_liberacao
financeiro.extratos_importados ─< financeiro.extrato_itens
financeiro.conciliacoes ─< financeiro.conciliacao_itens
financeiro.indicadores_mensais, financeiro.linhas_dre (+ categorias.linha_dre)
financeiro.cenarios_caixa
marketing.contas_anuncio, marketing.campanhas, marketing.gastos_diarios
financeiro.analises_cfo
```

Reserva de numeração de migrations (evita colisão entre frentes):

| Faixa | Ticket |
| --- | --- |
| 0004–0006 | FUN-001 (setores, funcionários, catálogo, agendamentos, execuções, fila, eventos, seeds) |
| 0007 | FIN-103 alertas |
| 0008–0009 | FIN-101 vendas (comissões, eventos, tracking, oferta) |
| 0010 | FIN-102 webhooks |
| 0011–0012 | FIN-104 despesas/contas a pagar |
| 0013–0014 | FIN-105 contas financeiras/movimentações |
| 0015 | FIN-106 conciliação |
| 0016 | FIN-201 indicadores |
| 0017 | FIN-202 cenários |
| 0018 | FIN-203 DRE |
| 0019 | FIN-204 anomalias |
| 0020–0021 | FIN-301 marketing (frente paralela) |
| 0022 | FIN-303 análises CFO |

Regra: nenhuma migration nova é aplicada ao `nucleos_dev` antes de integrada em `revisao/…`, e sempre em
ordem numérica. Se o runner recusar aplicação fora de ordem, renumerar na integração (nunca editar migration
já aplicada).

---

## 3. Tickets — Onda A: Funcionários Virtuais

### FUN-001 — Modelo de dados, seeds e catálogo

- **Objetivo:** persistir Setor → Funcionário → Definição de Tarefa → Atribuição → Agendamento → Execução (PF §4–5).
- **Escopo:** migrations 0004–0006; `organizacao.setores` (código, nome, descrição, ativo, ordem);
  `funcionarios.funcionarios` (setor, nome único por setor, slug, descrição, tipo `DETERMINISTICO|AGENTE_IA|HIBRIDO`,
  status `RASCUNHO|ATIVO|PAUSADO|DESATIVADO`, perfil_ia opcional, avatar); `definicoes_tarefa` (código único,
  setor, tipo `DETERMINISTICO|TAREFA_IA|AGENTE_IA|HIBRIDO`, `handler_key`, `config_schema` jsonb,
  `config_padrao`, `gatilhos_suportados`, `permissoes_requeridas`, `nivel_risco`,
  `status_implementacao` `DISPONIVEL|PLANEJADA|INDISPONIVEL`, ativo); `atribuicoes` (único por
  funcionário+definição, config validada, habilitada, prioridade); `agendamentos` (gatilho
  `MANUAL|UNICO|INTERVALO|CRON|EVENTO`, intervalo_min, cron, tipo_evento, filtro_evento, fuso, início/fim,
  proxima_em, ultima_em, habilitado, politica_sobreposicao `PULAR|ENFILEIRAR|CANCELAR_ANTERIOR`,
  politica_retentativa jsonb, `versao`); `execucoes` (PF §5.6, com `chave_idempotencia` única,
  `correlacao`, `config_snapshot` sem segredos); `fila` (ADR-021: estado, executar_em, tentativa,
  lease_ate, lease_dono, payload); `eventos` (tipo, chave única de idempotência, payload sem PII,
  recebido_em, processado_em); `auditoria` (quem, quando, entidade, antes/depois sem segredos).
- **Seeds idempotentes** (PF §6–7, §14): 6 setores; catálogo completo do PF §7 **mais** os códigos
  financeiros deste lote (tabela abaixo); funcionários iniciais em `RASCUNHO`, exceto o Analista de
  Atualizações Financeiras; atribuições só onde houver executor real.
- **Critérios:** reaplicar seed não duplica (teste); checks de integridade (agendamento CRON exige cron,
  INTERVALO exige intervalo ≥ 1 min etc.); `DISPONIVEL` só para handlers registrados (o seed lê o
  registro de handlers ou o teste FUN-002 verifica consistência catálogo↔registro).
- **Fora:** tenant_id/RLS (pendência do banco único).

Códigos adicionais do catálogo (todos `DETERMINISTICO`, setor Financeiro e Fiscal, salvo indicação):

| Código | Tarefa | Ticket que implementa | Gatilho inicial |
| --- | --- | --- | --- |
| `financeiro.atualizar_dados` | Atualizar dados financeiros (Hotmart) | FUN-003 | INTERVALO 30 min |
| `financeiro.reconciliar_hotmart` | Reconsultar janela longa na Hotmart | FIN-101 | CRON diário 03:00 |
| `financeiro.processar_evento_hotmart` | Aplicar evento de webhook | FIN-102 | EVENTO `hotmart.webhook.recebido` |
| `financeiro.gerar_recorrencias` | Gerar contas a pagar recorrentes e parcelas | FIN-104 | CRON diário 01:00 |
| `financeiro.verificar_vencimentos` | Verificar vencimentos e contas vencidas | FIN-104 | CRON diário 07:00 |
| `financeiro.atualizar_previsoes` | Atualizar valores a receber e previsões | FIN-105 | CRON diário + EVENTO `financeiro.venda.alterada` |
| `financeiro.alertar_recebimentos` | Alertar recebimentos atrasados | FIN-105 | CRON diário 08:00 |
| `financeiro.conciliar_vendas` | Conciliação financeira (PF) | FIN-106 | CRON diário + EVENTO `financeiro.extrato.importado` |
| `financeiro.atualizar_indicadores` | Atualizar indicadores (PF) | FIN-201 | EVENTO `financeiro.dados.alterados` + CRON diário |
| `financeiro.monitorar_caixa` | Monitorar caixa e insuficiência (PF) | FIN-202 | CRON diário |
| `financeiro.calcular_dre` | Calcular DRE gerencial (PF) | FIN-203 | CRON diário + EVENTO |
| `financeiro.detectar_anomalias` | Desvios por regras (PF) | FIN-204 | CRON diário |
| `marketing.importar_meta_ads` | Importar métricas do Meta Ads (PF) | FIN-301 | CRON a cada 6 h |
| `diretoria.analisar_financas` | Análise consultiva do CFO (PF, `AGENTE_IA`) | FIN-303 | MANUAL + CRON semanal + EVENTO `financeiro.anomalia.detectada` |

Funcionários do setor Financeiro e Fiscal (backlog §5, PF §6):

| Funcionário | Tipo | Atribuições | Estado inicial |
| --- | --- | --- | --- |
| Analista de Atualizações Financeiras | D | `atualizar_dados`, `reconciliar_hotmart`, `processar_evento_hotmart` | ATIVO (rotina real existente) |
| Gestor de Contas | D | `gerar_recorrencias`, `verificar_vencimentos` | RASCUNHO até FIN-104 |
| Conciliador Financeiro | D | `conciliar_vendas`, `atualizar_previsoes`, `alertar_recebimentos` | RASCUNHO até FIN-105/106 |
| Analista de Indicadores | D | `atualizar_indicadores`, `monitorar_caixa`, `calcular_dre`, `detectar_anomalias` | RASCUNHO até FIN-201 |
| Assistente Fiscal | D | `fiscal.*` (PLANEJADA) | RASCUNHO (fora do lote) |
| CFO Virtual (setor Diretoria) | IA | `diretoria.analisar_financas` | RASCUNHO até FIN-303 |

Cada ticket FIN que entrega um handler também: muda o `status_implementacao` para `DISPONIVEL` (migration de
dados idempotente), cria a atribuição e o agendamento padrão **desabilitado ou habilitado conforme a tabela
acima**, e ativa o funcionário quando todas as suas tarefas essenciais existirem.

### FUN-002 — Motor de execução (agendador + fila + handlers)

- **Objetivo:** PF §8 e §12 sobre ADR-021, dentro de `apps/api` (novo módulo `funcionarios/`).
- **Componentes:**
  - `RegistroHandlers`: mapa estático `handler_key → { validarConfig, executar(ctx) }`; o front nunca envia código.
  - `Planejador` (tick a cada 15 s, relógio injetável): para agendamentos habilitados com `proxima_em <= now()`
    do banco, insere na `fila` com chave `agendamento:{id}:v{versao}:{ocorrencia}` (`ON CONFLICT DO NOTHING`)
    e calcula a próxima ocorrência (INTERVALO, CRON com fuso, UNICO). Mudar agendamento incrementa `versao`;
    itens de fila de versão antiga são marcados `CANCELADA/SKIPPED` ao serem reivindicados.
  - `Consumidor`: reivindica com `SKIP LOCKED`, lease de 5 min com heartbeat, conclui com fencing
    `WHERE id=$1 AND tentativa=$2`; aplica `politica_sobreposicao` (por atribuição); retentativa com backoff
    exponencial e máximo configurável; grava `execucoes` (status PF §5.6, duração, resumo, erro sem segredo).
  - `Eventos`: `publicar(tipo, chave, payload)` grava em `funcionarios.eventos` (idempotente) e enfileira as
    atribuições com agendamento `EVENTO` cujo filtro casa; reprocessar o mesmo evento não duplica.
  - Execução manual: `executarAgora(atribuicao)` cria item com `origem=manual`.
  - Tipos `TAREFA_IA/AGENTE_IA/HIBRIDO`: o consumidor delega ao handler, que chama o ai-gateway (FIN-303);
    sem handler disponível, não executa.
- **Critérios (testes com relógio controlado, PF §15):** 30 min calcula próximas corretas; mudar para 60 min
  vale no próximo disparo; desabilitar impede novos disparos sem matar execução em curso; reinício recupera
  (`proxima_em` persistido); duas instâncias concorrentes não executam a mesma ocorrência (teste de
  integração PG com 2 consumidores); sobreposição e retentativa; evento repetido não duplica; tarefa
  `PLANEJADA` não pode ser agendada (400) nem executada.
- **Dependência:** `cron-parser` (autorizar) ou parser próprio.

### FUN-003 — Migrar a rotina de vendas para o motor

- **Objetivo:** existir **um único** mecanismo de disparo da sincronização Hotmart (PF §3, §15 "Integração financeira").
- **Escopo:** handler `financeiro.atualizar_dados` envolvendo `Sincronizacao.executar()` existente
  (sem reescrever a sincronização; o advisory lock atual continua); remover o uso de `Agendador` em
  `main.ts`/`vendas.module.ts` (o arquivo pode permanecer para testes ou ser removido);
  `HOTMART_SYNC_INTERVAL` passa a ser só o valor inicial do seed (documentar); `POST
  /v1/vendas/sincronizacao/atualizar` e o botão "Atualizar agora" passam a disparar `executarAgora` e
  aguardar a execução, mantendo a resposta atual (contrato do botão preservado) e gerando histórico;
  a reconciliação diária de 30 dias sai do `Sincronizacao` e vira `financeiro.reconciliar_hotmart`
  (pode ficar em FIN-101 se mais simples — decidir na execução, sem duplicar).
- **Critérios:** com API reiniciada, a sincronização roda pelo agendamento do banco; alterar para 60 min no
  painel altera o comportamento real; resultado aparece em Execuções; grep não encontra outro `setInterval`
  disparando vendas; testes atuais de `vendas/` continuam passando.

### FUN-004 — API REST de Funcionários

- **Rotas** (`/v1/funcionarios/...`, guard da chave de serviço + `Autorizador`): setores (listar, consultar);
  funcionários (listar com filtros/busca, criar, editar, detalhar, ativar/pausar/desativar); catálogo
  (listar/filtrar, consultar, criar rascunho `PLANEJADA` sem handler, editar metadados permitidos — nunca
  `handler_key` de tarefa existente); atribuições (vincular, configurar, habilitar, remover — mesmo setor por
  padrão); agendamentos (criar, editar, suspender, `GET .../proximas?n=5` e `POST /cron/previsualizar`);
  execuções (executar agora, histórico paginado com filtros, detalhe); `GET /v1/funcionarios/estado`
  (snapshot estruturado setores→funcionários→atividade atual/última/falhas, para o prédio 3D futuro — PF §7
  `tecnologia.registrar_atividades`, sem lógica duplicada).
- **Validação:** config da atribuição validada pelo `config_schema` com `ajv`; rejeitar campos com nomes de
  segredo (`token`, `secret`, `senha`, `key`) em config — credenciais só por referência.
- **Contratos:** tipos em `packages/contracts/src/funcionarios.ts`, exportados no `index.ts`.
- **Auditoria:** toda alteração administrativa grava `funcionarios.auditoria`.
- **Critérios:** testes HTTP (padrão `*.http.test.ts`) para cada recurso, incluindo 401 sem chave,
  atribuição de outro setor (400), config inválida (400), agendar tarefa `PLANEJADA` (409/400), credencial
  ausente dos registros de execução.

### FUN-005 — Web: menu, listagem, cadastro e catálogo

- Item **Funcionários** no menu lateral (`AppShell.tsx`); submenu gerado de `GET setores` (sem lista fixa).
- Páginas em `apps/web/app/(app)/funcionarios/`: Visão Geral (contagens, falhas recentes, próximas
  execuções), por setor (listagem PF §9: nome, setor, tipo, status, nº tarefas, última/próxima execução,
  falhas recentes; busca e filtros), cadastro/edição (PF §9), Catálogo (PF §11, distinguindo cadastrada,
  implementada, atribuída, habilitada).
- Padrões a seguir: Server Components + Server Actions como em `setores/financeiro/fluxo-de-caixa`,
  `PainelLateral` (off-canvas) para formulários, `lib/*-api.ts` lendo a chave no servidor.

### FUN-006 — Web: detalhes, configuração de tarefa e histórico

- Detalhe do funcionário com abas Visão geral / Tarefas / Agendamentos / Execuções / Configurações e ações
  reais (Editar, Pausar/Ativar, Atribuir, Configurar, Executar agora, Histórico).
- Painel de configuração de tarefa (PF §10): formulário gerado do `config_schema` (tipos simples: string,
  number, integer, boolean, enum; o resto como JSON validado), escolha de gatilho, intervalo+unidade, cron
  com validação e prévia das 5 próximas, evento só da lista registrada, fuso, início/fim, sobreposição,
  retentativa. Confirmação visual após salvar.
- Histórico de Execuções global com filtros (setor, funcionário, tarefa, status, período) e detalhe.
- **Aceite PF §20:** Funcionários → Financeiro e Fiscal → Analista de Atualizações Financeiras → Tarefas →
  Atualizar Dados Financeiros → Configurar Agendamento mostra 30 min, permite alterar, salvar, ver próxima
  execução e histórico.

---

## 4. Tickets — Onda B: base financeira confiável (etapas 1–4)

### FIN-103 — Alertas financeiros (infra comum)

- `financeiro.alertas`: tipo (`conta_vencendo`, `conta_vencida`, `divergencia_conciliacao`,
  `divergencia_hotmart`, `recebimento_atrasado`, `caixa_insuficiente`, `anomalia`, `campanha_ruim`),
  severidade, referência (tabela+id), mensagem fixa (sem PII), estado `aberto|resolvido|ignorado`,
  chave de deduplicação única enquanto aberto.
- API `GET /v1/financeiro/alertas`, `POST .../:id/resolver|ignorar`; componente web de lista de alertas
  reutilizável (dashboard e páginas).
- Publica evento `financeiro.alerta.criado`.

### FIN-101 — Receitas e vendas (etapa 1)

- **Dados:** ampliar `vendas` com `oferta_codigo`, `desconto_centavos`, `comissoes_centavos`,
  `liquido_centavos` (bruto − desconto? conforme Hotmart − taxa − comissões de coprodução/afiliado),
  `rastreio_origem`/`rastreio_sck` (para FIN-302), grupo `contestada` (chargeback/disputa — hoje caem em
  `reembolso`/`pendente`: revisar mapa de status em `vendas/dominio.ts`); `vendas_eventos` (status anterior →
  novo, quando, origem `polling|webhook|reconciliacao`); `vendas_comissoes` (tipo de participante, valor; sem
  nome/e-mail). Conferir na documentação oficial os endpoints `sales/commissions` e `sales/price/details`
  (registrar URLs e data da consulta).
- **Sincronização:** registrar evento quando o status muda; publicar `financeiro.venda.alterada`.
- **Reconciliação:** handler `financeiro.reconciliar_hotmart` (janela de 30 dias, diário) que compara
  contagem/somas por status e período com a Hotmart e gera alerta `divergencia_hotmart`.
- **Tela "Receitas e Vendas":** evoluir `/setores/financeiro/vendas`: filtros por período, produto, comprador
  (pseudônimo), status/grupo; colunas bruto, desconto, taxa, comissões, líquido, parcelas, moeda; detalhe da
  transação com histórico de mudanças; status separados (aprovada, pendente, cancelada, reembolsada,
  contestada). Importação histórica: ação manual "Importar histórico" com período (execução manual do
  handler com config `{inicio, fim}`), limitada e com progresso no histórico.
- **Critério (backlog):** para um período de teste, totais por status no sistema = totais da Hotmart
  (validação manual com dados reais; automatizada com fixtures).

### FIN-102 — Webhook Hotmart (D2)

- `POST /v1/webhooks/hotmart`, **fora** do guard de chave de serviço; valida `X-HOTMART-HOTTOK` em tempo
  constante contra `HOTMART_WEBHOOK_HOTTOK`; limite de corpo (64 KB); responde 200 rápido.
- Grava `financeiro.webhooks_hotmart` (id do evento, tipo, transação, recebido_em, hash do corpo; **sem**
  e-mail/nome — descartar campos pessoais antes de persistir) e publica `hotmart.webhook.recebido`
  (chave = id do evento ⇒ idempotente).
- Handler `financeiro.processar_evento_hotmart`: reconsulta a transação na API (não confia só no payload) e
  aplica pela mesma normalização da sincronização. Eventos: compra aprovada/completa/cancelada/reembolsada,
  chargeback, disputa, atrasada, expirada (conferir nomes na doc oficial e registrar).
- Testes com payloads simulados: hottok errado → 401 sem gravar; repetição não duplica; PII não persistida.
- Ativação real (cadastro da URL na Hotmart) é **pendência** até haver URL pública.

### FIN-104 — Despesas e contas a pagar (etapa 2)

- **Cadastros:** `fornecedores` (nome, documento opcional mascarado na UI, contato mínimo), `centros_custo`
  (nome, ativo); categorias existentes ganham `linha_dre` (FIN-203) e `excluir_da_dre`.
- **Contas a pagar:** `contas_pagar` (descrição, fornecedor, categoria, centro de custo, valor, vencimento,
  status `aberta|paga|cancelada`, parcela n/m, grupo de parcelamento, origem `manual|recorrente|importacao`,
  conta_recorrente_id + competência quando recorrente). Despesa parcelada gera N contas.
  `contas_recorrentes` existente vira o **modelo** da recorrência (ganha fornecedor, centro de custo e
  periodicidade `mensal|anual`); o handler `financeiro.gerar_recorrencias` materializa as competências
  futuras (horizonte de 3 meses, idempotente por `(conta_recorrente_id, competencia)`).
- **Compatibilidade com o fluxo de caixa atual:** pagar uma conta gera lançamento de saída com
  `conta_pagar_id`; migration de dados cria `contas_pagar` pagas para os pagamentos recorrentes já
  existentes (`lancamentos.conta_recorrente_id`), preservando valores e datas. A tela de fluxo de caixa
  continua funcionando (testes atuais devem passar ou ser atualizados explicando a mudança).
- **Anexos:** `financeiro.anexos` (metadados + chave no MinIO, tipo, tamanho, hash) — PDF/JPG/PNG até 10 MB;
  download só pelo servidor. Sem dependência autorizada: `bytea` ≤ 5 MB.
- **Importação de despesas:** CSV com layout documentado (data, descrição, valor, categoria, fornecedor,
  centro de custo, vencimento), pré-visualização com erros por linha, confirmação; idempotente por hash da
  linha.
- **Handlers:** `gerar_recorrencias`, `verificar_vencimentos` (alertas `conta_vencendo` D-3 e `conta_vencida`).
- **Tela "Contas a Pagar e Receber"** (aba Pagar): lista com filtros (status, vencimento, categoria,
  fornecedor, centro de custo), totais por categoria, ações pagar/cancelar/anexar, cadastros em off-canvas.

### FIN-105 — Contas a receber, contas financeiras e movimentações (etapa 3)

- `contas_financeiras` (nome, tipo `banco|caixa|plataforma`, ativa); conta padrão "Caixa principal" criada
  por migration e atribuída a todos os lançamentos existentes; conta "Hotmart" tipo `plataforma`.
- Lançamentos ganham `conta_financeira_id` (obrigatório) e `centro_custo_id`; transferência entre contas
  (par de lançamentos vinculados, fora de receitas/despesas).
- `saques_hotmart` (data, valor bruto, taxa, valor líquido, conta destino, comprovante) — registrado pelo
  usuário; gera saída da conta Hotmart e entrada (pendente de conciliação) na conta destino.
- `saldos_informados` (conta, data, valor, origem `usuario`) para "disponível para saque" (D11).
- `regras_liberacao` (forma de pagamento → dias para liberação), editável, padrão vazio = sem previsão.
- **Quatro visões** (aba Receber): Vendido, A receber (estimado, rotulado), Disponível para saque
  (informado, com data/origem), Recebido (conciliado). Contas a receber por origem (Hotmart, manual).
- **Importação de extrato:** OFX (parser próprio para os campos STMTTRN: DTPOSTED, TRNAMT, FITID, MEMO) e
  CSV; `extratos_importados`/`extrato_itens` idempotentes por `FITID`/hash; publica
  `financeiro.extrato.importado`.
- **Handlers:** `atualizar_previsoes`, `alertar_recebimentos` (previsto vencido sem conciliação).
- **Tela "Movimentações"**: entradas/saídas por conta, transferências, saques, importação de extrato,
  itens não conciliados.

### FIN-106 — Conciliação financeira (etapa 4)

- `conciliacoes` (estado `conciliada|parcial|pendente_analise`, diferença em centavos, observação, quem/
  quando) e `conciliacao_itens` (tipo: venda, saque, extrato_item, lancamento, conta_pagar; id; valor).
- Regras determinísticas (handler `financeiro.conciliar_vendas`): (a) saque Hotmart ↔ item de extrato de
  entrada na conta destino (valor líquido exato, data ±3 dias); (b) conta paga ↔ item de extrato de saída
  (valor exato, data ±3 dias); (c) vendas aprovadas ↔ saldo/saques da conta Hotmart por período (parcial
  quando somas divergem); (d) líquido calculado da venda ↔ bruto − taxas − comissões (consistência interna).
  Ambiguidade (mais de um candidato) ⇒ `pendente_analise`, nunca escolha silenciosa.
- Tela "Conciliação": pendências, sugestões com aceitar/recusar, conciliação manual, desfazer; divergências
  geram alerta `divergencia_conciliacao`.
- IA não participa nesta etapa (investigação de divergência fica para o CFO, sob demanda).

---

## 5. Tickets — Onda C: gestão (etapas 5–7)

### FIN-201 — Dashboard "Visão Geral" (etapa 5)

- `indicadores_mensais` (mês, produto opcional, centro de custo opcional: receita bruta, deduções, receita
  líquida, despesas, resultado gerencial, margem, taxas, reembolsos, nº vendas) recalculado por
  `financeiro.atualizar_indicadores` (evento `financeiro.dados.alterados`, publicado por vendas,
  lançamentos e contas, + diário).
- Rota `/setores/financeiro/visao-geral` (e o hub `/setores/financeiro` passa a mostrar o menu proposto do
  backlog, sem "Notas Fiscais" e "Orçamentos e Metas"): cards receita líquida, despesas, resultado, margem;
  gráfico mensal receitas × despesas (SVG + tabela acessível, como o painel de vendas); filtros período,
  produto, oferta, centro de custo; destaques: reembolsos, contas vencidas, divergências, alertas abertos.

### FIN-202 — Fluxo de caixa realizado e projetado (etapa 6)

- Evoluir `/setores/financeiro/fluxo-de-caixa`: agrupamento dia/semana/mês; filtro por conta financeira;
  saldo inicial/final por período; projeção com contas a pagar abertas (FIN-104) e recebimentos previstos
  (FIN-105).
- `cenarios_caixa` (conservador/base/otimista: % de realização dos recebimentos previstos, % de reembolso,
  variação de despesas) editáveis; projeção de 90 dias por cenário.
- Handler `financeiro.monitorar_caixa`: alerta `caixa_insuficiente` quando o saldo projetado (cenário
  conservador) fica negativo ou abaixo de um mínimo configurável na config da atribuição.

### FIN-203 — DRE gerencial e relatórios (etapa 7)

- `linhas_dre` (estrutura fixa: receita bruta; (−) deduções: reembolsos/chargebacks, impostos sobre venda;
  receita líquida; (−) custos variáveis: taxas da plataforma, comissões, mídia (marketing); margem de
  contribuição; (−) despesas fixas por grupo; resultado operacional); categorias mapeadas para linhas
  (tela de mapeamento; categoria sem linha aparece em "Não classificado").
- Handler `financeiro.calcular_dre` materializa por mês (competência, D10); comparativo mês a mês e com
  mês anterior; recorte por produto e centro de custo **só** quando a alocação existe (sem rateio inventado).
- Exportação CSV (UTF-8 com BOM, `;`) da DRE e dos relatórios de vendas/despesas. PDF fora do escopo.
- Texto explicativo na tela: diferença entre fluxo de caixa e DRE (backlog etapa 7).

### FIN-204 — Detecção de anomalias por regras

- Handler `financeiro.detectar_anomalias` (diário): despesa de categoria > média de 3 meses + 30%; margem
  caiu > 5 p.p. vs mês anterior; taxa de reembolso > limite; limites na config da atribuição.
- Gera alerta `anomalia` e publica `financeiro.anomalia.detectada` (gatilho opcional do CFO).

---

## 6. Tickets — Onda D: marketing e CFO (etapas 8 e 10)

### FIN-301 — Importação Meta Ads (frente paralela)

- Schema `marketing`: `contas_anuncio`, `campanhas` (id externo, nome, status, objetivo),
  `gastos_diarios` (campanha, dia, gasto_centavos, impressões, cliques, compras/valor reportados pela Meta),
  upsert idempotente por (campanha, dia).
- Handler `marketing.importar_meta_ads` (Marketing API, endpoint de *insights* por campanha e dia; conferir
  versão vigente da Graph API na documentação oficial e registrar), janela de 7 dias reimportada a cada
  execução; erros fixos sem token/URL nos logs; credenciais pelo `packages/config`.
- Funcionário "Gestor de Tráfego" (setor Marketing) recebe só esta tarefa; `aplicar_otimizacao` permanece
  `INDISPONIVEL` (D4).
- Testes com respostas simuladas (sem rede), incluindo paginação, 429 e token inválido.

### FIN-302 — Rentabilidade e marketing (etapa 8)

- Atribuição: venda ↔ campanha por `rastreio_sck/origem` (FIN-101) com regra documentada (ex.: `sck`
  contendo o id/nome da campanha); sem rastreio ⇒ "não atribuída" (nunca rateio inventado).
- Indicadores por campanha/produto/período: gasto, receita atribuída, ROAS, CAC (gasto ÷ novos compradores
  atribuídos), margem de contribuição após aquisição (receita líquida − taxas − comissões − reembolsos −
  gasto). Exibir aviso de que ROAS ≠ lucro.
- Tela "Investimentos em Marketing" com comparação de produtos/ofertas e lista de campanhas abaixo do limite
  (margem pós-aquisição negativa ou ROAS < configurado) ⇒ alerta `campanha_ruim`.

### FIN-303 — CFO Virtual (etapa 10)

- **ai-gateway (Python):** endpoint autenticado por `AI_GATEWAY_API_KEY` (`POST /v1/agentes/executar`),
  modelo configurável (padrão um modelo Claude atual, ex. `claude-sonnet-5-5`; permitir `claude-opus-5-5`),
  laço de ferramentas com limite de passos, tokens e custo por execução (ADR-015), registro de uso
  (tokens/custo estimado) sem conteúdo sensível.
- **Ferramentas somente leitura** (chamadas do gateway à API com chave de serviço própria, ADR-018):
  `indicadores_mensais`, `dre`, `fluxo_projetado`, `despesas_por_categoria`, `rentabilidade_campanhas`,
  `alertas_abertos`. Nada de dados pessoais nem escrita. Lista fechada por funcionário (ADR-012); o agente
  não altera os próprios limites.
- **Handler `diretoria.analisar_financas`** (`AGENTE_IA`): monta pedido com a competência escolhida
  (diagnóstico, planejamento, controle de despesas, rentabilidade, recomendações — backlog §10) e período;
  grava `financeiro.analises_cfo` (pergunta, resposta em Markdown, ferramentas usadas, uso) e o resumo na
  execução.
- **Tela "Funcionários e CFO"** (Financeiro): lista dos funcionários do setor com estado (via API de
  Funcionários) e área do CFO: perguntar (com as 5 competências como atalhos), ver análises anteriores,
  configurar análise periódica e gatilho por anomalia (atalho para o painel de Funcionários).
- **Critérios:** sem `ANTHROPIC_API_KEY` o funcionário fica `RASCUNHO`/tarefa indisponível e a tela explica;
  testes do gateway com cliente Claude simulado (sem rede); teste de que ferramentas rejeitam escrita e
  que nenhum campo pessoal sai da API para o gateway; limite de custo interrompe a execução com status claro.

---

## 7. Validações por ticket (comuns)

- `make lint`, `make test`, `make build` na raiz; testes de integração PG com `TEST_DATABASE_URL` local
  (banco temporário, ver banco-unico); `make contracts-check` quando `packages/contracts` mudar.
- Migrations aplicadas ao `nucleos_dev` somente após integração (`migrar-banco.sh`).
- Documentação de entrega em `documentacoes/financeiro/` (FIN) e `documentacoes/funcionarios/` (FUN),
  atualização de `documentacoes/dados/banco-unico-nucleos.md` (mapa de schemas) e lessons aplicáveis
  (ver manifesto §7).
