# Lote 2026-11-02 — Financeiro completo + Funcionários Virtuais (manifesto)

- **Data do planejamento:** 2026-11-02 (America/Sao_Paulo)
- **Tipo:** planejamento avulso (`planejador-de-lote-avulso`): grill-me → tech-lead → worktree-planner.
  Não é pacote do Context Compiler; não há workflow/bindings/estado executável.
- **Repositório:** `nucleos` (único), branch de trabalho `developer`, padrão `main`.
- **Base verificada:** `developer` @ `c542704` (`docs: regras de banco unico e fluxo enxuto…`), com
  **alterações não commitadas** do fluxo de caixa (migrations 0002/0003, `apps/api/src/fluxo-caixa/`,
  páginas web) — ver pré-condição P0.
- **Status do lote:** `PRONTO_PARA_IMPLEMENTAR` para as ondas A–C, condicionado a P0 e às autorizações de
  dependência (§5). FIN-301 e FIN-303 prontos para implementar, com ativação real dependente de credenciais.
- **Especificação canônica:** [lote-2026-11-02-financeiro-funcionarios-especificacao.md](lote-2026-11-02-financeiro-funcionarios-especificacao.md)
- **Prompts de execução:** [lote-2026-11-02-financeiro-funcionarios-prompts.md](lote-2026-11-02-financeiro-funcionarios-prompts.md)

## 1. Objetivo

Construir o setor Financeiro do backlog [02_11_26.md](../backlog/00-BACKLOG%20MANUAL/02_11_26.md) (etapas 1–8 e 10),
front e back end, sobre o módulo de **Funcionários Virtuais**
([prompt_implementacao_funcionarios.md](../backlog/00-BACKLOG%20MANUAL/prompt_implementacao_funcionarios.md)),
para que cada rotina financeira seja uma tarefa real, configurável e auditável em
Funcionários → Financeiro e Fiscal → Tarefas.

## 2. Escopo e exclusões

**Dentro:** módulo Funcionários completo (modelo, motor de agendamento/fila, API, telas); migração da rotina
Hotmart de 30 min para o motor; receitas/vendas detalhadas, webhook Hotmart (teste local), despesas e contas a
pagar, contas a receber e movimentações, conciliação, dashboard, fluxo de caixa projetado com cenários, DRE
gerencial, anomalias por regra, importação Meta Ads (leitura), rentabilidade de marketing, CFO Virtual com
Claude via ai-gateway.

**Fora:** etapa 9 (fiscal/notas) — só registros `PLANEJADA`/`RASCUNHO`; Google Ads e escrita em contas de
anúncio; "Orçamentos e Metas"; login real e permissões por usuário; multi-tenant/RLS; integração bancária
direta (só importação OFX/CSV); exportação PDF; prédio 3D (apenas o endpoint de estado); ativação do webhook
em URL pública; deploy/staging.

## 3. Decisões e origem

Ver tabela D1–D15 na especificação §1. Resumo das decisões do usuário nesta sessão:

| Pergunta | Resposta |
| --- | --- |
| Funcionários Virtuais no lote? | Sim, usar o prompt de implementação de funcionários neste lote |
| Webhooks Hotmart | Endpoint + teste local; ativação real pendente |
| Etapa 9 fiscal | Fora do lote |
| Marketing e IA | APIs de anúncios + Claude → refinado para **somente Meta Ads**, leitura |
| Autorização | Chave de serviço + admin único (uso local) |

Hipóteses registradas (revisáveis sem replanejar): D10 (DRE competência × caixa e dupla contagem de mídia),
D12, D13 (nome do funcionário), D14 (CFO em Diretoria), regras de conciliação (±3 dias), horizontes
(recorrências 3 meses, projeção 90 dias), limites de anomalia.

## 4. Tickets

