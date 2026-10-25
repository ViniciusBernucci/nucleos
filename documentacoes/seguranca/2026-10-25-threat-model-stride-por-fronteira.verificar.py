#!/usr/bin/env python3
"""Verifica o threat model STRIDE (ENT-DEC-001) contra o backlog.

Uso (a partir da raiz do repositorio):
    python3 -I documentacoes/seguranca/2026-10-25-threat-model-stride-por-fronteira.verificar.py .

Somente biblioteca padrao. Le apenas arquivos Markdown do repositorio; nao usa
rede, segredos nem banco. Codigo de saida 0 = tudo certo; 1 = falhas.
"""
import glob
import os
import re
import sys

MODEL = "documentacoes/seguranca/2026-10-25-threat-model-stride-por-fronteira.md"
NON_TICKET = {"SEC", "RISK", "ADR", "AB"}
TICKET_RE = re.compile(r"\b(?!(?:SEC|RISK|ADR|AB)-)([A-Z]{2,5})-(\d{3})(?:\.\.(\d{3}))?\b")
THREAT_COLS = 8  # ID, STRIDE, Ameaca, Ativo, Controle do ADR, Controle novo, Ticket, SEC
THREAT_RE = re.compile(r"^\| (T-F(\d+)-([STRIDE])(\d?)) \|")
ANCHORS_FRONTIER = {
    "F13": ["PRV-008"],
    "F14": ["OBS-001", "FND-009", "DEC-010"],
    "F15": ["DAT-007", "DAT-008"],
}
ANCHORS_UNION = {  # ancoras exigidas na uniao das fronteiras indicadas
    ("F16", "F17"): ["MSG-006", "AIG-002", "ISO-005"],
    ("F18", "F19"): ["RUN-003", "PRV-009", "PRV-010", "DAT-009"],
}

fails = []


def fail(msg):
    fails.append(msg)


def cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def expand(m):
    pre, a, b = m.group(1), m.group(2), m.group(3)
    if b is None:
        return [f"{pre}-{a}"]
    return [f"{pre}-{n:03d}" for n in range(int(a), int(b) + 1)]


def tickets_in(text):
    out = []
    for m in TICKET_RE.finditer(text):
        out.extend(expand(m))
    return out


