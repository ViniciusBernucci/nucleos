# EP-00 — Tickets

Convenções, Definition of Ready/Done e legendas: [../README.md](../README.md). Sprints: [../plano-de-sprints.md](../plano-de-sprints.md). Todos os spikes seguem a regra: **saída = decisão registrada + evidência reproduzível**.

<a id="ent-dec-001"></a>
## ENT-DEC-001 — Threat model STRIDE por fronteira de confiança

**Sprint** S00 · **Prioridade** Crítica · **Tam.** M · **Risco** ALTO · **Tipo** Spike/Documento
**Depende de:** — · **Bloqueia:** todos os tickets de gateway, dispatcher e provisioner (ajusta requisitos) · **Paralelo a:** DEC-002..004
**Referências:** ADR seção 1 ("prioridade absoluta"), seções 5–8, 15 (SEC-01..18); roteiro arquitetural etapa 13.

**Objetivo.** Produzir o modelo de ameaças que ancora os controles e testes SEC-01..18, antes de qualquer código de fronteira.

**Especificação técnica**
- Diagrama de fluxo de dados (Mermaid) com as fronteiras: Navegador↔Borda; Borda↔Web/API; API↔Control DB; API↔Dispatcher; Dispatcher↔Runtime; Runtime↔Tool Gateway; Runtime↔AI Gateway↔Provedor LLM; Runtime/Tool Gateway↔Tenant DB; Runtime/Tool Gateway↔Storage; Provisioner↔daemon Docker↔PostgreSQL administrativo; Tool Gateway↔APIs externas; Operador↔Host (SSH).
- Para cada fronteira: tabela STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, DoS, Elevation) com ameaça, ativo, controle existente no ADR, controle novo, ticket responsável e teste SEC associado.
- Casos de abuso obrigatórios: IDOR entre tenants; `tenant_id` adulterado em job/token/URL; *confused deputy* no Dispatcher; prompt injection direta e indireta (e-mail, documento, página web); documento envenenado no RAG; SSRF para metadata/localhost/IP privado e DNS rebinding; exfiltração via ferramenta HTTP; admin de tenant malicioso; insider com acesso de operação; credencial de runtime vazada; exaustão de orçamento de LLM (denial of wallet); fuga de container.
- Registro `RISK-nnn` (probabilidade, impacto, mitigação, contingência, gatilho de revisão) para cada risco residual, partindo da seção 16 do ADR.
- Matriz ameaça → ticket → teste (alimenta [../rastreabilidade.md](../rastreabilidade.md)).

**Fora do escopo.** Pentest (GATE-004); correção das ameaças (tickets próprios).

**Critérios de aceite**
- [ ] Toda fronteira listada possui STRIDE completo.
- [ ] Toda ameaça tem ticket de mitigação existente neste backlog **ou** `RISK-nnn` aceito com responsável nomeado.
- [ ] Revisado por pessoa diferente do autor; divergências registradas.
- [ ] Documento salvo em `documentacoes/seguranca/` com data e versão.

**Testes.** Revisão cruzada documentada; checagem de que cada SEC-01..18 aparece ao menos uma vez na matriz.

---

<a id="ent-dec-002"></a>
## ENT-DEC-002 — Autenticação de usuários: construir vs. IdP

**Sprint** S00 · **Prioridade** Crítica · **Tam.** S · **Risco** ALTO · **Tipo** Spike
**Depende de:** — · **Bloqueia:** IAM-003, IAM-004, WEB-001 · **ADR:** ADR-016
**Referências:** ADR 5.1; OWASP ASVS V2/V3.

**Objetivo.** Decidir como usuários se autenticam, preservando que o tenant é resolvido **no servidor** por membership no banco central.

**Opções a avaliar:** (1) autenticação própria no NestJS com sessões opacas server-side em PostgreSQL; (2) Ory Kratos; (3) Keycloak; (4) biblioteca de auth para Next.js (Auth.js/Better Auth); (5) IdP gerenciado (Clerk/Auth0/WorkOS).

**Critérios (com peso registrado):** revogação imediata de sessão; MFA TOTP/WebAuthn; caminho para SSO OIDC/SAML corporativo; consumo de RAM no orçamento do cenário A (Keycloak tende a consumir ~1 GiB, comparar medindo); propriedade dos dados de identidade/LGPD; lock-in; complexidade de integração com o modelo organização/membership; custo por MAU.

