# Auditoria de review - FND-001 (scaffolding do monorepo)

- **Relatorio de origem:** `documentacoes/reviews/2026-10-25-review-fnd-001.md` (veredito original preservado: APPROVED WITH NOTES)
- **Tarefa:** ENT-FND-001 (`documentacoes/backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-001`)
- **Worktree/branch:** `/home/vinicius/nucleos-worktrees/tarefa/fnd-001`, `tarefa/fnd-001`
- **Base:** `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594` | **HEAD auditado:** `a995596c32a86b2b8448db92f342653566acfc58` (igual ao revisado; sem mudancas desde a revisao)
- **Auditor:** sessao independente (nao implementou nem revisou); somente leitura; nenhum codigo editado, nenhum commit.
- **Nao executado:** `make up` com porta ocupada (reproducao por leitura de `scripts/local.sh`); pnpm audit/pip-audit.

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| REVIEW-001 | BAIXO | BAIXO | ADIAR (FND-005) |
| REVIEW-002 | BAIXO | BAIXO | ADIAR (FND-002 / FND-005) |
| REVIEW-003 | BAIXO | BAIXO (medio para AC-2 como prova) | APLICAR |
| REVIEW-004 | BAIXO | INFO | ADIAR (FND-002), parcialmente REJEITADO como defeito |

### REVIEW-001 - ADIAR
- Criterio: AC-3 "CODEOWNERS cobre os caminhos sensiveis". `CODEOWNERS` lista `/services/tool-gateway/`, `/apps/tenant-provisioner/`, `/infrastructure/`: cobertura atendida. "Revisor adicional" depende de time de seguranca e de branch protection, que o ticket FND-005 define (linha "branch protection em main ... 2 para CODEOWNERS de seguranca").
- Impacto residual: aprovacao unica ate FND-005; declarado na entrega.
- Condicao de retomada: FND-005 - trocar dono por time e ativar "require review from Code Owners". Sem acao em FND-001.

### REVIEW-002 - ADIAR
- Evidencia: nao ha `.npmrc`/politica de scripts em `pnpm-workspace.yaml` (contem so `packages`); lock existe e `setup` usa `--frozen-lockfile`, cumprindo AC-4. Nenhuma dependencia atual tem script de instalacao, logo nao ha exposicao hoje. Endurecimento e gate de supply chain pertencem a FND-002 (padroes/hooks) e FND-005 (job `security`: pnpm audit, osv, pip-audit).
- Impacto residual: dependencia futura com `postinstall` rodaria sem allowlist. Retomada: primeira dependencia nova com build script, ou FND-002/FND-005. A semantica pnpm 12 nao foi verificada pelo revisor; verificar antes de implementar.

### REVIEW-003 - APLICAR (escopo FND-001)
- Evidencia (`scripts/local.sh`):
  - `up()` (linhas 23-38): inicia filhos em background sem checar porta livre; o laco 30-36 faz `break` no primeiro `curl /healthz` com sucesso, sem relacao com o PID iniciado; `health()` (50-61) tambem so usa curl. Se a porta ja tem outro servico respondendo 200, e o filho falha com EADDRINUSE, `make up` termina rc 0 com "OK". Isso e falso verde na prova de AC-2 ("todo componente responde /healthz"), criterio de aceite do ticket, e script e entregavel de FND-001.
  - `down()` (40-48): `kill -- "-$pid"` do pid-file sem validar; PID reciclado pode atingir grupo alheio. Mitigado por ser dev local e `.run/` efemero, mas a correcao e barata.
- Nao e dominio de FND-004 (Compose substituira o script, mas FND-001 entrega e valida com ele; ate la o falso OK afeta o aceite).
- Plano minimo (nao implementado aqui):
  1. Em `up()`, antes de iniciar cada componente, falhar com mensagem e rc != 0 se a porta estiver em escuta (`ss -ltn "sport = :$port"` ou `curl` conectando); abortar sem iniciar os demais ou chamar `down`.
  2. Apos o laco de espera, em `up()` confirmar que cada pid de `.run/<nome>.pid` ainda vive (`kill -0`); senao `FAIL` e rc 1.
  3. Em `down()`, so enviar kill se `kill -0 "$pid"` e `ps -o pgid= -p "$pid"` for igual ao pid (lider de sessao criado por `setsid`); caso contrario apenas remover o pid-file.
- Risco da alteracao: baixo (script isolado, 68 linhas); cuidar de `set -euo pipefail` (usar `|| true`/condicionais) e de `ss` ausente (fallback bash `/dev/tcp`).
- Teste esperado: ocupar a 8001 com um servidor que responde 200 em `/healthz` (ex.: `python -m http.server`-like) e verificar que `make up` falha com rc != 0; fluxo normal `make up && make health && make down` continua 7/7 OK e 0 portas apos `down`; `down` com pid-file apontando para PID alheio nao mata o processo.

### REVIEW-004 - ADIAR (nao e defeito)
- `pytest==9.0.3` existe e esta travado em `uv.lock`; o documento nao alega ser a ultima versao. `apps/web/next-env.d.ts` versionado: o ticket nao o proibe, e `.gitignore` ignora `.next/` mas nao este arquivo; padrao aceito do Next.
- Retomada: rotina de atualizacao de dependencias / FND-002 (decidir se `next-env.d.ts` entra no `.gitignore` junto do lint de TS). Nenhum custo demonstrado agora.

## Veredito

**CORRECOES_NECESSARIAS** - apenas REVIEW-003 (APLICAR) antes de integrar, porque afeta a confiabilidade da prova de AC-2. REVIEW-001, 002 e 004 seguem como pendencias rastreadas para FND-005, FND-002/FND-005 e FND-002. Nenhum vulnerabilidade ou quebra de aceite adicional confirmada. Esta auditoria nao autoriza implementar fora do ciclo do orquestrador e nao substitui QA.