def main(root):
    path = os.path.join(root, MODEL)
    if not os.path.isfile(path):
        print(f"FALHA: modelo nao encontrado: {path}")
        return 1
    text = open(path, encoding="utf-8").read()
    lines = text.split("\n")

    # tickets existentes
    existing = set()
    for f in glob.glob(os.path.join(root, "documentacoes/backlog/EP-*/tickets.md")):
        existing.update(re.findall(r"^## ENT-([A-Z]{2,5}-\d{3})\b", open(f, encoding="utf-8").read(), re.M))
    if not existing:
        fail("nenhum ticket encontrado em documentacoes/backlog/EP-*/tickets.md")

    # (i) ENT- inexistente
    for m in re.finditer(r"ENT-([A-Z]{2,5}-\d{3})", text):
        if m.group(1) not in existing:
            fail(f"ENT-{m.group(1)} citado mas inexistente no backlog")

    # (b) tickets citados existem (fora de blocos de codigo)
    in_code = False
    cited = set()
    for ln in lines:
        if ln.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        for t in tickets_in(ln):
            cited.add(t)
    for t in sorted(cited):
        if t not in existing:
            fail(f"ticket citado inexistente: {t}")

    # secoes
    def section(start_pat, end_pat):
        s = next((i for i, l in enumerate(lines) if re.match(start_pat, l)), None)
        if s is None:
            fail(f"secao nao encontrada: {start_pat}")
            return []
        e = next((i for i in range(s + 1, len(lines)) if re.match(end_pat, lines[i])), len(lines))
        return lines[s:e]

    sec61 = section(r"### 6\.1", r"### 6\.2")
    sec62 = section(r"### 6\.2", r"## 7\.")
    sec4 = section(r"## 4\.", r"## 5\.")
    sec5 = section(r"## 5\.", r"## 6\.")

    # (a) SEC-01..18 na matriz 6.1
    rows61 = {}
    for l in sec61:
        m = re.match(r"^\| (SEC-\d\d) \|", l)
        if m:
            rows61[m.group(1)] = l
    for i in range(1, 19):
        if f"SEC-{i:02d}" not in rows61:
            fail(f"SEC-{i:02d} ausente da matriz 6.1")

    # ameacas
    threats = {}
    front_rows = {}
    cur = None
    for l in lines:
        h = re.match(r"### (F\d+) ", l)
        if h:
            cur = h.group(1)
            continue
        if l.startswith("## "):
            cur = None if not l.startswith("## 3.") else cur
        m = THREAT_RE.match(l)
        if m and cur:
            tid = m.group(1)
            if tid in threats:
                fail(f"ID duplicado: {tid}")
            if f"F{m.group(2)}" != cur:
                fail(f"{tid} fora da secao da sua fronteira ({cur})")
            ncols = len(cells(l))
            if ncols != THREAT_COLS:
                fail(f"{tid}: {ncols} colunas em vez de {THREAT_COLS}")
            threats[tid] = l
            front_rows.setdefault(cur, []).append((m.group(3), l, tid))

    # (c) fronteiras F1..F19 com S,T,R,I,D,E
    for n in range(1, 20):
        f = f"F{n}"
        cats = {c for c, _, _ in front_rows.get(f, [])}
        miss = set("STRIDE") - cats
        if miss:
            fail(f"{f}: categorias STRIDE ausentes: {''.join(sorted(miss))}")
        if len(front_rows.get(f, [])) < 6:
            fail(f"{f}: menos de 6 linhas STRIDE")

    # (d) toda ameaca tem ticket ou RISK
    for tid, l in threats.items():
        if not tickets_in(l) and not re.search(r"RISK-\d{3}", l):
            fail(f"{tid}: sem ticket e sem RISK")

    # RISK
    risks = {}
    for l in sec5:
        m = re.match(r"^\| (RISK-\d{3}) \|", l)
        if m:
            c = cells(l)
            risks[m.group(1)] = c
            if len(c) < 10 or not c[-2].startswith("pendente (AC-2"):
                fail(f"{m.group(1)}: Responsavel deve ser 'pendente (AC-2...)'")
            if len(c) < 10 or c[-1] != "proposto":
                fail(f"{m.group(1)}: Estado deve ser 'proposto'")
    # (e) RISK citados existem
    for rid in sorted(set(re.findall(r"RISK-\d{3}", text))):
        if rid not in risks:
            fail(f"{rid} citado mas ausente da tabela de riscos")

    # (f) abusos
    abuses = {}
    for l in sec4:
        m = re.match(r"^\| (AB-\d\d) \|", l)
        if m:
            abuses[m.group(1)] = l
    for i in range(1, 15):
        if f"AB-{i:02d}" not in abuses:
            fail(f"AB-{i:02d} ausente")

    # (g) ancoras
    def frontier_text(f):
        return " ".join(l for _, l, _ in front_rows.get(f, []))

    for f, req in ANCHORS_FRONTIER.items():
        have = set(tickets_in(frontier_text(f)))
        for t in req:
            if t not in have:
                fail(f"{f}: ticket-ancora {t} nao citado")
    for fs, req in ANCHORS_UNION.items():
        have = set(tickets_in(" ".join(frontier_text(f) for f in fs)))
        for t in req:
            if t not in have:
                fail(f"{'/'.join(fs)}: ticket-ancora {t} nao citado")
    if "PRV-008" not in tickets_in(abuses.get("AB-13", "")):
        fail("AB-13 deve citar PRV-008")
    for ab in ("AB-04", "AB-07"):
        have = set(tickets_in(abuses.get(ab, "")))
        for t in ("WEB-008", "TGW-006"):
            if t not in have:
                fail(f"{ab} deve citar {t}")
    if "PRV-008" not in tickets_in(" ".join(sec62)):
        fail("PRV-008 ausente da matriz 6.2")
    if not any(t.startswith("T-F14-") for t in re.findall(r"T-F\d+-[STRIDE]\d?", rows61.get("SEC-13", ""))):
        fail("SEC-13 sem ameaca de F14 na matriz 6.1")
    if not any(t.startswith("T-F15-") for t in re.findall(r"T-F\d+-[STRIDE]\d?", rows61.get("SEC-14", ""))):
        fail("SEC-14 sem ameaca de F15 na matriz 6.1")

    # matriz: ids da 6.1 existem; toda ameaca esta na 6.2 e tags SEC consistentes
    for sec, l in rows61.items():
        for t in re.findall(r"T-F\d+-[STRIDE]\d?", l):
            if t not in threats:
                fail(f"{sec}: ID de ameaca inexistente {t}")
    ids62 = {cells(l)[0] for l in sec62 if re.match(r"^\| T-F\d+-", l)}
    for tid in threats:
        if tid not in ids62:
            fail(f"{tid} ausente da matriz 6.2")
    for tid, l in threats.items():
        for sec in set(re.findall(r"SEC-\d\d", cells(l)[-1])):
            if tid not in rows61.get(sec, ""):
                fail(f"{tid} marcado {sec} mas ausente da linha {sec} da matriz 6.1")

    # (h) 'Proposto, sem ticket' exige RISK na mesma linha
    for i, l in enumerate(lines, 1):
        if "Proposto, sem ticket" in l and l.startswith("|") and not re.search(r"RISK-\d{3}", l):
            fail(f"linha {i}: 'Proposto, sem ticket' sem RISK")

    print(f"ameacas: {len(threats)} | fronteiras: {len(front_rows)} | abusos: {len(abuses)} | RISK: {len(risks)}")
    print(f"tickets existentes no backlog: {len(existing)} | tickets distintos citados no modelo: {len(cited)}")
    print(f"SEC na matriz 6.1: {len(rows61)}/18")
    if fails:
        print(f"FALHAS ({len(fails)}):")
        for f in fails:
            print(" -", f)
        return 1
    print("OK: todas as verificacoes passaram")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))))