**Hipótese de partida (a validar):** autenticação própria com senha `argon2id`, sessões opacas revogáveis em PostgreSQL, TOTP, e-mail transacional via adaptador; reavaliar IdP quando houver exigência de SSO.

**Entregáveis:** PoC de login + criação de sessão + revogação para a opção líder; medição de RAM; ADR-016 com decisão, alternativas, trade-offs e gatilho de revisão.

**Critérios de aceite**
- [ ] ADR-016 aceito com tabela de critérios preenchida por evidência.
- [ ] Sessão revogada falha na requisição seguinte (medido no PoC).
- [ ] Decisão explicita onde ficam hash de senha, MFA seed e como migrar de opção.

---

<a id="ent-dec-003"></a>
## ENT-DEC-003 — Acesso a dados e migrations (control, tenant, Python)

**Sprint** S00 · **Prioridade** Crítica · **Tam.** M · **Risco** ALTO · **Tipo** Spike
**Depende de:** — · **Bloqueia:** IAM-002, DAT-002, DAT-003, DAT-004 · **ADR:** ADR-017
**Referências:** ADR-003, ADR-008, seção 6.

**Objetivo.** Definir ferramentas de acesso e migração para três contextos: (a) banco de controle usado pelo NestJS; (b) N bancos de tenant com esquema idêntico, migrados individualmente; (c) acesso do runtime Python ao banco do tenant.

**Pontos que o PoC deve provar**
- Conexão dinâmica a muitos bancos sem manter cliente/pool por tenant indefinidamente (ORMs com cliente gerado por schema podem ser inadequados para multi-database).
- Migração idempotente com `advisory lock`, tabela `schema_migrations` por tenant, checksum de arquivo e falha segura em meio de lote.
- Compatibilidade com `pgvector` (tipo `vector`, índices HNSW/IVFFlat) e `tsvector`.
- Mesma fonte de verdade de esquema para TS e Python (evitar duas definições divergentes): geração de tipos a partir do SQL ou testes de conformidade.
- Ergonomia de SQL parametrizado; proibição de interpolação de identificadores vindos de entrada externa.

**Hipótese de partida:** controle com query builder tipado (Kysely ou Drizzle) + migrations SQL; tenant com **SQL puro versionado** (`NNNN_descricao.up.sql`, forward-only, padrão expand/contract) executado por runner próprio em TypeScript usado pelo provisioner; Python com `psycopg` 3 (async) + SQL explícito, sem ORM no caminho de segurança.

**Convenções a fixar no ADR:** UUID (v7 preferido por localidade de índice) como PK; `timestamptz` em UTC; `numeric` para valores monetários e custo de tokens; soft delete só onde houver exigência de retenção; nomes `snake_case`; enum como `text` + `CHECK` (facilita expand/contract); toda tabela de tenant sem coluna `tenant_id` redundante (o isolamento é o banco), exceto onde exportação futura exigir.

**Critérios de aceite**
- [ ] ADR-017 aceito com as convenções acima.
- [ ] PoC aplica 3 migrations a 20 bancos de teste, mede tempo e prova retomada após falha induzida no banco 12.
- [ ] Documento descreve como adicionar migration e como reverter por *roll-forward*.

---

<a id="ent-dec-004"></a>
## ENT-DEC-004 — Identidade de serviço runtime ↔ Control Plane ↔ gateways

**Sprint** S00 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Spike
**Depende de:** — · **Bloqueia:** MSG-002, MSG-003, TGW-001, AIG-001, PRV-004 · **ADR:** ADR-018
**Referências:** ADR 5.1 ("credencial independente... mTLS ou token assinado com audiência e escopo"), 9, SEC-07, SEC-15.

**Objetivo.** Especificar como cada runtime prova quem é, para quem o token vale e como é revogado, sem reaproveitar token de usuário.

**Opções:** (A) JWT assinado (EdDSA/ES256) de vida curta, emitido pelo Control Plane após *enrollment*; (B) mTLS com CA interna (ex.: step-ca) e certificados de vida curta; (C) combinação (mTLS no transporte + JWT de escopo).

