# EP-06 — Tickets

Regras globais: [../README.md](../README.md).

<a id="ent-run-001"></a>
## ENT-RUN-001 — Esqueleto do runtime e Tenant API interna

**Sprint** S04 · **Prioridade** Crítica · **Tam.** M · **Risco** ALTO · **Tipo** Feature de plataforma
**Depende de:** DEC-013, MSG-002, DAT-004 · **Bloqueia:** MSG-003, RUN-002..006
**Referências:** ADR-005, 4.3, 5.1; ADR-025.

**Especificação técnica** — `services/tenant-runtime` (Python ≥ 3.12, `asyncio`).
- **Processos**: (1) *worker loop* que faz `lease` no Dispatcher, executa e confirma; (2) **Tenant API** (FastAPI/Starlette), servidor interno **sem publicação de porta**, acessível apenas pela rede do tenant, usada pelo Control Plane para leituras autorizadas (ADR-025).
- **Bootstrap seguro**: carrega configuração tipada (Pydantic Settings); lê segredos de arquivos (chave privada de identidade, credencial `…_app` do PostgreSQL); verifica que o `tenant_id` configurado coincide com o `sub` obtido do token e com o database conectado (`SELECT current_database()` == `tenant_<hex>`) — **falha fechada** se divergir.
- **Pool de conexões** ao banco do tenant (psycopg 3 async; tamanho pequeno, `CONNECTION LIMIT` do role respeitado), TLS conforme topologia; timeouts e `statement_timeout`.
- **Autenticação da Tenant API**: valida token de serviço do Control Plane (`aud=tenant-runtime`, `tenant_id` igual ao próprio) **e** *claims* do usuário final já autorizado (`act`: `user_id`, permissões, departamentos). O runtime re-checa `tenant_id` e escopo, nunca confia no CP cegamente.
- Endpoints iniciais: `GET /internal/v1/health`, `GET /internal/v1/ready`, `GET /internal/v1/runs`, `GET /internal/v1/runs/{id}` (somente metadados; conteúdo em RUN-006).
- Encerramento gracioso: ao receber `SIGTERM`, para de pegar jobs, aguarda execução com prazo, libera leases.
- Logging/trace conforme FND-009; **nunca** logar prompts/conteúdo por padrão.
- Versão de esquema suportada verificada na partida (DAT-003).

**Critérios de aceite**
- [ ] Runtime configurado para tenant A com credencial de B não sobe (teste: divergência de `current_database()`).
- [ ] Tenant API rejeita token com `tenant_id` diferente do runtime (404/403) e token sem `act`.
- [ ] `SIGTERM` durante execução devolve o lease sem perder o job.

**Testes.** Unitários (config, validações), integração com PostgreSQL e Dispatcher falso, SEC (token de outro tenant).

---

<a id="ent-run-002"></a>
## ENT-RUN-002 — Imagem do runtime (não-root, somente leitura)

**Sprint** S04 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Infraestrutura
**Depende de:** ISO-007, RUN-001 · **Bloqueia:** PRV-005
**Referências:** ADR seção 7, seção 14 ("mesma imagem versionada").

**Especificação técnica**
- `Dockerfile` *multi-stage* com `uv sync --frozen`; imagem final slim/distroless, usuário `10001`, `WORKDIR` somente leitura, `PYTHONDONTWRITEBYTECODE=1`, sem shell quando viável, sem compiladores.
- Diretórios graváveis restritos a `tmpfs`/volume do tenant; `HEALTHCHECK` contra `/internal/v1/health`.
- Passa na política ISO-002 (read-only, cap_drop ALL, no-new-privileges) **sem exceções**.
- Imagem única para todos os tenants; configuração via arquivos de segredo/variáveis não sensíveis.
- Rótulos de versão/commit; SBOM, scan, assinatura (ISO-007).
- Tamanho da imagem e tempo de partida registrados (impactam provisionamento e rollout).

**Critérios de aceite**
- [ ] Container sobe com `read_only: true` e `cap_drop: ALL`.
- [ ] Tentativa de escrever fora de `tmpfs`/volume falha.
- [ ] Scan sem vulnerabilidades críticas/altas corrigíveis.

---

<a id="ent-run-003"></a>
## ENT-RUN-003 — Registro e versionamento de agentes e departamentos

**Sprint** S05 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** IAM-007, RUN-001 · **Bloqueia:** RUN-004, TGW-002, WEB-003
**Referências:** ADR 8.2 ("Cada agente tem `agent_id`, `tenant_id`, papel, versão e lista de ferramentas").

