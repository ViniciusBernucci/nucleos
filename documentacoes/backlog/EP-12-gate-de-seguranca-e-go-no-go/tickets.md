# EP-12 — Tickets

Regras globais: [../README.md](../README.md). Matriz SEC → ticket: [../rastreabilidade.md](../rastreabilidade.md).

<a id="ent-gate-001"></a>
## ENT-GATE-001 — Suíte única SEC-01..SEC-18 e dossiê de evidências

**Sprint** S10 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Segurança/Testes
**Depende de:** IAM-010, DAT-005, ISO-008, MSG-007, RAG-003, PRV-006, DAT-008, DAT-009, TGW-005 · **Bloqueia:** GATE-004, GATE-008

**Especificação técnica**
- Orquestrador `make sec-gate` que executa, **contra staging com configuração idêntica à produção**, todos os testes SEC-01..18 reutilizando os módulos dos épicos de origem; saída padronizada (JUnit + markdown) com colunas: ID, descrição, resultado esperado, resultado observado, evidência (logs/prints/hash), versão do software (commit/digest), proprietário, data.
- Provisiona dois tenants **frescos** A e B pelo fluxo real (PRV) para exercitar o provisionamento ponta a ponta (SEC-16) e usa dados sentinela.
- Repetição após reinício do daemon Docker e do host (regressão de regras de rede).
- Gera `documentacoes/seguranca/dossie-gate-AAAA-MM-DD.md` assinado por responsável diferente do autor dos testes; histórico de execuções preservado.
- Execução automática em CI noturno em staging; reprovação cria ticket de correção ligado ao épico de origem.
- Regras: teste não executado = reprovado; teste marcado *skipped* exige justificativa e bloqueia o gate.

**Critérios de aceite**
- [ ] 18/18 testes executados e aprovados em staging, com evidência anexa.
- [ ] Mutação de segurança deliberada (ex.: conceder `CONNECT` a PUBLIC, remover regra de rede) faz o teste correspondente falhar.
- [ ] Dossiê revisado e assinado por pessoa diferente do autor.

---

<a id="ent-gate-002"></a>
## ENT-GATE-002 — Teste de carga com 5 tenants e rajadas de LLM (SEC-17)

**Sprint** S10 · **Prioridade** Alta · **Tam.** L · **Risco** ALTO · **Tipo** Performance
**Depende de:** RUN-007, AIG-002, MSG-005

**Especificação técnica**
- Ferramenta (k6/Locust) + provedor LLM **simulado** com latência e erros configuráveis (para não gerar custo e permitir rajadas controladas); amostra reduzida com provedor real em conta de teste.
- Cenários: carga normal de 5 tenants; rajada em um tenant (50 jobs/min) com os outros em carga normal; todos em rajada; ingestão de documentos simultânea; leitura intensa da UI (SSE).
- Medir por tenant: latência p50/p95/p99, tempo até início, idade de fila, taxa de erro, RAM/CPU por runtime, conexões e latência do PostgreSQL, limites de taxa do AI Gateway, interferência (variação de B enquanto A em rajada).
- Critério de "interferência tolerável" **definido antes do teste** e aprovado (ex.: p95 de B não degrada além de X%).
- Verificar que limites de concorrência, orçamento e rate limit são respeitados e que nenhum OOM ocorre.

**Critérios de aceite**
- [ ] Relatório com critérios, números e conclusão; cumpre os limites definidos.
- [ ] Nenhum OOM não tratado; nenhum vazamento cruzado durante a carga (sentinelas).
- [ ] Ajustes de limites/dimensionamento aplicados ou riscos registrados.

---

<a id="ent-gate-003"></a>
## ENT-GATE-003 — Testes de falha e caos (SEC-18)

**Sprint** S10 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Resiliência

**Especificação técnica**
- Cenários: OOM-kill de runtime A; reinício de runtime durante execução; queda do PostgreSQL por 60 s; queda do Redis; Dispatcher reiniciado; AI Gateway indisponível; provedor LLM retornando 5xx/429; storage indisponível; disco do host cheio; reinício do host; falha no meio do provisionamento (cada passo).
- Para cada cenário: **falha contida** (apenas o tenant/serviço atingido), recuperação automática ou documentada, **nenhum vazamento cruzado** e nenhuma operação duplicada.
- Verificações pós-falha: estado de jobs, filas, aprovações pendentes e credenciais consistentes.

**Critérios de aceite**
- [ ] Matriz cenário × resultado preenchida; falha de A não derruba B (exceto falhas de host/instância compartilhada, **documentadas como risco residual**).
- [ ] Achados viram tickets de correção ou riscos aceitos.

---

<a id="ent-gate-006"></a>
## ENT-GATE-006 — Revisão de custos e capacidade com benchmark

**Sprint** S10 · **Prioridade** Média · **Tam.** M · **Risco** MÉDIO · **Tipo** Análise
**Depende de:** RUN-007, OBS-002, GATE-002
**Referências:** ADR seção 12.