**Pontos a decidir**
- *Bootstrap*: segredo de *enrollment* de uso único gerado pelo provisioner; troca por par de chaves do runtime (chave privada nunca sai do runtime/volume do tenant).
- Claims mínimas: `iss`, `sub=runtime:<tenant_id>`, `aud` (dispatcher | tool-gateway | ai-gateway), `scope`, `tenant_id`, `jti`, `iat`, `exp` (≤ 5–10 min), `ver` (versão de credencial).
- Revogação: lista de `ver` mínimo por tenant consultável pelos serviços; rotação sem downtime (duas chaves ativas, JWKS com `kid`).
- Proteção contra replay (`jti` + cache curto) e confusão de audiência.
- Relógio: tolerância e sincronização NTP no host.

**Entregáveis:** ADR-018, especificação do token/handshake em `packages/contracts` (JSON Schema), PoC com runtime falso emitindo/validando/rejeitando tokens (expirado, audiência errada, tenant adulterado, versão revogada).

**Critérios de aceite**
- [ ] ADR-018 aceito; casos negativos do PoC todos rejeitados.
- [ ] Procedimento de rotação e de revogação de emergência documentado e demonstrado.
- [ ] Impacto em latência medido (validação local de assinatura sem chamada de rede por requisição).

---

<a id="ent-dec-005"></a>
## ENT-DEC-005 — PoC de isolamento de rede no host alvo e `userns-remap`/rootless

**Sprint** S01 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Spike
**Depende de:** VPS alvo disponível · **Bloqueia:** ISO-001, ISO-002, ISO-003 · **ADR:** ADR-019
**Referências:** ADR-014, seção 7, SEC-04, SEC-11, SEC-12.

**Objetivo.** Provar, na distribuição e versão de Docker do host real, que A não alcança B por nenhum caminho, e escolher entre `userns-remap`, Docker rootless ou usuário não-root no container com `cap_drop`.

**Experimentos (script reproduzível em `infrastructure/docker/poc-isolamento/`)**
1. Três redes *bridge* (A, B, infra) e containers sonda. Testar A→B por IP, por nome DNS, por `host.docker.internal`/gateway da bridge e por portas publicadas no host.
2. Regras em `DOCKER-USER` (iptables-nft) **e** alternativa nftables dedicada; verificar interação com regras que o Docker recria ao reiniciar; persistência após `systemctl restart docker` e reboot.
3. `com.docker.network.bridge.enable_icc=false` e `enable_ip_masquerade`; IPv6 desativado ou filtrado de forma equivalente.
4. Acesso a `169.254.169.254`, `127.0.0.1` do host, redes privadas e porta do PostgreSQL a partir de um container de tenant.
5. `userns-remap` vs rootless: compatibilidade com volumes, `no-new-privileges`, limites de recursos, desempenho de rede (slirp4netns/pasta), capacidade de aplicar regras de firewall por origem.
6. Tentativa de abrir `/var/run/docker.sock`, `--privileged`, `pid=host` a partir do tenant (deve ser impossível por não haver acesso ao daemon).

**Critérios de aceite**
- [ ] Matriz de resultados (caminho × esperado × observado) anexada, com versões de kernel, Docker, Compose e distribuição.
- [ ] Todos os caminhos A→B bloqueados antes e **depois** de reinício do daemon e do host.
- [ ] ADR-019 define a configuração obrigatória do host e o teste de regressão que o ISO-008 automatizará.
- [ ] Se rootless/userns-remap for rejeitado, o ADR registra o risco residual de kernel compartilhado.

---

<a id="ent-dec-006"></a>
## ENT-DEC-006 — Gestão de segredos do MVP

**Sprint** S01 · **Prioridade** Alta · **Tam.** S · **Risco** ALTO · **Tipo** Spike
**Depende de:** — · **Bloqueia:** FND-006, PRV-004, TGW-004, DAT-009 · **ADR:** ADR-020
**Referências:** ADR seção 10 ("Segredos").

**Objetivo.** Escolher o mecanismo que armazena, entrega e rotaciona (a) segredos da plataforma, (b) credenciais por tenant geradas pelo provisioner e (c) credenciais de integração fornecidas pelo cliente.

**Opções:** arquivos 0400 por tenant montados via `tmpfs` + criptografia de disco; Docker/Compose secrets; SOPS+age para segredos da plataforma versionados cifrados; OpenBao/Vault; Infisical. Para (c): criptografia envelope com chave mestra fora do banco.