**Especificação técnica**
- **Fonte autoritativa no Control Plane** (`catalog.agent_templates` → `tenancy.agents`): `agent_id`, `tenant_id`, `department_code`, `role`, `name`, `persona` (descrição pública do funcionário virtual para o 3D), `version`, `model_policy` (modelos permitidos), `allowed_tools` (referências a ações do catálogo de ferramentas), `budget` (limites), `status`.
- Instanciar agentes a partir do catálogo na ativação do módulo (PRV-004/IAM-007); versões imutáveis (`agent_versions`): alteração cria nova versão; execuções registram a versão usada.
- **Runtime recebe snapshot assinado** da definição (via Dispatcher/Tenant API) e o valida; não aceita definição do LLM nem de conteúdo.
- Alterar `allowed_tools` exige permissão `agents:configure` e é auditado; ferramentas de alto risco exigem aprovação humana por padrão (`requires_approval`).
- Prompt de sistema do agente versionado; **prompt de sistema nunca contém segredos** e nunca é fonte de política.
- API de consulta: `GET /v1/organizations/:orgId/agents` e detalhe (Control Plane).

**Critérios de aceite**
- [ ] Execução registra `agent_id` + `version`; mudar a definição não altera execuções passadas.
- [ ] Runtime recusa definição com assinatura inválida ou `tenant_id` diferente.
- [ ] Usuário sem `agents:configure` não altera ferramentas (teste).

---

<a id="ent-run-004"></a>
## ENT-RUN-004 — Engine de execução de agentes

**Sprint** S05 · **Prioridade** Crítica · **Tam.** L · **Risco** CRÍTICO · **Tipo** Feature
**Depende de:** DEC-008, MSG-003, TGW-001, AIG-001 · **Bloqueia:** RUN-005, RUN-006, RAG-002
**Referências:** ADR-005, ADR-009, ADR-012, seção 8.

**Especificação técnica**
- Interface `AgentEngine` (isolando o framework do ADR-022) com `start(run)`, `resume(run, input)`, `cancel(run)`.
- **Máquina de estados** do run: `QUEUED → RUNNING → (WAITING_APPROVAL) → SUCCEEDED | FAILED | CANCELLED`; cada passo grava `run_steps` antes de efeitos externos (*write-ahead*), permitindo retomar após reinício sem repetir passos concluídos.
- **Toda chamada de ferramenta** passa por `ToolGatewayClient` (RUN→sidecar); o engine **não possui implementação local de ferramentas** de acesso a dados/rede. Argumentos do LLM são tratados como não confiáveis e **nunca** incluem/definem `tenant_id`, caminho, URL, SQL ou ID de workspace como autoridade: o gateway deriva contexto do token.
- **Toda chamada de modelo** passa pelo `AiGatewayClient` com `run_id/agent_id` para medição e orçamento; o runtime não conhece a chave do provedor.
- Limites por execução: máximo de passos, de chamadas de ferramenta, tokens, duração total e profundidade de sub-agentes; excedeu → falha controlada com `error_code`.
- Concorrência: até N (padrão 2) execuções simultâneas por runtime; *semáforo* assíncrono; *backpressure* no *lease* (só pega job se houver capacidade).
- Cancelamento cooperativo (sinal do heartbeat) e *timeouts* rígidos.
- Idempotência: `idempotency_key = job_id + step_seq` repassada ao gateway para ações com efeito.
- Conteúdo de fontes externas (e-mail, documentos, páginas) marcado como **não confiável** na montagem do contexto (delimitação estruturada, sem elevar privilégios) — complementa TGW-006.
- Telemetria: spans por run/step/tool; eventos em tempo real via outbox do tenant → Dispatcher (MSG-006) com payload mínimo.

**Critérios de aceite**
- [ ] Reiniciar o runtime no meio de uma execução retoma do último passo concluído, sem repetir efeito externo (ferramenta fictícia contadora).
- [ ] Modelo falso que emite `tenant_id=B` ou URL arbitrária: chamada negada pelo gateway; o engine registra `tool_calls.decision=denied`.
- [ ] Estourar orçamento de tokens interrompe a execução e gera `budget.threshold_reached`.
- [ ] Nenhum caminho de código executa shell/`eval`/código vindo do modelo (varredura estática + teste).

**Testes.** Unitários com modelo falso; integração com gateways simulados; falha induzida; SEC (injeção por ferramenta); propriedade (nenhuma chamada sem `run_id`).

---

<a id="ent-run-005"></a>
## ENT-RUN-005 — Aprovação humana durável

