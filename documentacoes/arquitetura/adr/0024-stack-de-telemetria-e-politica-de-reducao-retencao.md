# ADR-024 — Stack de telemetria e política de redação/retenção

- **Status:** Proposto (somente o usuário pode torná-lo Aceito)
- **Data:** 2026-10-26
- **Decisores:** usuário (pendente)
- **Origem:** [ENT-DEC-010](../../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-010); [registro da entrega](../../observabilidade/2026-10-26-dec-010-telemetria.md); [ADR consolidado, seções 8.2, 10 e 16.5](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md); [threat model, F14](../../seguranca/2026-10-25-threat-model-stride-por-fronteira.md) (T-F14-S/T/R/I/E, RISK-005)

## Contexto

O MVP roda em uma VPS de referência de 8 vCPU e 24 GB de RAM (cenário A, ADR-010), com runtime por tenant (ADR-002). A biblioteca de FND-009 (`packages/observability`, `packages/observability-py`) já emite logs JSON com campos fixos, redação por allowlist, métricas RED sem rótulo de tenant e OTLP/HTTP opcional. Falta decidir onde logs, métricas e traces vivem, como são segregados por tenant, o que pode ser logado, por quanto tempo é retido e quem consulta. A observabilidade é fonte de vazamento (ADR consolidado 16.5; RISK-005).

## Problema

Qual stack de telemetria o MVP adota, com segregação de consulta por tenant, allowlist de campos, retenção por classe e consumo de RAM compatível com a VPS?

## Decisão

(Proposta; as marcas **[HUMANO]** dependem de decisão do usuário, ver "Quando revisar" e o registro da entrega.)

1. **Stack:** Grafana LGTM auto-hospedado no mesmo host do MVP, em containers Compose: **Loki** (logs), **Tempo** (traces), **Prometheus** (métricas de plataforma) e **Grafana** (painéis, só para operadores), com versões fixadas por tag/digest. Serviços exportam OTLP/HTTP (já suportado por FND-009). O coletor OpenTelemetry é **opcional** e não foi exercitado no PoC.
2. **Segregação por tenant no armazenamento:** Loki com `auth_enabled: true` e Tempo com `multitenancy_enabled: true`; o tenant é o `X-Scope-OrgID`. Esse header **nunca** vem do cliente: um **gateway de telemetria** deriva o tenant de uma credencial por tenant, descarta o header recebido, remove `Authorization` e escreve o valor confiável. Loki, Tempo, Prometheus e Grafana **não publicam porta**; só o gateway (e Grafana, em `127.0.0.1`/VPN) é alcançável. O gateway expõe apenas rotas em allowlist (push/consulta de logs e traces); `/config`, `/metrics` e a API de deleção ficam fora.
3. **Métricas:** Prometheus sem multi-tenancy nativa neste desenho. Métricas são de plataforma e **sem rótulo de tenant** (consistente com FND-009, que rejeita `tenant_id` como label). Consumo por tenant (custo, tokens) vai para o banco conforme ADR-015, não para métricas. Se for exigida métrica por tenant, é outra decisão **[HUMANO]** (Prometheus por tenant, ou backend multi-tenant).
4. **Quem consulta (T-F14-R/E):** tenants **não** consultam telemetria bruta no MVP; a consulta é feita pela plataforma em nome do tenant, pelo gateway, com a credencial do tenant. Operadores usam papel `admin` do gateway (consulta multi-tenant do Loki, somente leitura de logs), com linha de auditoria por requisição (papel, tenants, método, caminho, status; sem token e sem corpo da consulta). Traces: o papel `admin` é recusado no PoC (Tempo 2.x não foi usado com consulta federada). Painéis administrativos só por VPN/`127.0.0.1`.
5. **Allowlist de campos de log (FND-009 é a implementação de referência).**
   - *Campos fixos permitidos:* `ts, level, service, version, env, trace_id, span_id, correlation_id, tenant_id, actor_type, event`.
   - *Chaves de `data` permitidas por padrão:* `method, route, status, duration_ms, check, job_type` (strings só com validador por chave).
   - *Extensões propostas, numéricas (sem texto livre):* `tokens_in, tokens_out, cost_micros, queue_wait_ms, retries`; strings com validador: `error_code` (`^[A-Z0-9_]{1,64}$`), `model` (`^[A-Za-z0-9._/:-]{1,64}$`). Qualquer chave nova exige PR com validador e revisão de segurança **[HUMANO: aprovar a lista]**.
   - *Proibidos sempre (redigidos ou descartados):* prompts, conteúdo de documentos/mensagens, tokens, cookies, `Authorization`, chaves de API, senhas, segredos, e-mails e dados pessoais, headers, query string e corpo de requisição, mensagem de exceção (só o nome da classe). Chaves fora da allowlist são descartadas e contadas em `_dropped`.
   - *Rótulos do Loki (cardinalidade):* somente `service`, `level`, `class` (classe de retenção). `tenant_id` fica no corpo e no org id; **nunca** como rótulo.