**Critérios:** criação dinâmica por tenant sem humano; rotação com janela dupla; auditoria de leitura; RAM; recuperação de desastre do material de chave; não aparecer em `docker inspect`, variáveis de ambiente, logs nem imagens.

**Entregáveis:** ADR-020; desenho de hierarquia de chaves (chave mestra → chave de dados por tenant → segredo); procedimento de backup/recuperação da chave mestra; política "nunca em variável de ambiente" com teste automatizado em CI (scan de `docker inspect` do ambiente de teste).

**Critérios de aceite**
- [ ] ADR-020 aceito; PoC cria, entrega, rotaciona e revoga um segredo de tenant sem reiniciar outros tenants.
- [ ] Teste prova ausência de segredo em `env`, `inspect` e logs do PoC.
- [ ] Limitações vs. um vault real declaradas (sem prometer equivalência).

---

<a id="ent-dec-007"></a>
## ENT-DEC-007 — PoC de orquestração durável de tarefas

**Sprint** S02 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Spike
**Depende de:** DEC-003, DEC-004 · **Bloqueia:** MSG-001, MSG-003 · **ADR:** ADR-021
**Referências:** ADR-009, seção 9, seção 16 item 7.

**Objetivo.** Decidir a fonte de verdade de tarefas e o mecanismo de entrega: tabela PostgreSQL com *lease* (`SELECT … FOR UPDATE SKIP LOCKED`), BullMQ+Redis com persistência, ou Temporal.

**Cenários de falha a executar para cada opção:** matar o worker no meio da tarefa; reiniciar o Redis sem e com AOF; entrega duplicada; tarefa agendada no futuro; limite de concorrência por tenant (2); justiça entre tenants sob rajada de um deles; reinício do Dispatcher; relógio dessincronizado; tarefa humana aguardando aprovação por dias.

**Métricas:** RAM ociosa e sob carga; latência de enfileiramento→início; throughput de 100 tarefas/min; complexidade de código e de operação; observabilidade nativa.

**Hipótese de partida:** PostgreSQL do Control Plane como fonte de verdade (estado explícito, auditável, transacional com o `outbox`), runtime consome por *pull* com lease; Redis só para limites de taxa e pub/sub efêmero; Temporal reavaliado se fluxos com muitos passos/compensações justificarem.

**Critérios de aceite**
- [ ] ADR-021 com tabela de resultados dos cenários por opção.
- [ ] Opção escolhida não perde nem duplica efeito em nenhum cenário de falha (com idempotência de consumidor).
- [ ] Gatilho objetivo de reconsideração (ex.: > N tarefas/s, > M passos por fluxo) registrado.

---

<a id="ent-dec-008"></a>
## ENT-DEC-008 — PoC do framework de agentes (Pydantic AI vs LangGraph)

**Sprint** S03 · **Prioridade** Alta · **Tam.** M · **Risco** ALTO · **Tipo** Spike
**Depende de:** DEC-004, DEC-007 · **Bloqueia:** RUN-004 · **ADR:** ADR-022
**Referências:** ADR-005, ADR-012, seção 8.

**Objetivo.** Escolher o framework com base no mesmo agente de referência implementado nos dois.

**Agente de referência:** recebe tarefa, consulta documento via ferramenta (simulada), chama uma ferramenta de escrita que exige aprovação humana, respeita orçamento de tokens e é cancelável.

**Critérios eliminatórios**
- Permite interceptar **toda** chamada de ferramenta antes da execução e roteá-la a um cliente do Tool Gateway (nenhuma ferramenta executa localmente por padrão).
- Não oferece nem exige execução de código/shell arbitrário no processo do runtime.
- Permite contabilizar tokens por chamada via hook (AI Gateway é a fonte, mas o framework deve propagar `run_id`/`agent_id`).

**Critérios comparativos:** persistência/retomada de estado após reinício; suporte a pausa para aprovação; testabilidade com modelo falso; tracing OpenTelemetry; tamanho de dependências e RAM; maturidade e cadência de releases; superfície de dependências transitivas (cadeia de suprimentos).

**Critérios de aceite**
- [ ] ADR-022 aceito com tabela de critérios e links para os dois protótipos descartáveis.
- [ ] Teste adversarial comum: modelo falso emite chamada com `tenant_id` alheio — o gancho de roteamento a rejeita independentemente do framework.
- [ ] Interface interna (`AgentEngine`) definida de modo que trocar de framework não altere contratos do Tool Gateway.

