# EP-06 — Tenant Runtime e agentes

> Prefixo: `ENT-RUN` · Sprints: S04–S06 · Tickets: 7 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Entregar o **runtime Python dedicado por empresa** (ADR-002, ADR-005): um container por tenant, mesma imagem versionada para todos, com agentes lógicos distintos dentro dele. O runtime consome jobs do Dispatcher, executa agentes via framework decidido no ADR-022, **propõe** ações que o Tool Gateway autoriza e o AI Gateway executa, e persiste tudo no banco do próprio tenant.

## Princípios herdados do ADR

- Um runtime por empresa, **não** um container por agente (seção 4.3).
- O runtime só obtém tarefas do seu tenant, com identidade autenticada (MSG-002).
- O runtime não possui credencial de outro tenant, nem de superuser, nem de storage, nem a chave do provedor LLM.
- Sem execução arbitrária de código no runtime base (ADR-013).
- O LLM só propõe; a aplicação valida e executa (seção 5.2).

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-RUN-001](tickets.md#ent-run-001) | Esqueleto do runtime e Tenant API interna | S04 | M | ALTO | DEC-013, MSG-002, DAT-004 |
| [ENT-RUN-002](tickets.md#ent-run-002) | Imagem do runtime (não-root, somente leitura) | S04 | M | ALTO | ISO-007, RUN-001 |
| [ENT-RUN-003](tickets.md#ent-run-003) | Registro e versionamento de agentes e departamentos | S05 | M | ALTO | IAM-007, RUN-001 |
| [ENT-RUN-004](tickets.md#ent-run-004) | Engine de execução de agentes | S05 | L | CRÍTICO | DEC-008, MSG-003, TGW-001, AIG-001 |
| [ENT-RUN-005](tickets.md#ent-run-005) | Aprovação humana durável | S06 | M | ALTO | RUN-004 |
| [ENT-RUN-006](tickets.md#ent-run-006) | Conversas, memória e API de leitura | S06 | M | ALTO | RUN-004, DAT-004 |
| [ENT-RUN-007](tickets.md#ent-run-007) | Perfil de recursos do runtime (validar 512 MiB) | S06 | S | ALTO | RUN-004 |

## Critério de saída

Um tenant executa uma tarefa de agente de ponta a ponta (job → raciocínio → ferramenta autorizada → aprovação humana → resultado persistido → evento), com orçamento respeitado, sem tocar dados de outro tenant, e com consumo de CPU/RAM medido para dimensionar o cenário A.

## Riscos

- Hipótese de 512 MiB por runtime (ADR 4.2) pode ser otimista; RUN-007 mede e corrige o orçamento.
- Dependências de IA são grandes e mudam rápido: *pinning*, SBOM e revisão (ISO-007).
- Parsers de documentos no runtime ampliam superfície; limitar formatos e recursos (RAG-001).