6. **Retenção por classe (valores propostos, **[HUMANO]** aprovar com base legal/LGPD, ver ENT-DEC-011):**

   | Classe | Conteúdo | Retenção proposta | Mecanismo |
   | --- | --- | --- | --- |
   | `debug` | logs de depuração | 3 dias | Loki `retention_stream` por `{class="debug"}` |
   | `app` (padrão) | logs operacionais redigidos | 14 dias | Loki `retention_period` |
   | `audit` | trilha de auditoria de segurança | 365 dias | Loki `retention_stream` por `{class="audit"}` |
   | traces | spans | 7 dias | Tempo `block_retention` |
   | métricas | séries de plataforma | 15 dias | Prometheus `--storage.tsdb.retention.time` |

   O PoC provou que o Loki sobe com a configuração de retenção e compactação habilitadas; **não** provou a expiração efetiva (exige esperar o ciclo do compactor). Logs de tenant offboarded permanecem até expirar (RISK-014/T-F19-I2); janela máxima **[HUMANO]**.
7. **Orçamento de RAM/disco:** a medição do PoC (5 tenants, ver abaixo) fica muito abaixo de um teto de **2 GiB** para a stack inteira, que é uma **proposta** **[HUMANO]** (não há orçamento declarado nas fontes). O PoC é pequeno demais para dimensionar produção; reavaliar com carga real (gatilhos abaixo).

## Evidência do PoC (ambiente descartável em 127.0.0.1, sem dados reais; saída completa no registro)

- **Isolamento (AC-3):** 33/33 verificações. Cada um dos 5 tenants lê só linhas próprias (3002 linhas cada, `tenant_id` conferido); A filtrando por `tenant-b` obtém 0; A consultando todo o conjunto (115 mil linhas) não recebe linha com `tenant_id` alheio; A forjando `X-Scope-OrgID: tenant-b` ou `tenant-a|tenant-b` continua vendo só `tenant-a`; sem token ou token desconhecido: 401; `/loki/config` e API de deleção: 404 no gateway. Traces: A lê o próprio (200), B lê o seu (controle positivo, 200), A pedindo o trace de B: 404, inclusive forjando o header.
- **Redação ponta a ponta:** linhas geradas pela biblioteca real `nucleos_observability` com sentinelas em `prompt, content, token, authorization, api_key` e em chave fora da allowlist (`email`); filtro no servidor sobre todas as linhas: 0 ocorrências. Controle negativo: uma linha que burlou a redação é encontrada pelo mesmo filtro.
- **RAM (AC-2), `docker stats --no-stream`, após ~115 mil linhas de log (5 tenants) e 250 spans:** Loki 147 MiB, Grafana 257,4 MiB, Tempo 33,1 MiB, Prometheus 41 MiB, gateway 2,3 MiB; soma ≈ 481 MiB (ocioso antes da carga ≈ 241 MiB). Disco: Loki 64.064 KiB, Tempo 236 KiB, Prometheus 168 KiB. Limitações: linhas sintéticas repetitivas (compressão otimista), carga curta, sem consultas concorrentes de Grafana, host de 8 GiB e não a VPS, sem coletor OTel, sem pico medido.

## Alternativas

| Alternativa | Por que foi considerada | Por que não foi escolhida |
| --- | --- | --- |
| Serviço gerenciado de observabilidade (ex.: nuvem do Grafana ou equivalente) | Zero operação e sem RAM local | **Não avaliada:** nenhuma fonte de preço, residência de dados ou DPA foi consultada; envia telemetria (mesmo redigida) a terceiro, o que depende de ENT-DEC-011 e do mapa de subprocessadores. Fica como opção se o orçamento de RAM/operação estourar. |
| Host separado só para telemetria | Isola falha e RAM do host dos tenants | Custo adicional; não necessário pela medição do PoC. Reavaliar nos gatilhos. |
| Um backend por tenant | Isolamento mais forte | Multiplica RAM por tenant; contraria o orçamento do MVP. |
| Prometheus + Loki apenas (sem Tempo) | Menos RAM | Perde traces (FND-009 já os emite); Tempo mediu ~33 MiB. |
| Outros stacks (ELK/OpenSearch, SigNoz, etc.) | Alternativas conhecidas | **Não avaliados** (sem PoC nem fonte consultada). |

## Benefícios