---

<a id="ent-dec-009"></a>
## ENT-DEC-009 — Provedor e modelo de autorização do object storage

**Sprint** S02 · **Prioridade** Alta · **Tam.** S · **Risco** ALTO · **Tipo** Spike
**Depende de:** DEC-006 · **Bloqueia:** DAT-006, RAG-001 · **ADR:** ADR-023
**Referências:** ADR-008, seção 10 ("Storage"), SEC-08, SEC-14.

**Objetivo.** Escolher o provedor S3-compatível e o modelo de autorização que garanta que credencial/URL de A não acessa objeto de B.

**Decisão central:** o provedor permite criar **bucket e credencial restrita ao bucket via API**, de forma automatizável pelo provisioner? Se sim → bucket por tenant. Se não → bucket compartilhado com prefixo por tenant, e **somente o serviço de storage da plataforma** assina URLs (o runtime nunca recebe credencial de storage; solicita URL ao Tool Gateway).

**Opções:** MinIO local (desenvolvimento), Cloudflare R2, Backblaze B2, AWS S3, S3 do provedor da VPS.

**Critérios:** API de criação de chaves escopadas; políticas por prefixo; criptografia em repouso; *versioning* e *object lock* para backup; região/LGPD; custo de egresso; limites de requisição; consistência.

**Critérios de aceite**
- [ ] ADR-023 aceito; PoC cria bucket/chave de tenant A e prova `AccessDenied` ao ler objeto de B (SEC-08).
- [ ] Procedimento de revogação de chave de A sem afetar B.
- [ ] Custos estimados para 5 tenants incluídos (sem proposta comercial).

---

<a id="ent-dec-010"></a>
## ENT-DEC-010 — Stack de telemetria e política de redação/retenção

**Sprint** S04 · **Prioridade** Média · **Tam.** S · **Risco** MÉDIO · **Tipo** Spike
**Depende de:** FND-009 · **Bloqueia:** OBS-001 · **ADR:** ADR-024
**Referências:** ADR seções 8.2, 10 ("Logs"), 16 item 5.

**Objetivo.** Escolher onde logs, métricas e traces vivem, com segregação por tenant e orçamento de RAM compatível com a VPS.

**Opções:** Grafana LGTM auto-hospedado (Loki, Prometheus, Tempo) vs. serviço gerenciado; coletor OpenTelemetry em ambos.

**Pontos:** multi-tenancy do armazenamento de logs (cabeçalho de tenant, isolamento de consulta); campos permitidos (allowlist) e campos proibidos (prompts, documentos, tokens, chaves); retenção por classe de dado; quem pode consultar o quê (admin auditado); RAM de Loki+Prometheus+Tempo+Grafana medida em carga de 5 tenants.

**Critérios de aceite**
- [ ] ADR-024 aceito, com *allowlist* de campos de log e política de retenção.
- [ ] Medição de RAM/disco dentro do orçamento (ou decisão de mover para host separado/serviço externo).
- [ ] Prova de que consulta com identidade do tenant A não retorna logs de B.

---

<a id="ent-dec-011"></a>
## ENT-DEC-011 — LGPD e provedores de LLM (processo + decisões)

**Sprint** S04 · **Prioridade** Alta · **Tam.** S · **Risco** ALTO · **Tipo** Decisão não-técnica (produto/jurídico)
**Depende de:** — · **Bloqueia:** AIG-001 (configuração de roteamento), GATE-007
**Referências:** ADR seções 8.2, 16 itens 3 e 9; Lei 13.709/2018.

**Objetivo.** Transformar a exigência "avaliar LGPD" em decisões e requisitos técnicos verificáveis. **Não constitui aconselhamento jurídico; exige revisão do responsável legal/DPO.**

**Entregáveis**
- Mapa de papéis (controlador/operador) para o NÚCLEOS e para o cliente; lista de subprocessadores (LLM, hospedagem, storage, e-mail, pagamentos) com país de processamento.
- Para cada provedor de LLM: política de retenção/treinamento, existência de *zero data retention* e como forçá-la via gateway (parâmetros de roteamento do OpenRouter e flags do provedor — **verificar na documentação vigente na data**), DPA disponível.
- Requisitos técnicos derivados (viram critérios de aceite de AIG-001/RAG-004/PRV-010): minimização de dados no prompt, bloqueio de provedores sem política aceitável, prazo de retenção, fluxo de direitos do titular (acesso, correção, eliminação), registro de incidentes.
- Lista de bloqueios para ativação do 1º cliente real.

