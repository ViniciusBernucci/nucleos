# Prompts operacionais — lote 2026-10-25 EP-00/EP-01

Um prompt por tarefa, **por referência**: a especificação não é copiada. Manifesto: [lote](lote-2026-10-25-ep00-ep01-fundacao.md) · Estado (só o coordenador escreve): [estado.json](lote-2026-10-25-ep00-ep01-fundacao-estado.json). Os prompts só valem sob pedido de execução; planejar não os dispara.

## Preâmbulo comum (todas as tarefas)

1. Raiz do repositório `/home/vinicius/nucleos`; worktree `/home/vinicius/nucleos-worktrees/tarefa/<chave>` criada pelo coordenador a partir da base indicada no manifesto (§5). Antes de trabalhar, o coordenador executa:
   `export CONTEXTO_CLI="$(cd "$(git rev-parse --path-format=absolute --git-common-dir)/../.." && pwd)/contexto/contexto.mjs"` e `node "$CONTEXTO_CLI" ensure --project <raiz da worktree>` e exige `"prepared":true` (procedimento em `/home/vinicius/nucleos/skills/skills/_shared/worktrees-automaticas.md`). Não copiar `.contexto` entre raízes.
2. Leia `/home/vinicius/nucleos/CLAUDE.md` (documentação de entrega, commits, dados), o skill `/home/vinicius/nucleos/.claude/skills/implementador-de-ticket/SKILL.md` e a especificação indicada abaixo. Critérios `AC-n` = n-ésimo item de "Critérios de aceite".
3. Escreva somente nos caminhos listados. Nada de refatoração alheia, dependências sem lock file, segredos em código/saída/diff, push, PR ou merge. Commit local só se o pedido de execução o autorizou; mensagem termina com a linha de coautoria definida na sessão.
4. Não revise nem aprove a própria entrega: review, auditoria e QA são sessões independentes do orquestrador.
5. Antes de encerrar: documento de entrega em `documentacoes/<domínio>/AAAA-MM-DD-titulo.md` (domínio sugerido abaixo), lessons conforme `CLAUDE.md` já atualizado por LOC-001 (ou justificativa registrada), validações **reais** e diffs reais. Registre versões e datas de tudo que consultou na web/registro de pacotes.
6. PoCs usam apenas containers descartáveis em `127.0.0.1`, sem dados reais, e são destruídos ao final; sem a declaração de ambiente isolado (LOC-001 mergeada) não rode PoC com banco.
7. Todo spike entrega: ADR (status **Proposto**, nunca "Aceito") no template de `documentacoes/arquitetura/adr/0000-template.md`, evidência reproduzível (script + saída) e a lista do que ainda depende de decisão humana.

## Tarefas