Isolamento por tenant provado no armazenamento de logs e traces com identidade derivada da credencial; custo de RAM baixo na medição; reutiliza OTLP e a redação de FND-009; sem serviço pago; consultas administrativas auditáveis.

## Trade-offs

- Quatro serviços a operar, atualizar e fazer backup; o gateway vira peça crítica de segurança (se contornado, o header vale).
- Sem métrica por tenant e sem consulta federada de traces.
- Auditoria do PoC é apenas stdout do nginx: não é à prova de adulteração nem tem destino externo.
- Isolamento depende de rede: Loki/Tempo/Prometheus alcançáveis por outro container da mesma rede aceitam o header de qualquer cliente. Rede dedicada e política de rede (ADR-014) são obrigatórias.
- Redação e allowlist continuam sendo a única defesa contra dado sensível no log; o armazenamento não filtra conteúdo.

## Consequências

OBS-001 implementa o gateway de produção, autenticação por tenant, auditoria durável, retenção e painéis; FND-006 valida `OTEL_*`; threat model F14 ganha controle para T-F14-I/R/E (hoje "sem controle no backlog" para S/T); PRV-010 consome a janela de retenção; ENT-DEC-011 decide o que pode ser logado do ponto de vista LGPD. Serviços que precisem logar string livre devem declarar validador na allowlist. Incidente de segredo em log exige procedimento de purga (não coberto: a deleção do Loki não é exposta).

## Quando revisar

Reabrir se: RAM da stack > 2 GiB ou > 10% da VPS em carga real; mais de ~50 tenants ou volume de logs que torne o disco relevante; exigência contratual/LGPD de residência, retenção ou eliminação que o desenho não atenda; necessidade de métrica por tenant; mudança do orçamento ou do cenário A; versão major de Loki/Tempo/Grafana; qualquer vazamento por log (SEC-13).

## Fatos de ferramentas (fonte e data de consulta: 2026-10-26)

- Loki: `auth_enabled: true` é o modo multi-tenant; cada requisição identifica o tenant por `X-Scope-OrgID`; sem o header, 401; consultas multi-tenant exigem `multi_tenant_queries_enabled: true` e `A|B` no header, apenas em endpoints de consulta; push com mais de um tenant retorna 400. Fonte: <https://grafana.com/docs/loki/latest/operations/multi-tenancy/>.
- Tempo: `multitenancy_enabled: true` força o header `X-Scope-OrgID` em todas as requisições e escopa escrita e leitura por tenant; retenção e limites por tenant via arquivo de overrides (campo omitido vira zero, o que pode desligar a retenção). A página não trata consulta entre tenants. Fonte: <https://grafana.com/docs/tempo/latest/operations/multitenancy/>.
- Prometheus: a página de FAQ consultada (<https://prometheus.io/docs/introduction/faq/>) **não** trata multi-tenancy; a afirmação "sem multi-tenancy nativa" deste ADR é, portanto, **não verificada em fonte** e deve ser confirmada na documentação antes de aceitar.
- Versões usadas no PoC (tags estáveis mais recentes vistas na API do Docker Hub, `hub.docker.com/v2/repositories/<imagem>/tags`, consultada em 2026-10-26): `grafana/loki:3.7.9` (atualizada em 2026-10-20), `grafana/tempo:2.10.10` (2026-10-21; a linha 3.x existe e não foi usada), `prom/prometheus:v3.15.1` (2026-10-21), `grafana/grafana:13.2.4` (2026-10-13), `nginx:1.28-alpine` (imagem local). Docker 29.8.1 / Compose v5.5.1 no host do PoC.

## Referências

- Registro: [2026-10-26-dec-010-telemetria.md](../../observabilidade/2026-10-26-dec-010-telemetria.md); saída real: [2026-10-26-dec-010-telemetria-saida-poc.txt](../../observabilidade/2026-10-26-dec-010-telemetria-saida-poc.txt).
- PoC: `infrastructure/docker/poc-telemetria/` (`run-poc.sh`, `poc_telemetria.py`, `compose.yml`, `loki.yaml`, `tempo.yaml`, `prometheus.yml`, `nginx.conf.tpl`).
- Base: [FND-009](../../observabilidade/2026-10-25-fnd-009-baseline-observabilidade.md), [ADR-015](0015-custos-por-tenant-e-por-agente-obrigatoriamente.md), [ADR-014](0014-nenhum-acesso-de-rede-entre-tenants-por.md), [ADR-010](0010-docker-compose-no-mvp-com-especificacao-declarativa.md).
- Lesson: [03 - Isolamento de telemetria por tenant](../../../lessons/03%20-%20Isolamento%20de%20telemetria%20por%20tenant.md).
