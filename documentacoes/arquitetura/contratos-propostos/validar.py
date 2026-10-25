#!/usr/bin/env python3
"""Valida o contrato PROPOSTO SubscriptionEvent (ADR-026) e a matriz evento -> transicao.

Uso: python3 documentacoes/arquitetura/contratos-propostos/validar.py
Requer: python3 e a biblioteca jsonschema (testado com 3.2.0, Draft-07). Sem rede, sem banco.
Saida: 0 se tudo conforme; 1 caso contrario.

Divergencia de motor de regex: em Python, `re.search` com `$` aceita uma quebra de linha final
("abc\\n" casa `^[a-z]+$`), enquanto em ECMA-262 (ajv, alvo de FND-003) `$` so casa no fim da
entrada. Por isso o `pattern` e validado aqui com `re.fullmatch`, equivalente a ECMA para os
padroes `^...$` do contrato. O schema NAO muda. Rodar a suite com ajv fica para FND-003.
"""
import json
import re
import sys
import uuid
from datetime import datetime
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker, ValidationError, validators

AQUI = Path(__file__).resolve().parent
RFC3339 = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")

checker = FormatChecker()


def _pattern(validator, patrn, instance, schema):
    if validator.is_type(instance, "string") and not re.fullmatch(patrn, instance):
        yield ValidationError(f"{instance!r} does not match {patrn!r} (fullmatch)")


Draft7Validator = validators.extend(Draft7Validator, {"pattern": _pattern})


@checker.checks("date-time")
def _dt(v):
    if not isinstance(v, str) or not RFC3339.match(v):
        return False
    try:
        datetime.fromisoformat(v.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


@checker.checks("uuid")
def _uuid(v):
    try:
        return isinstance(v, str) and str(uuid.UUID(v)) == v.lower()
    except ValueError:
        return False


def carregar(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


falhas = []


def checar(cond, msg):
    print(("OK   " if cond else "FALHA ") + msg)
    if not cond:
        falhas.append(msg)


schema = carregar(AQUI / "subscription-event.schema.json")
Draft7Validator.check_schema(schema)
checar(True, "schema e um Draft-07 valido")
v = Draft7Validator(schema, format_checker=checker)

for f in sorted((AQUI / "exemplos/validos").glob("*.json")):
    erros = list(v.iter_errors(carregar(f)))
    checar(not erros, f"valido aceito: {f.name}" + ("" if not erros else f" -> {erros[0].message}"))
for f in sorted((AQUI / "exemplos/invalidos").glob("*.json")):
    erros = list(v.iter_errors(carregar(f)))
    checar(bool(erros), f"invalido rejeitado: {f.name}" + (f" ({erros[0].message[:70]})" if erros else ""))

# Matriz
m = carregar(AQUI / "matriz-evento-transicao.json")
estados = set(m["estados"])
tipos = set(schema["properties"]["event_type"]["enum"])
checar(m["estados_que_apagam_dados"] == [], "nenhum estado/transicao apaga dados")
vistos = {}
for t in m["transicoes"]:
    checar(t["evento"] in tipos, f"evento da matriz existe no schema: {t['evento']}") if t["evento"] not in tipos else None
    ok = set(t["de"]) <= estados and (t["para"] in estados or t["para"] == "UNCHANGED")
    checar(ok, f"estados validos: {t['evento']} {t['de']} -> {t['para']}") if not ok else None
    for s in t["de"]:
        k = (t["evento"], s)
        checar(k not in vistos, f"par (evento, estado) sem duplicidade: {k}") if k in vistos else None
        vistos[k] = t["para"]
for e in sorted(tipos):
    faltam = [s for s in m["estados"] if (e, s) not in vistos]
    checar(not faltam, f"matriz total para {e}" + (f" (faltam {faltam})" if faltam else ""))
# Falha de pagamento nunca leva a estado destrutivo nem a cancelamento
for e in ("payment.failed", "subscription.past_due", "payment.action_required", "payment.refunded", "payment.disputed"):
    destinos = {vistos[(e, s)] for s in m["estados"] if (e, s) in vistos}
    checar(destinos <= {"UNCHANGED", "GRACE"}, f"{e} so leva a UNCHANGED/GRACE (destinos: {sorted(destinos)})")
checar(all("apag" not in t["para"].lower() and "DELET" not in t["para"] for t in m["transicoes"]),
       "nenhuma transicao para estado de exclusao")

print(f"\n{'RESULTADO: FALHOU (' + str(len(falhas)) + ')' if falhas else 'RESULTADO: TUDO CONFORME'}")
sys.exit(1 if falhas else 0)
