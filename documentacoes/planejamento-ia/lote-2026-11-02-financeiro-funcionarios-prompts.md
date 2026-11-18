# Prompts de execução — Lote 2026-11-02 Financeiro + Funcionários

Um prompt por frente, para uma sessão de IA (ou pessoa) executar sem esta conversa. Manifesto:
[lote-2026-11-02-financeiro-funcionarios.md](lote-2026-11-02-financeiro-funcionarios.md). Especificação canônica:
[…-especificacao.md](lote-2026-11-02-financeiro-funcionarios-especificacao.md).

Regras comuns a todos os prompts (não repetir nas sessões):

- Leia `CLAUDE.md` da raiz e siga a definição de pronto (documentação em `documentacoes/<dominio>/`,
  lessons, diffs reais). Banco único: `documentacoes/dados/banco-unico-nucleos.md`.
- Confirme raiz Git, branch e base antes de alterar. Preserve trabalho alheio. Sem push/PR/merge em `main`.
  Commits locais só se o pedido de execução autorizar.
- Dependências novas só com autorização explícita (manifesto §5); sem ela, use a alternativa da
  especificação §1.
- Testes de banco só com `TEST_DATABASE_URL` local (banco temporário). Nunca imprima segredos.
- Ao terminar cada ticket: `make lint`, `make test`, `make build`; registre resultados reais.

---

## Frente A — Funcionários Virtuais

```
Worktree: ../nucleos-worktrees/feat/lote-1102-a-funcionarios (branch feat/lote-1102-a-funcionarios,
base developer após o commit do fluxo de caixa — P0 do manifesto).

Implemente, em sequência, FUN-001 → FUN-002 → FUN-003 → FUN-004 → FUN-005 → FUN-006 da especificação
documentacoes/planejamento-ia/lote-2026-11-02-financeiro-funcionarios-especificacao.md (§1 decisões, §2
modelo/faixas de migration 0004–0006, §3 tickets). A fonte funcional é
documentacoes/backlog/00-BACKLOG MANUAL/prompt_implementacao_funcionarios.md; onde a especificação decidir
algo diferente (nomes em português, ADR-021, admin único), vale a especificação.

Leia antes: apps/api/src/main.ts, app.module.ts, apps/api/src/vendas/{agendador,sincronizacao,
vendas.controller,vendas.module}.ts, apps/api/src/migrar.ts, apps/api/src/fluxo-caixa/ (padrão de módulo,
repositório e testes HTTP), lessons/11 (fila com lease), apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/
(padrão de Server Actions e PainelLateral), apps/web/app/components/AppShell.tsx.

Pontos críticos: um único mecanismo dispara a sincronização Hotmart (remover o Agendador do caminho ativo);
relógio injetável nos testes; teste de integração PG com dois consumidores concorrentes; tarefa PLANEJADA
não agenda nem executa; nenhum segredo em config/execuções/auditoria.

Entrega: documentacoes/funcionarios/<data>-modulo-funcionarios-virtuais.md (+ -diffs.md), mapa de schemas
atualizado, lesson 11 atualizada e lesson nova de agendamento se aplicável. Encerre com o roteiro manual A
(manifesto §8) pendente para o usuário.
```

## Frente B — Base financeira (etapas 1–4)

```
Worktree: ../nucleos-worktrees/feat/lote-1102-b-base-financeira, base revisao/2026-11-02-financeiro-funcionarios
com a frente A integrada.

Implemente FIN-103 → FIN-101 → FIN-102 → FIN-104 → FIN-105 → FIN-106 (especificação §4; migrations 0007–0015).
Cada handler novo é registrado no motor da frente A, muda a tarefa para DISPONIVEL, cria atribuição/agendamento
conforme a tabela da especificação §3 (FUN-001) e ativa o funcionário quando suas tarefas essenciais existirem.

Leia antes: documentacoes/financeiro/2026-11-01-painel-de-vendas-hotmart.md, 2026-11-02-fluxo-de-caixa.md,
apps/api/src/vendas/ (dominio, hotmart-client, repositorio-pg), apps/api/src/fluxo-caixa/ e migrations
0001–0003. Confira na documentação oficial da Hotmart os endpoints de comissões/detalhes de preço e os
eventos/headers do webhook; registre URLs e data da consulta.

Pontos críticos: FIN-104 altera o fluxo de caixa existente — migre dados dos pagamentos recorrentes sem perda
e mantenha a tela funcionando; webhook fora do guard de serviço, hottok em tempo constante, sem PII persistida;
"disponível para saque" nunca inventado (D11); conciliação ambígua vai para pendente_analise.

Entrega: um documento por ticket ou um consolidado em documentacoes/financeiro/, mapa de schemas, lessons 16
e 18 atualizadas, lesson de webhook seguro se aplicável. Roteiro manual B pendente.
```

## Frente M — Meta Ads (paralela à B)

```
Worktree: ../nucleos-worktrees/feat/lote-1102-m-meta-ads, base revisao/… com a frente A integrada.

Implemente FIN-301 (especificação §6; schema marketing, migrations 0020–0021). Somente leitura. Credenciais
pelo padrão de packages/config (ver packages/config/src/vendas.ts). Confira a versão vigente da Graph API /
endpoint de insights na documentação oficial e registre. Testes sem rede (respostas simuladas, paginação, 429,
token inválido). Sem token configurado, a tarefa fica indisponível com mensagem clara — sem execução fictícia.

Entrega: documentacoes/financeiro/<data>-importacao-meta-ads.md, mapa de schemas. Roteiro manual M pendente.
Na integração, resolver conflito do seed/status do catálogo com a frente B.
```

## Frente C — Gestão (etapas 5–7)

```
Worktree: ../nucleos-worktrees/feat/lote-1102-c-gestao, base revisao/… com A, B (e M, se já integrada).

Implemente FIN-201 → FIN-202 → FIN-203 → FIN-204 (especificação §5; migrations 0016–0019). Hub
/setores/financeiro passa a mostrar o menu do backlog (sem Notas Fiscais e Orçamentos e Metas).
Gráficos em SVG com tabela acessível, como em setores/financeiro/vendas. DRE por competência, fluxo por
caixa (D10); sem rateio inventado por produto/centro de custo.

Entrega: documentos em documentacoes/financeiro/, mapa de schemas, lessons aplicáveis. Roteiro manual C pendente.
```

## Frente D — Rentabilidade e CFO (etapas 8 e 10)

```
Worktree: ../nucleos-worktrees/feat/lote-1102-d-marketing-cfo, base revisao/… com A, B, M e C integradas.

Implemente FIN-302 → FIN-303 (especificação §6; migration 0022). FIN-303 toca services/ai-gateway (Python,
uv, ruff, mypy): endpoint autenticado, cliente Claude (dependência `anthropic` autorizada), ferramentas
somente leitura sobre a API, limites de passos/tokens/custo, registro de uso. Use a skill claude-api para
model IDs e uso do SDK. Nenhum dado pessoal chega ao gateway; o agente não altera os próprios limites.
Testes com cliente Claude simulado (sem rede).

Entrega: documentos em documentacoes/financeiro/ (e transversal/ se o gateway mudar de forma geral), lesson
nova sobre agente com ferramentas somente leitura. Roteiro manual D pendente.
```
