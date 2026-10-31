# Auditoria de review FND-004 - 2026-10-25

- **Relatorio de origem:** `documentacoes/reviews/2026-10-25-review-fnd-004.md` (veredito original do revisor preservado: APPROVED WITH NOTES).
- **Tarefa:** ENT-FND-004 (AC-1..3). **Worktree:** /home/vinicius/nucleos-worktrees/tarefa/fnd-004 (somente leitura). **Branch:** `tarefa/fnd-004`.
- **Base:** 4be3ce391a51b9e24cd85f7c894d841636dcd50f. **HEAD:** 023da3dacb13ba8770b768bf6435419659eaf1aa (confirmado; arvore limpa; sem mudancas desde a revisao).
- **Auditor:** sessao independente (Claude, skill auditor-de-review); nao implementou nem revisou. Nada foi executado (Docker/compose nao subidos); verificacao por leitura de `compose.dev.yml`, `Makefile`, `README.md`, `smoke.sh`, `.dockerignore` e do ticket.
- Nota de formato: a skill sugere `docs/historico/reviews/`; este projeto grava em `documentacoes/reviews/` (CLAUDE.md). Sem commit.

## Decisoes

### REVIEW-001 (MEDIO -> avaliado BAIXO/documental) - APLICAR (somente documentacao, sem mudar codigo)
- **Evidencia:** ticket AC-1 e spec dizem `make up`. Makefile: `up: build` -> `./scripts/local.sh up` (FND-001, roda componentes locais, bloqueia IAM/DAT apenas via FND-004); o compose usa `compose-up` (Makefile l.47). README do compose ja declara o desvio (l.5-6).
- **Analise:** o conflito de nome e real e nao se resolve no codigo sem decisao: redefinir `up` quebra FND-001 (README e usuarios); alias exigiria `up` ser os dois. Criar alias novo (ex. `make up-compose`) nao muda o AC literal. A equivalencia documentada basta, desde que seja decisao registrada pelo dono do backlog, nao so nota do implementador. Severidade rebaixada porque a intencao (um comando sobe tudo healthy, <=3 min) esta satisfeita e medida (19,8 s com cache).
- **Plano minimo:** (1) coordenador registra no ticket ENT-FND-004 (`documentacoes/backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md`) e no QA: "AC-1 := `make compose-up` (perfil core; `PERFIS=...` para runtime/observability); `make up` permanece FND-001"; (2) o documento de entrega `documentacoes/<dominio>/...fnd-004...` cita essa equivalencia; (3) registrar o item de decisao em `documentacoes/planejamento-ia/` se houver registro de decisoes. O `CLAUDE.md` e do coordenador: nao e necessario altera-lo (regra especifica de ticket, nao convencao permanente); nao tocar nele.
- **Risco:** nenhum de codigo. **Condicao de aceite:** QA cita a equivalencia e executa `make compose-up` + `make compose-smoke`. Se o coordenador preferir o AC literal, abrir decisao separada (renomear FND-001 para `local-up` e `up` -> compose), fora desta tarefa.

### REVIEW-002 (BAIXO) - APLICAR (plano minimo, baixo risco)
- **Evidencia:** `compose.dev.yml` l.35 (`x-app-python`), l.162 (`web` rw), l.175/186 (`api`, `tenant-provisioner`) montam `../../:/workspace`, que contem `infrastructure/docker/.env.local` (gerado por `dev.sh`, senhas de Postgres/Redis/MinIO; os servicos de app nao recebem `env_file`, entao nao precisam do arquivo). `web` tem escrita no repo inteiro, inclusive `.git/`. `.dockerignore` nao ajuda: afeta build, nao bind mount.
- **Risco real:** limitado a dev e segredos descartaveis, mas e exposicao desnecessaria a codigo de dependencias (supply chain de pnpm/pip) e escrita em `.git`; correcao e barata. Mantido BAIXO, mas aplicar e nao adiar, porque a mitigacao nao tem custo funcional e o perfil runtime e o que roda codigo de terceiros.
- **Plano minimo (escolha a opcao A):**
  - A (preferida): em cada app (ancora `x-app-node` e `x-app-python`, mais `web`) acrescentar bind sobre o arquivo: `/dev/null:/workspace/infrastructure/docker/.env.local:ro`. O arquivo existe quando `dev.sh` roda, entao o bind e valido; a unica diferenca e o conteudo visto no container. Para `web`: trocar `../../:/workspace` por `../../:/workspace:ro` mais `../../apps/web:/workspace/apps/web` (rw), pois `next dev` escreve em `apps/web/.next`; assim `.git/` fica somente leitura.
  - B (mais restritivo, mais frágil com pnpm): montar so `apps/`, `services/`, `packages/`, `node_modules`, `package.json`, `pnpm-workspace.yaml`. Nao recomendado: depende de symlinks do pnpm e de `uv`/workspaces; mais chance de regressao.