**Critérios de aceite**
- [ ] Documento com decisões e requisitos técnicos revisado por responsável legal indicado.
- [ ] Cada requisito técnico aponta para ticket que o implementa.

---

<a id="ent-dec-012"></a>
## ENT-DEC-012 — Provedor de pagamento/assinatura

**Sprint** S07 · **Prioridade** Média · **Tam.** S · **Risco** MÉDIO · **Tipo** Spike
**Depende de:** — · **Bloqueia:** nada no MVP (usa simulador) · **ADR:** ADR-026
**Referências:** ADR seção 11 passo 1.

**Objetivo.** Escolher o provedor e definir o contrato do adaptador de eventos de assinatura. O MVP usa um **simulador** com o mesmo contrato, portanto a escolha não bloqueia o gate.

**Pontos:** assinatura de webhook (HMAC/timestamp), eventos (assinatura criada/atualizada/cancelada, falha de pagamento, estorno), reenvio e ordem não garantida, identificadores idempotentes, ambiente sandbox, impostos/NF (fora do escopo), regras de *dunning* (falha de pagamento **não** apaga dados).

**Critérios de aceite**
- [ ] ADR-026 com provedor recomendado e contrato `SubscriptionEvent` (JSON Schema) compatível com o simulador.
- [ ] Matriz evento do provedor → transição do estado do tenant.

---

<a id="ent-dec-013"></a>
## ENT-DEC-013 — Acesso da UI aos dados do tenant e posição do Tool Gateway

**Sprint** S03 · **Prioridade** Crítica · **Tam.** M · **Risco** CRÍTICO · **Tipo** Spike/Decisão arquitetural
**Depende de:** DEC-004 · **Bloqueia:** RUN-001, TGW-001, TGW-003, WEB-003, WEB-004 · **ADR:** ADR-025
**Referências:** ADR seção 4 (diagrama), 6.1 (item 9), 8.2 ("Tool Gateway é a única via"), 14.

**Lacuna encontrada.** O ADR diz que o banco do Control Plane guarda só metadados mínimos e que o Tool Gateway é a única via de acesso a banco/RAG/arquivos, mas não define (1) como a UI lê dados privados do tenant (conversas, documentos, histórico de execuções) e (2) onde o Tool Gateway roda e quais credenciais de banco ele detém. O diagrama sugere "Tool Gateway: credenciais A" por tenant, enquanto a seção 14 o lista como serviço único.

**Opções para (1) leitura da UI**
- A. Control Plane faz *proxy* para uma **Tenant API** exposta pelo runtime apenas na rede interna do tenant (autenticada por token de serviço com *claims* do usuário já autorizado).
- B. Control Plane com papel de leitura em cada banco de tenant (amplia o raio de ataque do CP).
- C. Projeção de dados selecionados do tenant para o banco de controle (viola "metadados mínimos").

**Opções para (2) Tool Gateway**
- X. Serviço compartilhado único com credenciais de todos os tenants (alvo de alto valor).
- Y. **Sidecar por tenant** (mesma imagem), com as credenciais de integração e o papel de banco de ferramentas **somente** daquele tenant; política vinda do Control Plane como *bundle* assinado.

**Hipótese de partida:** 1-A e 2-Y. Consequências a medir/registrar: o CP precisa alcançar a rede de cada tenant (somente CP→runtime, nunca tenant↔tenant); RAM adicional por sidecar (impacta a reserva da seção 4.2); superfície do CP como ponto de comprometimento.

**Entregáveis:** ADR-025; diagrama de componentes atualizado; matriz "quem detém qual credencial" (runtime, sidecar, CP, provisioner, AI Gateway); lista de papéis PostgreSQL por tenant (`owner`, `migrator`, `app`, `tools`) com privilégios exatos; impacto nos SEC-02/05/09.

**Critérios de aceite**
- [ ] ADR-025 aceito; nenhum componente compartilhado detém credencial de banco de múltiplos tenants.
- [ ] Orçamento de RAM do cenário A revisado com o sidecar.
- [ ] Fluxo de leitura da UI descrito ponta a ponta com pontos de autorização enumerados.