**Especificação técnica**
- Substituir as estimativas do ADR (RAM 10,5 GiB, custo US$ 16–31/mês etc.) por números **medidos**: RAM por runtime com sidecar, overhead de PostgreSQL/Redis/observabilidade, custo real do plano contratado, storage/backup externos, custo de IA por tarefa típica.
- Capacidade máxima segura de tenants no cenário A e gatilhos reais para estágio 2.
- Custo por tenant (infra + IA) e sensibilidade a uso; **sem proposta comercial**; incluir custos não cobertos (impostos, suporte, engenharia).
- Atualizar o ADR/documento de arquitetura com as medições (via novo ADR ou adendo).

**Critérios de aceite**
- [ ] Documento com tabela estimado × medido e conclusão sobre viabilidade de 5 tenants.
- [ ] Capacidade e gatilhos publicados e usados por OBS-002.

---

<a id="ent-gate-004"></a>
## ENT-GATE-004 — Revisão de segurança independente / teste de invasão

**Sprint** S11 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Segurança
**Depende de:** GATE-001 · **Bloqueia:** GATE-008
**Referências:** ADR seção 15 ("Prática").

**Especificação técnica**
- Escopo entregue ao avaliador: staging idêntico à produção, documentação de arquitetura/threat model, contas de teste de dois tenants, rede (caixa-cinza); objetivos: acesso cruzado de dados, escalada para host/Docker, extração de segredos, abuso de agentes (prompt injection → ferramentas), SSRF, abuso de provisionamento/webhook, fraude de orçamento.
- **Independência**: avaliador não participou da implementação; regras de engajamento escritas (janela, limites, contatos, dados sintéticos).
- Revisão de configuração (host, PostgreSQL, Docker, Caddy) e de dependências/imagens.
- Classificação CVSS/severidade; achados críticos/altos **bloqueiam** o go; corrigir → reteste do item.

**Critérios de aceite**
- [ ] Relatório recebido, achados triados e ligados a tickets; críticos/altos corrigidos e retestados (ou risco aceito formalmente pelo responsável).
- [ ] Nenhum acesso cruzado de dados demonstrado em aberto.

---

<a id="ent-gate-005"></a>
## ENT-GATE-005 — Simulação de incidente e recuperação de desastre

**Sprint** S11 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Operação
**Depende de:** DAT-008, OBS-004

**Especificação técnica**
- Cenário 1: perda total do host — reconstruir em nova VPS a partir de Ansible + imagens por digest + backups externos + custódia da chave; medir **RTO real** e **RPO real**.
- Cenário 2: comprometimento de credencial de runtime A — detectar, revogar, rotacionar, avaliar impacto (B intacto).
- Cenário 3: restauração isolada de A com B ativo (reforça SEC-14).
- Cenário 4: indisponibilidade prolongada do LLM — degradação, mensagens ao usuário, preservação de aprovações pendentes.
- Registro de linha do tempo, decisões, falhas dos runbooks e correções.

**Critérios de aceite**
- [ ] RTO/RPO medidos e comparados às metas (OBS-005); lacunas viram tickets.
- [ ] Runbooks atualizados com o que o ensaio revelou.

---

<a id="ent-gate-007"></a>
## ENT-GATE-007 — Dossiê LGPD, riscos residuais e termos ao cliente

**Sprint** S11 · **Prioridade** Alta · **Tam.** S · **Risco** ALTO · **Tipo** Documento
**Depende de:** DEC-011, PRV-010

**Especificação técnica**
- Compilar: papéis e subprocessadores, fluxos de dados (diagrama), retenção por categoria, evidências técnicas (criptografia, isolamento, exclusão verificável), processo de incidentes e direitos do titular.
- **Registro de riscos residuais** atualizado (kernel/host compartilhado, instância PostgreSQL compartilhada, LLM externo, logs, ponto único de falha) com texto **honesto** para clientes: o que é garantido, o que não é.
- Insumos para termos de uso/DPA (revisão pelo jurídico); não afirmar "segurança absoluta" ou equivalência a isolamento físico.

**Critérios de aceite**
- [ ] Dossiê revisado por responsável legal indicado; pendências viram bloqueios no checklist do GATE-008.

---

<a id="ent-gate-008"></a>
## ENT-GATE-008 — Go/no-go formal e checklist do primeiro cliente real

**Sprint** S11 · **Prioridade** Crítica · **Tam.** S · **Risco** CRÍTICO · **Tipo** Decisão
**Depende de:** GATE-001..007, IAM-009, PRV-008

**Especificação técnica**
- Reunião de decisão com atas: evidências do GATE-001/004/005, estado de riscos, custos, LGPD, operação (on-call, backups, alertas), capacidade.
- **Checklist de ativação** do 1º cliente: SEC 18/18 aprovados e dentro da validade (reexecutar se houver mudança relevante); backups e restore testados; chaves e custódia confirmadas; alertas ativos; orçamento de IA configurado; contrato/DPA aceitos; plano de rollback/offboarding; contato de incidente definido.
- Decisão registrada: **GO**, **GO condicional** (com itens e prazo, sem exposição de dados sensíveis) ou **NO-GO**; responsável nomeado.
- Primeiro cliente real ativado por provisionamento normal, com monitoramento reforçado nas primeiras semanas.

**Critérios de aceite**
- [ ] Ata assinada com decisão e responsáveis.
- [ ] Qualquer SEC reprovado ou não executado ⇒ decisão obrigatoriamente NO-GO.