**Sprint** S06 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** RUN-004 · **Bloqueia:** WEB-004, TGW-003
**Referências:** ADR 5.2 (aprovação obrigatória), seção 9 (estado durável).

**Especificação técnica**
- Ferramentas/ações classificadas `requires_approval` (pagamentos, exclusões, envio em massa, publicações críticas, qualquer escrita externa por padrão no MVP) → run entra em `WAITING_APPROVAL` com registro em `approvals` (resumo legível **gerado pelo servidor** a partir dos argumentos validados, não texto livre do LLM).
- Estado **durável fora da memória** do runtime: o job permanece `WAITING_APPROVAL`, sem consumir *slot* de concorrência, e sobrevive a reinícios.
- Decisão: `POST /v1/organizations/:orgId/approvals/:id/decision` (Control Plane → Tenant API) com permissão `approvals:decide`; **solicitante da ação não aprova a si mesmo** quando política exigir dupla; decisão vincula-se ao *hash* dos argumentos aprovados (alterar argumentos invalida a aprovação).
- Expiração configurável; ao expirar → cancelar e notificar.
- Aprovação gera auditoria (quem, quando, hash) e evento em tempo real.
- Retomada executa **exatamente** a ação aprovada (comparação de hash no gateway).

**Critérios de aceite**
- [ ] Argumentos alterados após aprovação são recusados pelo gateway.
- [ ] Aprovação de usuário de outro tenant ou sem permissão é negada.
- [ ] Reiniciar runtime/Dispatcher durante a espera não perde o pedido.
- [ ] Aprovação expirada não executa a ação.

---

<a id="ent-run-006"></a>
## ENT-RUN-006 — Conversas, memória e API de leitura

**Sprint** S06 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Feature
**Depende de:** RUN-004, DAT-004 · **Bloqueia:** WEB-004, RAG-002

**Especificação técnica**
- Persistência de `conversations`/`messages`/`run_steps` no banco do tenant; contexto da conversa montado com janela (últimas N mensagens + resumo) respeitando orçamento de tokens.
- **Memória de longo prazo** (`memory_items`): escrita apenas por ação explícita do engine com política (o que pode ser lembrado, TTL); embeddings via AI Gateway; busca vetorial no database do tenant; **chave de cache sempre inclui o tenant** quando houver cache de retrieval (ou é desativado).
- Tenant API (ADR-025): `GET/POST /internal/v1/conversations`, `GET …/messages` (paginado por cursor), `POST …/messages` (cria job), com `act` do usuário validado; um `member` só vê conversas que criou ou às quais tem acesso por departamento (ABAC).
- Retenção e exclusão: política por tenant; exclusão de conversa remove mensagens, passos e memória derivada.
- Logs nunca carregam conteúdo de mensagens.

**Critérios de aceite**
- [ ] Usuário A1 não lê conversa de A2 sem permissão (ABAC) e nunca lê de B.
- [ ] Excluir conversa remove memória derivada e embeddings associados.
- [ ] Paginação por cursor estável em conversas longas.

---

<a id="ent-run-007"></a>
## ENT-RUN-007 — Perfil de recursos do runtime (validar 512 MiB)

**Sprint** S06 · **Prioridade** Alta · **Tam.** S · **Risco** ALTO · **Tipo** Benchmark
**Depende de:** RUN-004 · **Bloqueia:** GATE-002, GATE-006
**Referências:** ADR 4.2 (hipótese de 512 MiB), seção 12.

**Especificação técnica**
- Medir por runtime (com sidecar do Tool Gateway): RSS ocioso, RSS durante 1 e 2 execuções simultâneas, durante ingestão de documento de referência (RAG-001), pico de CPU, descritores e threads; usar `mem_limit` e observar OOM; diferenciar **limite, reserva e consumo observado**.
- Cenários: agente com contexto longo, embedding em lote, PDF de tamanho máximo permitido, rajada de 10 jobs.
- Resultado: recomendação de `mem_limit`/`cpus` por classe de carga, orçamento de RAM do host revisado (tabela 4.2 atualizada) e **capacidade máxima de tenants** do cenário A com margem.
- Registrar ambiente (plano da VPS, CPU compartilhada) e repetição (≥ 3 execuções) para variância.

**Critérios de aceite**
- [ ] Relatório com RSS/CPU por cenário e novo orçamento de RAM.
- [ ] Ajustes de limites aplicados nos templates (ISO-002/PRV-002) ou justificativa para manter.
- [ ] Gatilhos de expansão (ADR 13) calibrados com os números medidos.
