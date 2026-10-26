# DEC-010 - Diffs reais da tarefa (2026-10-26)

Registro principal: [2026-10-26-dec-010-telemetria.md](2026-10-26-dec-010-telemetria.md). Contem o diff do commit de codigo/configuracao. Os arquivos em `documentacoes/` e `lessons/` (ADR-024, registro, saida do PoC, lesson, indices) nao entram no patch para evitar recursao e estao listados no registro. Nenhum segredo foi redigido (o PoC gera tokens aleatorios em tempo de execucao e nao os versiona nem imprime).

## Commit 690e1e029c10d17d113dee4c0e49dec8032272ba

Mensagem: `feat(infra): PoC efemero de telemetria LGTM com isolamento por tenant (DEC-010)`

```diff
diff --git a/infrastructure/docker/poc-telemetria/compose.yml b/infrastructure/docker/poc-telemetria/compose.yml
new file mode 100644
index 0000000..2aa54cc
--- /dev/null
+++ b/infrastructure/docker/poc-telemetria/compose.yml
@@ -0,0 +1,67 @@
+# PoC descartavel DEC-010 (ADR-024). Somente 127.0.0.1, sem dados reais; destruido por run-poc.sh.
+name: poc-telemetria
+
+x-limits: &limits
+  restart: "no"
+
+services:
+  gateway:
+    <<: *limits
+    image: nginx:1.28-alpine
+    volumes:
+      - ${POC_TMP}/nginx.conf:/etc/nginx/nginx.conf:ro
+    ports:
+      - "127.0.0.1:${POC_GATEWAY_PORT:-13100}:8080"
+    depends_on: [loki, tempo]
+    networks: [telemetria]
+
+  loki:
+    <<: *limits
+    image: grafana/loki:3.7.9
+    command: ["-config.file=/etc/loki/loki.yaml"]
+    volumes:
+      - ./loki.yaml:/etc/loki/loki.yaml:ro
+      - loki-data:/loki
+    networks: [telemetria]
+
+  tempo:
+    <<: *limits
+    image: grafana/tempo:2.10.10
+    command: ["-config.file=/etc/tempo/tempo.yaml"]
+    volumes:
+      - ./tempo.yaml:/etc/tempo/tempo.yaml:ro
+      - tempo-data:/var/tempo
+    networks: [telemetria]
+
+  prometheus:
+    <<: *limits
+    image: prom/prometheus:v3.15.1
+    command:
+      - --config.file=/etc/prometheus/prometheus.yml
+      - --storage.tsdb.retention.time=15d
+    volumes:
+      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
+      - prom-data:/prometheus
+    networks: [telemetria]
+
+  grafana:
+    <<: *limits
+    image: grafana/grafana:13.2.4
+    environment:
+      GF_SECURITY_ADMIN_PASSWORD__FILE: /run/poc/grafana-admin
+      GF_ANALYTICS_REPORTING_ENABLED: "false"
+      GF_ANALYTICS_CHECK_FOR_UPDATES: "false"
+    volumes:
+      - ${POC_TMP}/grafana-admin:/run/poc/grafana-admin:ro
+    ports:
+      - "127.0.0.1:${POC_GRAFANA_PORT:-13000}:3000"
+    networks: [telemetria]
+
+volumes:
+  loki-data:
+  tempo-data:
+  prom-data:
+
+networks:
+  telemetria:
+    driver: bridge
diff --git a/infrastructure/docker/poc-telemetria/loki.yaml b/infrastructure/docker/poc-telemetria/loki.yaml
new file mode 100644
index 0000000..805de6b
--- /dev/null
+++ b/infrastructure/docker/poc-telemetria/loki.yaml
@@ -0,0 +1,48 @@
+auth_enabled: true
+server:
+  http_listen_port: 3100
+  log_level: warn
+common:
+  instance_addr: 127.0.0.1
+  path_prefix: /loki
+  replication_factor: 1
+  ring:
+    kvstore:
+      store: inmemory
+  storage:
+    filesystem:
+      chunks_directory: /loki/chunks
+      rules_directory: /loki/rules
+schema_config:
+  configs:
+    - from: "2024-04-01"
+      store: tsdb
+      object_store: filesystem
+      schema: v13
+      index:
+        prefix: index_
+        period: 24h
+querier:
+  multi_tenant_queries_enabled: true
+compactor:
+  working_directory: /loki/compactor
+  retention_enabled: true
+  delete_request_store: filesystem
+limits_config:
+  # Classes de retencao PROPOSTAS (ADR-024); valores dependem de decisao humana.
+  retention_period: 336h
+  retention_stream:
+    - selector: '{class="debug"}'
+      priority: 1
+      period: 72h
+    - selector: '{class="audit"}'
+      priority: 2
+      period: 8760h
+  max_label_names_per_series: 8
+  max_global_streams_per_user: 2000
+  ingestion_rate_mb: 4
+  ingestion_burst_size_mb: 8
+  reject_old_samples: true
+  reject_old_samples_max_age: 168h
+analytics:
+  reporting_enabled: false
diff --git a/infrastructure/docker/poc-telemetria/nginx.conf.tpl b/infrastructure/docker/poc-telemetria/nginx.conf.tpl
new file mode 100644
index 0000000..f047950
--- /dev/null
+++ b/infrastructure/docker/poc-telemetria/nginx.conf.tpl
@@ -0,0 +1,48 @@
+# Gateway de telemetria do PoC: a identidade do tenant vem do token, nunca de header do cliente.
+worker_processes 1;
+pid /tmp/nginx.pid;
+events { worker_connections 256; }
+http {
+  log_format audit 'ts=$time_iso8601 role=$role tenant=$tenant method=$request_method path=$uri status=$status';
+  access_log /dev/stdout audit;
+  error_log /dev/stderr warn;
+  map $http_authorization $tenant {
+    default "";
+    "Bearer @TOKEN_A@" "tenant-a";
+    "Bearer @TOKEN_B@" "tenant-b";
+    "Bearer @TOKEN_C@" "tenant-c";
+    "Bearer @TOKEN_D@" "tenant-d";
+    "Bearer @TOKEN_E@" "tenant-e";
+    "Bearer @TOKEN_ADMIN@" "tenant-a|tenant-b|tenant-c|tenant-d|tenant-e";
+  }
+  map $tenant $role {
+    default "tenant";
+    "" "none";
+    "~\|" "admin";
+  }
+  server {
+    listen 8080;
+    # Tenants comuns nao podem consultar com identidade multipla; so o papel admin (auditado em stdout).
+    if ($tenant = "") { return 401; }
+    location ~ ^/loki/api/v1/(push|query|query_range|labels|label/[a-z_]+/values|series)$ {
+      proxy_set_header X-Scope-OrgID $tenant;
+      proxy_set_header Authorization "";
+      proxy_pass http://loki:3100;
+    }
+    location ~ ^/tempo/api/(traces/[0-9a-f]+|search)$ {
+      if ($role = "admin") { return 403; }
+      rewrite ^/tempo/(.*)$ /$1 break;
+      proxy_set_header X-Scope-OrgID $tenant;
+      proxy_set_header Authorization "";
+      proxy_pass http://tempo:3200;
+    }
+    location = /otlp/v1/traces {
+      if ($role = "admin") { return 403; }
+      rewrite ^/otlp/(.*)$ /$1 break;
+      proxy_set_header X-Scope-OrgID $tenant;
+      proxy_set_header Authorization "";
+      proxy_pass http://tempo:4318;
+    }
+    location / { return 404; }
+  }
+}
diff --git a/infrastructure/docker/poc-telemetria/poc_telemetria.py b/infrastructure/docker/poc-telemetria/poc_telemetria.py
new file mode 100644
index 0000000..d282e61
--- /dev/null
+++ b/infrastructure/docker/poc-telemetria/poc_telemetria.py
@@ -0,0 +1,317 @@
+# ruff: noqa: E501  (PoC descartavel: mensagens de verificacao em linha unica, legiveis na saida)
+"""Driver do PoC DEC-010: ingestao de 5 tenants, redacao ponta a ponta e isolamento de consulta.
+
+Usa a biblioteca real `nucleos_observability` (FND-009) para produzir as linhas de log. Nao imprime
+tokens nem corpos de log: so contagens e veredictos. Sai com codigo 1 se alguma verificacao falhar.
+"""
+
+import io
+import json
+import re
+import secrets
+import sys
+import time
+import urllib.error
+import urllib.request
+from typing import Any
+
+from nucleos_observability import Logger, RequestContext, set_trusted_tenant, use_context
+
+TENANTS = ["tenant-a", "tenant-b", "tenant-c", "tenant-d", "tenant-e"]
+LINES_PER_TENANT = 3000
+BULK_LINES_PER_TENANT = 20000  # carga para medir RAM/disco; verificada por filtro no servidor
+BATCH = 100
+FORBIDDEN_SENTINELS = {
+    "prompt": "SENTINEL-PROMPT-",
+    "content": "SENTINEL-DOC-",
+    "token": "SENTINEL-TOKEN-",
+    "authorization": "SENTINEL-AUTH-",
+    "api_key": "SENTINEL-APIKEY-",
+    "email": "SENTINEL-EMAIL-",  # chave fora da allowlist
+}
+results: list[tuple[str, bool]] = []
+
+
+def check(name: str, ok: bool) -> None:
+    results.append((name, ok))
+    print(f"[{'OK' if ok else 'FALHA'}] {name}")
+
+
+def call(
+    base: str,
+    path: str,
+    token: str | None,
+    method: str = "GET",
+    body: bytes | None = None,
+    extra: dict[str, str] | None = None,
+) -> tuple[int, bytes]:
+    headers = dict(extra or {})
+    if token is not None:
+        headers["Authorization"] = f"Bearer {token}"
+    if body is not None:
+        headers["Content-Type"] = "application/json"
+    req = urllib.request.Request(base + path, data=body, headers=headers, method=method)  # noqa: S310
+    try:
+        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
+            return resp.status, resp.read()
+    except urllib.error.HTTPError as err:
+        return err.code, err.read()
+
+
+def make_lines(tenant: str, n: int, run_id: str) -> tuple[list[str], dict[str, str]]:
+    """Produz n linhas pelo Logger real; devolve tambem os sentinelas deste tenant."""
+    sentinels = {k: f"{v}{tenant}-{run_id}" for k, v in FORBIDDEN_SENTINELS.items()}
+    buf = io.StringIO()
+    logger = Logger(
+        "poc-service",
+        "0.0.0",
+        "poc",
+        allowlist={"tokens_in": None, "error_code": re.compile(r"^[A-Z0-9_]{1,64}$")},
+        stream=buf,
+    )
+    with use_context(RequestContext(correlation_id=f"corr-{tenant}-{run_id}")):
+        set_trusted_tenant(tenant, "user")
+        for i in range(n):
+            data: dict[str, Any] = {
+                "method": "POST",
+                "route": "/v1/runs",
+                "status": 200,
+                "duration_ms": i % 500,
+                "tokens_in": i % 900,
+                "error_code": "NONE",
+                **sentinels,
+            }
+            logger.log("info", "http.request", data)
+    return buf.getvalue().splitlines(), sentinels
+
+
+def push(base: str, token: str, lines: list[str], labels: dict[str, str]) -> int:
+    base_ns = time.time_ns() - len(lines) * 1000
+    values = [[str(base_ns + i * 1000), line] for i, line in enumerate(lines)]
+    body = json.dumps({"streams": [{"stream": labels, "values": values}]}).encode()
+    status, _ = call(base, "/loki/api/v1/push", token, "POST", body)
+    return status
+
+
+def loki_query(base: str, token: str, query: str, extra: dict[str, str] | None = None) -> list[str]:
+    from urllib.parse import quote
+
+    status, raw = call(
+        base,
+        f"/loki/api/v1/query_range?limit=5000&since=1h&query={quote(query)}",
+        token,
+        extra=extra,
+    )
+    if status != 200:
+        return [f"__HTTP_{status}__"]
+    out: list[str] = []
+    for stream in json.loads(raw)["data"]["result"]:
+        out.extend(v[1] for v in stream["values"])
+    return out
+
+
+def span_payload(trace_id: str, tenant: str) -> bytes:
+    now = time.time_ns()
+    span = {
+        "traceId": trace_id,
+        "spanId": secrets.token_hex(8),
+        "name": "poc.span",
+        "kind": 2,
+        "startTimeUnixNano": str(now - 10_000_000),
+        "endTimeUnixNano": str(now),
+        "attributes": [{"key": "poc.owner", "value": {"stringValue": tenant}}],
+    }
+    return json.dumps(
+        {
+            "resourceSpans": [
+                {
+                    "resource": {
+                        "attributes": [
+                            {"key": "service.name", "value": {"stringValue": "poc-service"}}
+                        ]
+                    },
+                    "scopeSpans": [{"scope": {"name": "poc"}, "spans": [span]}],
+                }
+            ]
+        }
+    ).encode()
+
+
+def main() -> int:
+    base = sys.argv[1]
+    with open(sys.argv[2], encoding="utf-8") as fh:
+        tokens: dict[str, str] = json.load(fh)
+    run_id = secrets.token_hex(4)
+    sentinels: dict[str, dict[str, str]] = {}
+
+    # 1. Ingestao: 5 tenants x LINES_PER_TENANT linhas em lotes, classes de retencao distintas.
+    for tenant in TENANTS:
+        lines, sentinels[tenant] = make_lines(tenant, LINES_PER_TENANT, run_id)
+        statuses = []
+        for off in range(0, len(lines), BATCH):
+            chunk = lines[off : off + BATCH]
+            cls = "debug" if (off // BATCH) % 3 == 0 else "app"
+            statuses.append(
+                push(
+                    base,
+                    tokens[tenant],
+                    chunk,
+                    {"service": "poc-service", "level": "info", "class": cls},
+                )
+            )
+        statuses.append(
+            push(
+                base,
+                tokens[tenant],
+                lines[:2],
+                {"service": "poc-service", "level": "info", "class": "audit"},
+            )
+        )
+        check(
+            f"ingestao {tenant}: {len(lines)} linhas aceitas (HTTP 204 em todos os lotes)",
+            set(statuses) == {204},
+        )
+        bulk, _ = make_lines(tenant, BULK_LINES_PER_TENANT, run_id)
+        bulk_status = {
+            push(
+                base,
+                tokens[tenant],
+                bulk[o : o + BATCH * 5],
+                {"service": "poc-bulk", "level": "info", "class": "app"},
+            )
+            for o in range(0, len(bulk), BATCH * 5)
+        }
+        check(
+            f"ingestao em massa {tenant}: {len(bulk)} linhas (HTTP 204 em todos os lotes)",
+            bulk_status == {204},
+        )
+
+    # Controle negativo do scanner: linha que burla a redacao deve ser detectada.
+    leak = "SENTINEL-NEG-CONTROL-" + run_id
+    push(
+        base,
+        tokens["tenant-a"],
+        [json.dumps({"event": "bypass", "data": {"x": leak}})],
+        {"service": "poc-bypass", "level": "info", "class": "app"},
+    )
+    time.sleep(3)
+
+    # 2. Redacao ponta a ponta: o filtro roda NO servidor sobre todas as linhas (sem o teto de 5000 por consulta).
+    pattern = "SENTINEL-(PROMPT|DOC|TOKEN|AUTH|APIKEY|EMAIL)-"
+    leaked = loki_query(base, tokens["admin"], f'{{service=~"poc-(service|bulk)"}} |~ "{pattern}"')
+    check(
+        "redacao: 0 linhas com sentinela de campo proibido em poc-service+poc-bulk (5 tenants, 115 mil linhas)",
+        leaked == [],
+    )
+    sample = loki_query(base, tokens["tenant-a"], '{service="poc-service"}')
+    check(
+        "redacao: linhas existem e a chave fora da allowlist foi descartada (_dropped)",
+        any('"_dropped"' in x for x in sample),
+    )
+    check(
+        "redacao: campo permitido (tokens_in) chegou ao Loki",
+        any('"tokens_in"' in x for x in sample),
+    )
+    found = loki_query(base, tokens["admin"], f'{{service="poc-bypass"}} |= "{leak}"')
+    check(
+        "controle negativo: o mesmo filtro encontra o sentinela de uma linha que burlou a redacao",
+        len(found) == 1,
+    )
+    audit_view = loki_query(base, tokens["admin"], '{service="poc-service",class="audit"}')
+    check(
+        "admin (consulta federada auditada) enxerga os 5 tenants",
+        {json.loads(x).get("tenant_id") for x in audit_view} == set(TENANTS),
+    )
+
+    # 3. Isolamento de consulta de logs.
+    for tenant in TENANTS:
+        own = loki_query(base, tokens[tenant], '{service="poc-service"}')
+        owners = {json.loads(line).get("tenant_id") for line in own}
+        check(
+            f"isolamento logs {tenant}: so enxerga linhas proprias ({len(own)} linhas)",
+            len(own) > 0 and owners == {tenant},
+        )
+    seen_b = loki_query(base, tokens["tenant-a"], '{service="poc-service"} |= "tenant-b"')
+    check("isolamento logs: A filtrando por 'tenant-b' obtem 0 linhas", seen_b == [])
+    forged = loki_query(
+        base, tokens["tenant-a"], '{service="poc-service"}', extra={"X-Scope-OrgID": "tenant-b"}
+    )
+    forged_owners = {json.loads(x).get("tenant_id") for x in forged}
+    check(
+        "isolamento logs: A forjando X-Scope-OrgID=tenant-b continua vendo so tenant-a",
+        forged_owners == {"tenant-a"},
+    )
+    forged_multi = loki_query(
+        base,
+        tokens["tenant-a"],
+        '{service="poc-service"}',
+        extra={"X-Scope-OrgID": "tenant-a|tenant-b"},
+    )
+    check(
+        "isolamento logs: A forjando 'tenant-a|tenant-b' continua vendo so tenant-a",
+        {json.loads(x).get("tenant_id") for x in forged_multi} == {"tenant-a"},
+    )
+    check("sem token -> 401", call(base, "/loki/api/v1/labels", None)[0] == 401)
+    check("token desconhecido -> 401", call(base, "/loki/api/v1/labels", "x" * 32)[0] == 401)
+    check(
+        "rota administrativa do Loki (/loki/config) nao exposta pelo gateway",
+        call(base, "/loki/config", tokens["tenant-a"])[0] == 404,
+    )
+    check(
+        "API de delecao do Loki nao exposta pelo gateway",
+        call(base, "/loki/api/v1/delete", tokens["tenant-a"], "POST")[0] == 404,
+    )
+    foreign = loki_query(
+        base, tokens["tenant-a"], '{service=~"poc-(service|bulk)"} | json | tenant_id != "tenant-a"'
+    )
+    check(
+        "isolamento logs: A consultando tudo (inclui bulk) nao retorna linha com tenant_id alheio",
+        foreign == [],
+    )
+
+    # 4. Isolamento de traces (Tempo).
+    traces: dict[str, str] = {}
+    for tenant in TENANTS:
+        for _ in range(50):
+            tid = secrets.token_hex(16)
+            status, _body = call(
+                base, "/otlp/v1/traces", tokens[tenant], "POST", span_payload(tid, tenant)
+            )
+            if status != 200:
+                check(f"ingestao de traces {tenant}", False)
+                break
+            traces[tenant] = tid
+    time.sleep(2)
+    check("ingestao de traces: 5 tenants x 50 spans aceitos", len(traces) == len(TENANTS))
+    got_own = call(base, f"/tempo/api/traces/{traces['tenant-a']}", tokens["tenant-a"])[0]
+    got_other = call(base, f"/tempo/api/traces/{traces['tenant-b']}", tokens["tenant-a"])[0]
+    got_b_own = call(base, f"/tempo/api/traces/{traces['tenant-b']}", tokens["tenant-b"])[0]
+    check(f"isolamento traces: A le o proprio trace (HTTP {got_own})", got_own == 200)
+    check(
+        f"controle positivo: B le o proprio trace, logo o trace de B existe (HTTP {got_b_own})",
+        got_b_own == 200,
+    )
+    check(
+        f"isolamento traces: A pedindo o trace de B nao obtem o dado (HTTP {got_other})",
+        got_other == 404,
+    )
+    forged_trace = call(
+        base,
+        f"/tempo/api/traces/{traces['tenant-b']}",
+        tokens["tenant-a"],
+        extra={"X-Scope-OrgID": "tenant-b"},
+    )[0]
+    check(
+        f"isolamento traces: A forjando X-Scope-OrgID tambem nao obtem (HTTP {forged_trace})",
+        forged_trace == 404,
+    )
+
+    failed = [n for n, ok in results if not ok]
+    print(
+        f"RESUMO: {len(results) - len(failed)}/{len(results)} verificacoes OK; falhas={len(failed)}"
+    )
+    return 1 if failed else 0
+
+
+if __name__ == "__main__":
+    sys.exit(main())
diff --git a/infrastructure/docker/poc-telemetria/prometheus.yml b/infrastructure/docker/poc-telemetria/prometheus.yml
new file mode 100644
index 0000000..9bde38b
--- /dev/null
+++ b/infrastructure/docker/poc-telemetria/prometheus.yml
@@ -0,0 +1,10 @@
+# Metricas de plataforma sem rotulo de tenant (FND-009 proibe tenant_id em label).
+global:
+  scrape_interval: 15s
+scrape_configs:
+  - job_name: prometheus
+    static_configs: [{targets: ["localhost:9090"]}]
+  - job_name: loki
+    static_configs: [{targets: ["loki:3100"]}]
+  - job_name: tempo
+    static_configs: [{targets: ["tempo:3200"]}]
diff --git a/infrastructure/docker/poc-telemetria/run-poc.sh b/infrastructure/docker/poc-telemetria/run-poc.sh
new file mode 100755
index 0000000..82b2099
--- /dev/null
+++ b/infrastructure/docker/poc-telemetria/run-poc.sh
@@ -0,0 +1,83 @@
+#!/usr/bin/env bash
+# PoC DEC-010 (ADR-024): sobe LGTM + gateway em containers descartaveis (127.0.0.1), mede RAM/disco
+# com 5 tenants, prova isolamento/redacao e destroi tudo ao final (trap). Sem dados reais.
+# Uso (na raiz do repo, com uv no PATH): infrastructure/docker/poc-telemetria/run-poc.sh
+set -euo pipefail
+
+AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
+RAIZ="$(cd "$AQUI/../../.." && pwd)"
+export POC_TMP
+POC_TMP="$(mktemp -d)"
+export POC_GATEWAY_PORT="${POC_GATEWAY_PORT:-13100}"
+export POC_GRAFANA_PORT="${POC_GRAFANA_PORT:-13000}"
+COMPOSE=(docker compose -f "$AQUI/compose.yml")
+
+limpar() {
+  local rc=$?
+  "${COMPOSE[@]}" down -v --remove-orphans --timeout 5 >/dev/null 2>&1 || true
+  rm -rf "$POC_TMP"
+  echo "== limpeza: containers/volumes/rede removidos e segredos temporarios apagados (rc=$rc)"
+  docker ps -a --filter label=com.docker.compose.project=poc-telemetria --format '{{.Names}}' | sed 's/^/RESTO: /' || true
+  exit "$rc"
+}
+trap limpar EXIT
+
+segredo() { openssl rand -hex 16; }
+umask 077
+python3 - "$POC_TMP" <<'PY'
+import json, secrets, sys
+tmp = sys.argv[1]
+names = ["tenant-a", "tenant-b", "tenant-c", "tenant-d", "tenant-e", "admin"]
+tokens = {n: secrets.token_hex(16) for n in names}
+with open(f"{tmp}/tokens.json", "w", encoding="utf-8") as fh:
+    json.dump(tokens, fh)
+PY
+python3 - "$AQUI/nginx.conf.tpl" "$POC_TMP" <<'PY'
+import json, sys
+tpl, tmp = sys.argv[1:3]
+tokens = json.load(open(f"{tmp}/tokens.json", encoding="utf-8"))
+text = open(tpl, encoding="utf-8").read()
+for key in "ABCDE":
+    text = text.replace(f"@TOKEN_{key}@", tokens[f"tenant-{key.lower()}"])
+text = text.replace("@TOKEN_ADMIN@", tokens["admin"])
+open(f"{tmp}/nginx.conf", "w", encoding="utf-8").write(text)
+PY
+segredo > "$POC_TMP/grafana-admin"
+chmod 0644 "$POC_TMP/nginx.conf" "$POC_TMP/grafana-admin"   # leitura pelo usuario do container; efemeros
+
+echo "== versoes (imagens fixadas)"
+grep -h 'image:' "$AQUI/compose.yml" | sed 's/^ *//'
+echo "== subindo (portas somente em 127.0.0.1)"
+"${COMPOSE[@]}" up -d --wait --wait-timeout 120 2>&1 | tail -n 12 || true
+sleep 20
+docker ps --filter label=com.docker.compose.project=poc-telemetria --format '{{.Names}} {{.Status}} {{.Ports}}'
+echo "== portas publicadas (todas devem ser 127.0.0.1)"
+docker ps --filter label=com.docker.compose.project=poc-telemetria --format '{{.Ports}}' | tr ',' '\n' | grep -- '->' | sed 's/^ *//' || true
+if docker ps --filter label=com.docker.compose.project=poc-telemetria --format '{{.Ports}}' | tr ',' '\n' | grep -- '->' | grep -v '127.0.0.1'; then
+  echo "FALHA: porta publicada fora de 127.0.0.1"; exit 1
+fi
+
+medir() {
+  echo "== docker stats ($1)"
+  docker stats --no-stream --format '{{.Name}} mem={{.MemUsage}} cpu={{.CPUPerc}}' \
+    $(docker ps -q --filter label=com.docker.compose.project=poc-telemetria) | sort
+}
+medir "ocioso, antes da carga"
+
+echo "== carga e verificacoes (driver Python usando nucleos_observability real)"
+cd "$RAIZ"
+rc=0
+uv run --frozen --all-packages python "$AQUI/poc_telemetria.py" "http://127.0.0.1:$POC_GATEWAY_PORT" "$POC_TMP/tokens.json" || rc=$?
+sleep 10
+medir "apos carga de 5 tenants"
+
+echo "== disco (KiB) por volume (leitura somente-leitura por container auxiliar efemero)"
+for v in loki-data tempo-data prom-data; do
+  docker run --rm -v "poc-telemetria_$v:/d:ro" nginx:1.28-alpine du -sk /d | sed "s|/d| $v|"
+done
+echo "== auditoria do gateway (consultas admin, sem tokens nem corpo de consulta)"
+docker compose -f "$AQUI/compose.yml" logs --no-log-prefix gateway 2>/dev/null | grep 'role=admin' | sort | uniq -c | sort -rn | head -n 5
+echo "== config de retencao aceita pelo Loki (verify-config) e valores efetivos"
+docker compose -f "$AQUI/compose.yml" exec -T loki /usr/bin/loki -config.file=/etc/loki/loki.yaml -verify-config -print-config-stderr 2>&1 \
+  | grep -E '^ *(retention_period|retention_enabled|- selector|period: (72h|8760h))' | head -n 12 || true
+exit "$rc"
diff --git a/infrastructure/docker/poc-telemetria/tempo.yaml b/infrastructure/docker/poc-telemetria/tempo.yaml
new file mode 100644
index 0000000..125cd74
--- /dev/null
+++ b/infrastructure/docker/poc-telemetria/tempo.yaml
@@ -0,0 +1,24 @@
+multitenancy_enabled: true
+usage_report:
+  reporting_enabled: false
+server:
+  http_listen_port: 3200
+  log_level: warn
+distributor:
+  receivers:
+    otlp:
+      protocols:
+        http:
+          endpoint: 0.0.0.0:4318
+ingester:
+  max_block_duration: 5m
+compactor:
+  compaction:
+    block_retention: 168h
+storage:
+  trace:
+    backend: local
+    wal:
+      path: /var/tempo/wal
+    local:
+      path: /var/tempo/blocks
```