| ID | Título | Onda | Perfil/risco | Depende de | Status |
| --- | --- | --- | --- | --- | --- |
| P0 | Commitar o fluxo de caixa pendente em `developer` (ação do usuário) | — | baixo | — | **BLOQUEADOR** |
| FUN-001 | Modelo de dados, seeds e catálogo | A | alto — migrations base de tudo | P0 | PRONTA |
| FUN-002 | Motor: planejador, fila ADR-021, handlers, eventos | A | **crítico** — concorrência, idempotência | FUN-001 | PRONTA (dep. `cron-parser`) |
| FUN-003 | Rotina Hotmart migrada para o motor (mecanismo único) | A | alto — regressão da sync existente | FUN-002 | PRONTA |
| FUN-004 | API REST de Funcionários + estado p/ 3D | A | médio — validação/segredos | FUN-002 | PRONTA |
| FUN-005 | Web: menu, listagem, cadastro, catálogo | A | médio | FUN-004 | PRONTA |
| FUN-006 | Web: detalhes, configuração de tarefa, histórico | A | médio | FUN-005 | PRONTA |
| FIN-103 | Alertas financeiros (infra comum) | B | baixo | FUN-002 | PRONTA |
| FIN-101 | Receitas e vendas (comissões, eventos, reconciliação, tela) | B | alto — dados de receita | FUN-003, FIN-103 | PRONTA |
| FIN-102 | Webhook Hotmart (receptor + handler) | B | alto — endpoint público, PII | FIN-101 | PRONTA (ativação real pendente) |
| FIN-104 | Despesas e contas a pagar (+ anexos, importação CSV) | B | alto — muda o fluxo de caixa existente | FIN-103 | PRONTA (dep. S3 ou `bytea`) |
| FIN-105 | Contas a receber, contas financeiras, movimentações, extrato | B | alto — saldos | FIN-104, FIN-101 | PRONTA |
| FIN-106 | Conciliação financeira | B | alto | FIN-105 | PRONTA |
| FIN-201 | Dashboard Visão Geral + hub do menu Financeiro | C | médio | FIN-106 | PRONTA |
| FIN-202 | Fluxo de caixa realizado/projetado com cenários | C | médio | FIN-105, FIN-201 | PRONTA |
| FIN-203 | DRE gerencial e exportação CSV | C | médio | FIN-201 | PRONTA |
| FIN-204 | Anomalias por regras | C | baixo | FIN-203 | PRONTA |
| FIN-301 | Importação Meta Ads (leitura) | M (paralela) | médio — credencial externa | FUN-002 | PRONTA (ativação real precisa token) |
| FIN-302 | Rentabilidade e marketing | D | médio | FIN-203, FIN-301 | PRONTA |
| FIN-303 | CFO Virtual (ai-gateway + Claude + tela) | D | alto — IA, custo, vazamento | FIN-204, FIN-302 | PRONTA (dep. `anthropic`, chave) |

Critérios, contratos e escopo detalhados: especificação §3–§6 (não duplicados aqui).

**Caminho crítico:** P0 → FUN-001 → FUN-002 → FUN-003 → FIN-101 → FIN-104 → FIN-105 → FIN-106 → FIN-201 →
FIN-203 → FIN-204 → FIN-303.

## 5. Recursos e autorizações necessárias antes de executar

| Item | Quem | Necessário para |
| --- | --- | --- |
| P0: commit do fluxo de caixa em `developer` | Usuário | Base limpa de todas as frentes |
| Autorizar `cron-parser` (versão exata) | Usuário | FUN-002 (senão parser próprio) |
| Autorizar `@aws-sdk/client-s3` | Usuário | FIN-104 anexos no MinIO (senão `bytea` ≤ 5 MB) |
| Autorizar `anthropic` (Python) | Usuário | FIN-303 |
| Autorizar commits locais nas branches do lote e em `revisao/2026-11-02-financeiro-funcionarios` | Usuário | Execução com integração |
| `HOTMART_WEBHOOK_HOTTOK` | Usuário (painel Hotmart) | FIN-102 ativação real |
| `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID` (System User, `ads_read`) | Usuário | FIN-301 ativação real |
| `ANTHROPIC_API_KEY`, `AI_GATEWAY_API_KEY` | Usuário | FIN-303 ativação real |
| Docker `core` (Postgres, MinIO) em `127.0.0.1` | Local | Integração PG e migrations |

## 6. Plano de execução (worktrees, ordem e integração)

Worktrees em `../nucleos-worktrees/<branch>` (convenção do projeto), criadas a partir de `developer` após P0.
Integração local em `revisao/2026-11-02-financeiro-funcionarios`. Push, PR e merge em `main` sempre manuais.

| Frente | Branch | Tickets (sequenciais na mesma worktree) | Base | Paralelismo |
| --- | --- | --- | --- | --- |
| A | `feat/lote-1102-a-funcionarios` | FUN-001 → 002 → 003 → 004 → 005 → 006 | `developer` pós-P0 | — |
| B | `feat/lote-1102-b-base-financeira` | FIN-103 → 101 → 102 → 104 → 105 → 106 | `revisao/…` após A integrada | — |
| M | `feat/lote-1102-m-meta-ads` | FIN-301 | `revisao/…` após A integrada | **paralela a B** (arquivos distintos: `marketing/`, migrations 0020–0021) |
| C | `feat/lote-1102-c-gestao` | FIN-201 → 202 → 203 → 204 | `revisao/…` após B integrada | — |
| D | `feat/lote-1102-d-marketing-cfo` | FIN-302 → 303 | `revisao/…` após C e M integradas | — |

