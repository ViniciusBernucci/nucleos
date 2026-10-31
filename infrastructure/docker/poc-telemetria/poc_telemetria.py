# ruff: noqa: E501  (PoC descartavel: mensagens de verificacao em linha unica, legiveis na saida)
"""Driver do PoC DEC-010: ingestao de 5 tenants, redacao ponta a ponta e isolamento de consulta.

Usa a biblioteca real `nucleos_observability` (FND-009) para produzir as linhas de log. Nao imprime
tokens nem corpos de log: so contagens e veredictos. Sai com codigo 1 se alguma verificacao falhar.
"""

import io
import json
import re
import secrets
import sys
import time
import urllib.error
import urllib.request
from typing import Any

from nucleos_observability import Logger, RequestContext, set_trusted_tenant, use_context

TENANTS = ["tenant-a", "tenant-b", "tenant-c", "tenant-d", "tenant-e"]
LINES_PER_TENANT = 3000
BULK_LINES_PER_TENANT = 20000  # carga para medir RAM/disco; verificada por filtro no servidor
BATCH = 100
FORBIDDEN_SENTINELS = {
    "prompt": "SENTINEL-PROMPT-",
    "content": "SENTINEL-DOC-",
    "token": "SENTINEL-TOKEN-",
    "authorization": "SENTINEL-AUTH-",
    "api_key": "SENTINEL-APIKEY-",
    "email": "SENTINEL-EMAIL-",  # chave fora da allowlist
}
results: list[tuple[str, bool]] = []


def check(name: str, ok: bool) -> None:
    results.append((name, ok))
    print(f"[{'OK' if ok else 'FALHA'}] {name}")