- **Cuidados:** a ordem de mounts aninhados e resolvida por caminho (mais especifico vence); validar que `next dev` nao precisa escrever em `node_modules/.cache` fora de `apps/web` (se precisar, adicionar tmpfs naquele caminho).
- **Teste esperado:** com `PERFIS=runtime` (requer `make setup && make build`): `docker compose exec api sh -c 'wc -c /workspace/infrastructure/docker/.env.local'` retorna 0 bytes; `exec web touch /workspace/.git/x` falha (ro); `make compose-smoke PERFIS=runtime` continua `SMOKE OK` (web healthz via proxy). O perfil runtime nunca foi exercitado pelo revisor; o implementador deve executar e registrar. Nao executado por este auditor.

### REVIEW-003 (BAIXO) - REJEITAR como defeito; manter ressalva ao QA
- **Evidencia:** o proprio revisor confirma que nao ha inflacao; documento declara a limitacao e o `ss` prova bind exclusivo em `127.0.0.1` (nenhuma `0.0.0.0`). Nao ha correcao de codigo possivel sem segunda maquina. Aceite de AC-2 por evidencia de bind e legitimo para o criterio "portas inacessiveis da LAN".
- **Acao:** nenhuma no codigo. O QA deve repetir `ss -ltn` e, se houver segunda maquina, um probe externo opcional (nao bloqueante). Retomada: fato novo (bind alterado).

### REVIEW-004 (BAIXO) - ADIAR
- **Evidencia:** imagens com tag+digest, todos resolvem (revisor). Chainguard `latest` e a unica tag gratuita; digest congelado e correto como pin. Risco residual: sem rotina de atualizacao/scan ate FND-005 (CI com trivy/Dependabot ou Renovate) e DEC-009 (pendencia humana ja registrada no documento).
- **Motivo:** nao bloqueia AC-1..3; a solucao pertence a FND-005. **Condicao de retomada:** ao implementar FND-005, incluir atualizacao de digests de `compose.dev.yml` e scan de imagens; DEC-009 resolvida. Sem tarefa externa aberta.

### REVIEW-005 (BAIXO, agrupado) - APLICAR parcial; restante ADIAR/REJEITAR
- `smoke.sh` sem checar `.env.local` (l.6 `. "$DIR/.env.local"`): **APLICAR**. Defeito real de usabilidade/robustez em script de teste do ticket. Plano: antes do `. `, `[ -r "$DIR/.env.local" ] || { echo "FALHA: .env.local ausente; rode 'make compose-up'" >&2; exit 2; }`. Teste: remover (ou renomear) `.env.local` em copia e rodar smoke, esperando mensagem clara e rc=2.
- `restart: unless-stopped` em dev (l.9): **ADIAR**. Preferencia/conforto; so ocupa portas em 127.0.0.1 apos reboot, sem risco de seguranca. Retomada: se atrapalhar dev ou ao revisar FND-006 (overlays definem restart de staging/prod).
- Senha Redis em `ps`/`inspect` e `MC_HOST_local`: **REJEITAR**. Segredos descartaveis em dev local, documentado; correcao exigiria secrets de arquivo (DEC-006 trata em FND-006). Sem custo demonstrado.
- `otel-collector` sem healthcheck: **ADIAR**. Perfil opcional, coberto por `smoke --observability`. Retomada: ao promover observabilidade (FND-006/observabilidade).

## Resumo
| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| REVIEW-001 | MEDIO | BAIXO (documental) | APLICAR (registro de equivalencia, sem codigo) |
| REVIEW-002 | BAIXO | BAIXO | APLICAR |
| REVIEW-003 | BAIXO | BAIXO | REJEITAR (ressalva para QA) |
| REVIEW-004 | BAIXO | BAIXO | ADIAR (FND-005/DEC-009) |
| REVIEW-005 | BAIXO | BAIXO | APLICAR somente smoke.sh; demais ADIAR/REJEITAR |

IDs APLICAR para o review-loop-driver: REVIEW-001 (coordenador, documentacao), REVIEW-002, REVIEW-005 (somente item `smoke.sh`).

## Lacunas
- Perfis `runtime`/`observability` e medicao com cache frio nao verificados por ninguem; REVIEW-002 so e comprovavel em `PERFIS=runtime`.
- gitleaks nao reexecutado pelo revisor nem por este auditor.

## Veredito: CORRECOES_NECESSARIAS
Nenhum bloqueio de seguranca critico; correcoes pequenas (REVIEW-002, smoke.sh) mais registro de equivalencia de AC-1 antes de integrar. Sem reabertura de decisoes ADIAR/REJEITAR sem fato novo.