Por que não mais paralelismo: B, C e D compartilham `financeiro.lancamentos`, `categorias`, o módulo
`fluxo-caixa/` e `packages/contracts/src/index.ts`; separá-los geraria conflitos sem ganho real. A frente M
só toca `apps/api/src/marketing/`, `packages/config` (novo arquivo) e o seed do catálogo (ponto de conflito
pequeno: linha de status da tarefa — resolver na integração).

Pontos de conflito conhecidos: `apps/api/src/main.ts` (registro de módulos), `app.module.ts`,
`packages/contracts/src/index.ts`, `apps/web/app/components/AppShell.tsx`, `documentacoes/dados/banco-unico-nucleos.md`,
`lessons/README.md`, `.env.example`. Integrar na ordem da tabela; migrations aplicadas ao `nucleos_dev` só
após a integração e em ordem numérica (faixas reservadas na especificação §2).

Por ticket: implementar → testes → `make lint && make test && make build` → documentação de entrega e
lessons → commit local (se autorizado). Por frente: uma revisão corretiva de impactos médios/altos/críticos
(`revisor-de-codigo`), checks integrados em `revisao/…`, roteiro manual de tela (§8). Sem auditor/QA por IA
(fluxo enxuto do projeto). DONE técnico não é aceite visual.

Limpeza futura (só com autorização): remover worktrees após integração comprovada; `apps/api/dist/funcionarios/`
é saída de build antiga (sem fonte) e deve sumir num `make build` limpo — não confundir com código existente.

## 7. Documentação e lessons esperadas

- Entregas: `documentacoes/funcionarios/2026-MM-DD-*.md` (FUN) e `documentacoes/financeiro/2026-MM-DD-*.md`
  (FIN), conforme CLAUDE.md (metadados, diffs, validações reais). Atualizar
  `documentacoes/dados/banco-unico-nucleos.md` a cada tabela nova (schemas `organizacao`, `funcionarios`,
  `marketing`).
- Lessons: atualizar **11 (Fila durável com lease)** com o motor real; **16 (Sincronização idempotente)**
  com webhook + eventos; **18 (Server Actions/integridade)** com contas a pagar/conciliação. Candidatas novas
  (posição a definir pela dependência pedagógica, renumerando se preciso): agendamento por intervalo/cron com
  relógio controlado; receptor de webhook seguro (segredo em tempo constante, idempotência, minimização de
  PII); agente de IA com ferramentas somente leitura e limites de custo (Python).

## 8. Roteiro manual de tela (ao final de cada frente)

1. **A:** menu Funcionários → Financeiro e Fiscal → Analista de Atualizações Financeiras → Tarefas →
   Atualizar Dados Financeiros → Configurar Agendamento: ver 30 min, mudar para 60, salvar, conferir próxima
   execução; "Executar agora" e ver no histórico; pausar/reativar; catálogo mostra tarefas planejadas sem
   botão de agendar; criar funcionário rascunho e atribuir tarefa do setor.
2. **B:** vendas com filtros e detalhe/histórico de status; webhook simulado (comando documentado) muda
   status; cadastrar fornecedor/centro de custo, despesa parcelada 3x, conta recorrente gerada pelo
   funcionário, anexo; importar CSV de despesas e extrato OFX; registrar saque Hotmart; ver conciliação
   sugerida e aceitar; alertas de vencimento.
3. **M:** sem token: mensagem clara; com token: importar e ver campanhas/gastos.
4. **C:** Visão Geral com filtros; fluxo diário/semanal/mensal e cenários; DRE com mapeamento de categorias e
   exportação CSV; anomalia gerada com dados de teste.
5. **D:** rentabilidade por campanha com aviso ROAS ≠ lucro; perguntar ao CFO cada competência; análise
   periódica aparece; sem chave Anthropic a tela explica.
Testar em ~400 px e tema claro/escuro.

## 9. Bloqueios e pendências

| ID | Descrição | Efeito |
| --- | --- | --- |
| B1 | P0 não feito | Nenhuma frente começa |
| B2 | Dependências não autorizadas | FUN-002/FIN-104 usam alternativa; FIN-303 BLOQUEADO |
| B3 | Sem URL pública | Webhook só testado localmente (polling cobre) |
| B4 | Sem credenciais Meta/Anthropic | FIN-301/303 entregues e testados com simulação; ativação real pendente |
| B5 | Login real/permissões por usuário | Admin único implícito; risco aceito só para uso local |
| B6 | Nome definitivo do banco único (`nucleos_dev` × `nucleos_control`) | Herdado; não bloqueia |
| B7 | Fiscal, Google Ads, Orçamentos e Metas | Lotes futuros |