| Chave | Especificação | Escreve em (esperado) | Domínio da entrega | Validação |
| --- | --- | --- | --- | --- |
| FND-001 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-001) | árvore `apps/ services/ packages/ infrastructure/`, raiz (`Makefile`, `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.editorconfig`, `.gitignore`, `.dockerignore`, `CODEOWNERS`), `lessons/.gitkeep`, `documentacoes/engenharia/` (versões). **Não** criar `lessons/README.md` (LOC-001) | `engenharia` | AC-1..4; reporte ao coordenador os comandos reais de build/teste (ver observação ao final). Toolchain ausente (pnpm, uv, Python ≥ 3.12) ⇒ registrar e bloquear com evidência, não improvisar. |
| FND-008 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-008) | `documentacoes/arquitetura/adr/`, `documentacoes/{seguranca,runbooks,engenharia,_modelos}/`, notas de substituição em `Nucleos-Especificacao-Mestra.md` e `documentacoes/transversal/2026-09-22-backlog-completo.md`. **Não** alterar `CLAUDE.md` (LOC-001; Q-01 já decidida, registrar a referência) | `engenharia` | AC-1..3; contagem de 15 ADRs e links relativos |
| LOC-001 | [loc-001](lote-2026-10-25-ep00-ep01-fundacao-loc-001.md) | `CLAUDE.md`, `AGENTS.md`, `.agents/rules/project-instructions.md`, `lessons/README.md` | `transversal` | AC-1..6 |
| DEC-001 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-001) | `documentacoes/seguranca/`, matriz para [rastreabilidade](../backlog/rastreabilidade.md) | `seguranca` | AC-1..4; SEC-01..18 cada um ≥ 1 vez. AC-3 exige o usuário como revisor: a tarefa termina "pronta para revisão humana" |
| DEC-002 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-002) | ADR-016, PoC descartável em `infrastructure/docker/poc-auth/` ou fora da árvore versionada | `identidade` | AC-1..3 (sessão revogada medida) |
| DEC-003 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-003) | ADR-017, PoC (20 bancos de teste efêmeros) | `dados` | AC-1..3 (falha induzida no banco 12) |
| DEC-004 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-004) | ADR-018, esquema do token como **proposta** em `documentacoes/` (o pacote `packages/contracts` pertence a FND-003), PoC com runtime falso | `identidade` | AC-1..3 (casos negativos rejeitados) |
| DEC-006 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-006) | ADR-020, PoC, teste de ausência de segredo em `env`/`inspect`/logs | `seguranca` | AC-1..3 |
| DEC-011 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-011) | `documentacoes/seguranca/` (rascunho, marcado "não é aconselhamento jurídico") | `conformidade` | Fatos de provedores só com fonte e data; AC-1 aguarda revisão legal; AC-2 verificável |
| DEC-012 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-012) | ADR-026, `SubscriptionEvent` (proposta em `documentacoes/`) | `faturamento` | AC-1..2 |
| FND-002 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-002) | configs de lint/hook/arquitetura na raiz e por workspace, `documentacoes/engenharia/` | `engenharia` | AC-1..2 com arquivos de regressão que devem falhar |
| FND-004 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-004) | `infrastructure/docker/` (compose, scripts), `.env.example`, bloco do `Makefile` | `infraestrutura` | AC-1..3; portas só em `127.0.0.1` |
| FND-009 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-009) | `packages/` de logging/observabilidade (TS e Python), hello-world dos serviços | `observabilidade` | AC-1..3 |
| FND-005 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-005) | `.github/workflows/`, configs de scanners, instruções manuais de branch protection | `infraestrutura` | AC-1..3; PRs sintéticos só descritos se não houver acesso ao GitHub (não executar via API sem pedido) |
| DEC-010 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-010) | ADR-024, PoC efêmero | `observabilidade` | AC-1..3 |
| DEC-007 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-007) | ADR-021, PoC | `mensageria` | AC-1..3 |
| DEC-009 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-009) | ADR-023, PoC (MinIO local; provedores reais só por documentação, sem contas pagas) | `dados` | AC-1..3 |
| DEC-013 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-013) | ADR-025, diagrama, matriz de credenciais | `arquitetura` | AC-1..3 |
| FND-003 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-003) | `packages/contracts`, `packages/sdk`, geração Python, bloco do `Makefile`, CI de drift (coordenar com FND-005) | `contratos` | AC-1..3 |
| FND-006 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-006) | esquema de config, `compose.staging.yml`/`compose.prod.yml`, runbook de deploy | `infraestrutura` | AC-1..3; deploy de staging só se houver ambiente declarado, senão registrar NA/BLOCKED |
| DEC-008 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-008) | ADR-022, dois protótipos descartáveis | `agentes` | AC-1..3 |
| FND-007 | [ticket](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-007) | configuração Caddy/Traefik, scripts de verificação | `infraestrutura` | AC-1..3; varredura externa só com ambiente declarado |
| DEC-005 | [ticket](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-005) | **Não executar** — bloqueada até haver VPS (Q-03) | — | — |

Observação sobre a linha FND-001: os comandos reais de build/teste que ela criar devem ser registrados em `CLAUDE.md` na seção "Validação"; como `CLAUDE.md` pertence a LOC-001 neste lote, o coordenador aplica essa atualização numa tarefa de fechamento após a integração da onda 1 (não é nova tarefa de produto).