def call(
    base: str,
    path: str,
    token: str | None,
    method: str = "GET",
    body: bytes | None = None,
    extra: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    headers = dict(extra or {})
    if token is not None:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(base + path, data=body, headers=headers, method=method)  # noqa: S310
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
            return resp.status, resp.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()


def make_lines(tenant: str, n: int, run_id: str) -> tuple[list[str], dict[str, str]]:
    """Produz n linhas pelo Logger real; devolve tambem os sentinelas deste tenant."""
    sentinels = {k: f"{v}{tenant}-{run_id}" for k, v in FORBIDDEN_SENTINELS.items()}
    buf = io.StringIO()
    logger = Logger(
        "poc-service",
        "0.0.0",
        "poc",
        allowlist={"tokens_in": None, "error_code": re.compile(r"^[A-Z0-9_]{1,64}$")},
        stream=buf,
    )
    with use_context(RequestContext(correlation_id=f"corr-{tenant}-{run_id}")):
        set_trusted_tenant(tenant, "user")
        for i in range(n):
            data: dict[str, Any] = {
                "method": "POST",
                "route": "/v1/runs",
                "status": 200,
                "duration_ms": i % 500,
                "tokens_in": i % 900,
                "error_code": "NONE",
                **sentinels,
            }
            logger.log("info", "http.request", data)
    return buf.getvalue().splitlines(), sentinels


def push(base: str, token: str, lines: list[str], labels: dict[str, str]) -> int:
    base_ns = time.time_ns() - len(lines) * 1000
    values = [[str(base_ns + i * 1000), line] for i, line in enumerate(lines)]
    body = json.dumps({"streams": [{"stream": labels, "values": values}]}).encode()
    status, _ = call(base, "/loki/api/v1/push", token, "POST", body)
    return status


def loki_query(base: str, token: str, query: str, extra: dict[str, str] | None = None) -> list[str]:
    from urllib.parse import quote

    status, raw = call(
        base,
        f"/loki/api/v1/query_range?limit=5000&since=1h&query={quote(query)}",
        token,
        extra=extra,
    )
    if status != 200:
        return [f"__HTTP_{status}__"]
    out: list[str] = []
    for stream in json.loads(raw)["data"]["result"]:
        out.extend(v[1] for v in stream["values"])
    return out


def span_payload(trace_id: str, tenant: str) -> bytes:
    now = time.time_ns()
    span = {
        "traceId": trace_id,
        "spanId": secrets.token_hex(8),
        "name": "poc.span",
        "kind": 2,
        "startTimeUnixNano": str(now - 10_000_000),
        "endTimeUnixNano": str(now),
        "attributes": [{"key": "poc.owner", "value": {"stringValue": tenant}}],
    }
    return json.dumps(
        {
            "resourceSpans": [
                {
                    "resource": {
                        "attributes": [
                            {"key": "service.name", "value": {"stringValue": "poc-service"}}
                        ]
                    },
                    "scopeSpans": [{"scope": {"name": "poc"}, "spans": [span]}],
                }
            ]
        }
    ).encode()


def main() -> int:
    base = sys.argv[1]
    with open(sys.argv[2], encoding="utf-8") as fh:
        tokens: dict[str, str] = json.load(fh)
    run_id = secrets.token_hex(4)
    sentinels: dict[str, dict[str, str]] = {}

    # 1. Ingestao: 5 tenants x LINES_PER_TENANT linhas em lotes, classes de retencao distintas.
    for tenant in TENANTS:
        lines, sentinels[tenant] = make_lines(tenant, LINES_PER_TENANT, run_id)
        statuses = []
        for off in range(0, len(lines), BATCH):
            chunk = lines[off : off + BATCH]
            cls = "debug" if (off // BATCH) % 3 == 0 else "app"
            statuses.append(
                push(
                    base,
                    tokens[tenant],
                    chunk,
                    {"service": "poc-service", "level": "info", "class": cls},
                )
            )
        statuses.append(
            push(
                base,
                tokens[tenant],
                lines[:2],
                {"service": "poc-service", "level": "info", "class": "audit"},
            )
        )
        check(
            f"ingestao {tenant}: {len(lines)} linhas aceitas (HTTP 204 em todos os lotes)",
            set(statuses) == {204},
        )
        bulk, _ = make_lines(tenant, BULK_LINES_PER_TENANT, run_id)
        bulk_status = {
            push(
                base,
                tokens[tenant],
                bulk[o : o + BATCH * 5],
                {"service": "poc-bulk", "level": "info", "class": "app"},
            )
            for o in range(0, len(bulk), BATCH * 5)
        }
        check(
            f"ingestao em massa {tenant}: {len(bulk)} linhas (HTTP 204 em todos os lotes)",
            bulk_status == {204},
        )

    # Controle negativo do scanner: linha que burla a redacao deve ser detectada.
    leak = "SENTINEL-NEG-CONTROL-" + run_id
    push(
        base,
        tokens["tenant-a"],
        [json.dumps({"event": "bypass", "data": {"x": leak}})],
        {"service": "poc-bypass", "level": "info", "class": "app"},
    )
    time.sleep(3)

    # 2. Redacao ponta a ponta: o filtro roda NO servidor sobre todas as linhas (sem o teto de 5000 por consulta).
    pattern = "SENTINEL-(PROMPT|DOC|TOKEN|AUTH|APIKEY|EMAIL)-"
    leaked = loki_query(base, tokens["admin"], f'{{service=~"poc-(service|bulk)"}} |~ "{pattern}"')
    check(
        "redacao: 0 linhas com sentinela de campo proibido em poc-service+poc-bulk (5 tenants, 115 mil linhas)",
        leaked == [],
    )
    sample = loki_query(base, tokens["tenant-a"], '{service="poc-service"}')
    check(
        "redacao: linhas existem e a chave fora da allowlist foi descartada (_dropped)",
        any('"_dropped"' in x for x in sample),
    )
    check(
        "redacao: campo permitido (tokens_in) chegou ao Loki",
        any('"tokens_in"' in x for x in sample),
    )
    found = loki_query(base, tokens["admin"], f'{{service="poc-bypass"}} |= "{leak}"')
    check(
        "controle negativo: o mesmo filtro encontra o sentinela de uma linha que burlou a redacao",
        len(found) == 1,
    )
    audit_view = loki_query(base, tokens["admin"], '{service="poc-service",class="audit"}')
    check(
        "admin (consulta federada auditada) enxerga os 5 tenants",
        {json.loads(x).get("tenant_id") for x in audit_view} == set(TENANTS),
    )

    # 3. Isolamento de consulta de logs.
    for tenant in TENANTS:
        own = loki_query(base, tokens[tenant], '{service="poc-service"}')
        owners = {json.loads(line).get("tenant_id") for line in own}
        check(
            f"isolamento logs {tenant}: so enxerga linhas proprias ({len(own)} linhas)",
            len(own) > 0 and owners == {tenant},
        )
    seen_b = loki_query(base, tokens["tenant-a"], '{service="poc-service"} |= "tenant-b"')
    check("isolamento logs: A filtrando por 'tenant-b' obtem 0 linhas", seen_b == [])
    forged = loki_query(
        base, tokens["tenant-a"], '{service="poc-service"}', extra={"X-Scope-OrgID": "tenant-b"}
    )
    forged_owners = {json.loads(x).get("tenant_id") for x in forged}
    check(
        "isolamento logs: A forjando X-Scope-OrgID=tenant-b continua vendo so tenant-a",
        forged_owners == {"tenant-a"},
    )
    forged_multi = loki_query(
        base,
        tokens["tenant-a"],
        '{service="poc-service"}',
        extra={"X-Scope-OrgID": "tenant-a|tenant-b"},
    )
    check(
        "isolamento logs: A forjando 'tenant-a|tenant-b' continua vendo so tenant-a",
        {json.loads(x).get("tenant_id") for x in forged_multi} == {"tenant-a"},
    )
    check("sem token -> 401", call(base, "/loki/api/v1/labels", None)[0] == 401)
    check("token desconhecido -> 401", call(base, "/loki/api/v1/labels", "x" * 32)[0] == 401)
    check(
        "rota administrativa do Loki (/loki/config) nao exposta pelo gateway",
        call(base, "/loki/config", tokens["tenant-a"])[0] == 404,
    )
    check(
        "API de delecao do Loki nao exposta pelo gateway",
        call(base, "/loki/api/v1/delete", tokens["tenant-a"], "POST")[0] == 404,
    )
    foreign = loki_query(
        base, tokens["tenant-a"], '{service=~"poc-(service|bulk)"} | json | tenant_id != "tenant-a"'
    )
    check(
        "isolamento logs: A consultando tudo (inclui bulk) nao retorna linha com tenant_id alheio",
        foreign == [],
    )

    # 4. Isolamento de traces (Tempo).
    traces: dict[str, str] = {}
    for tenant in TENANTS:
        for _ in range(50):
            tid = secrets.token_hex(16)
            status, _body = call(
                base, "/otlp/v1/traces", tokens[tenant], "POST", span_payload(tid, tenant)
            )
            if status != 200:
                check(f"ingestao de traces {tenant}", False)
                break
            traces[tenant] = tid
    time.sleep(2)
    check("ingestao de traces: 5 tenants x 50 spans aceitos", len(traces) == len(TENANTS))
    got_own = call(base, f"/tempo/api/traces/{traces['tenant-a']}", tokens["tenant-a"])[0]
    got_other = call(base, f"/tempo/api/traces/{traces['tenant-b']}", tokens["tenant-a"])[0]
    got_b_own = call(base, f"/tempo/api/traces/{traces['tenant-b']}", tokens["tenant-b"])[0]
    check(f"isolamento traces: A le o proprio trace (HTTP {got_own})", got_own == 200)
    check(
        f"controle positivo: B le o proprio trace, logo o trace de B existe (HTTP {got_b_own})",
        got_b_own == 200,
    )
    check(
        f"isolamento traces: A pedindo o trace de B nao obtem o dado (HTTP {got_other})",
        got_other == 404,
    )
    forged_trace = call(
        base,
        f"/tempo/api/traces/{traces['tenant-b']}",
        tokens["tenant-a"],
        extra={"X-Scope-OrgID": "tenant-b"},
    )[0]
    check(
        f"isolamento traces: A forjando X-Scope-OrgID tambem nao obtem (HTTP {forged_trace})",
        forged_trace == 404,
    )

    failed = [n for n, ok in results if not ok]
    print(
        f"RESUMO: {len(results) - len(failed)}/{len(results)} verificacoes OK; falhas={len(failed)}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
