# Pacote de revisão humana — lote 2026-10-25 EP-00/EP-01

> **Resultado: PARCIAL_COM_BLOQUEIOS.** 13 das 23 tarefas foram implementadas, revisadas, auditadas, corrigidas, validadas por QA e integradas. 9 não foram iniciadas (ondas 3 e 4) e 1 (DEC-005) segue bloqueada. Nada foi enviado a remoto (sem push, PR ou publicação).
> Manifesto: [lote](lote-2026-10-25-ep00-ep01-fundacao.md) · Estado: [estado.json](lote-2026-10-25-ep00-ep01-fundacao-estado.json) · Retomada anterior: [nota](lote-2026-10-25-ep00-ep01-fundacao-retomada.md) (superada por este pacote).

## 1. Branches e SHAs

| Item | Valor |
| --- | --- |
| Repositório | `nucleos` (`/home/vinicius/nucleos`) |
| Base fixada | `developer` @ `c3c0ba4db42694b847fe0ac2a58f6b7ff7a3d9a7` (planejamento) → commit de planejamento `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594` |
| Branch de revisão | `revisao/2026-10-25-ep00-ep01-fundacao` (HEAD = último commit da branch; ver `git rev-parse`) |
| Leitura | `git log --first-parent 2cb39dca..revisao/2026-10-25-ep00-ep01-fundacao` · `git diff 2cb39dca...revisao/2026-10-25-ep00-ep01-fundacao` · por tarefa `git diff MERGE^1 MERGE` |

## 2. Tarefas

| Tarefa | Perfil | Branch · commit final | Situação |
| --- | --- | --- | --- |
| FND-001 monorepo | padrao | `tarefa/fnd-001` · 60d5e5f | Integrada, aprovada (2/3 rodadas) |
| FND-008 estrutura documental, ADR-001..015 | simples | `tarefa/fnd-008` · 42c1f60 | Integrada, COBERTO_NO_REVIEW |
| LOC-001 regras TS+Python | padrao | `tarefa/loc-001` · 4623970 | Integrada, aprovada. **H-1 (trilha de lessons) não aprovada por você** |
| DEC-001 threat model v0.2 | critico | `tarefa/dec-001` · 0f5bcbe | Integrada. **Pendente: AC-2 (responsáveis dos 14 RISK) e AC-3 (sua revisão)** |
| DEC-002 autenticação (ADR-016) | critico | `tarefa/dec-002` · b4501f6 | Integrada. **Pendente: aceite do ADR-016** |
| DEC-003 dados/migrations (ADR-017) | critico | `tarefa/dec-003` · dc44814 | Integrada (3/3 rodadas). **Pendente: aceite do ADR-017** |
| DEC-004 identidade de serviço (ADR-018) | critico | `tarefa/dec-004` · 9a4ca63 | Integrada (3/3). **Pendente: aceite do ADR-018 e do valor de `max_staleness`** |
| DEC-006 segredos (ADR-020) | critico | `tarefa/dec-006` · 507ad2c | Integrada. **Pendente: aceite do ADR-020 e custódia do backup da chave mestra** |
| DEC-011 LGPD e provedores de LLM | padrao | `tarefa/dec-011` · f8f6c30 | Integrada como rascunho. **Pendente: revisão legal/DPO (AC-1)** |
| DEC-012 pagamento (ADR-026) | padrao | `tarefa/dec-012` · 4db6cf1 | Integrada. **Pendente: aceite do ADR-026 e Q-06** |
| FND-002 qualidade e hooks | simples | `tarefa/fnd-002` · 9e94242 | Integrada, COBERTO_NO_REVIEW |
| FND-004 Docker Compose local | padrao | `tarefa/fnd-004` · e684176 | Integrada (2/3) |
| FND-009 observabilidade | padrao | `tarefa/fnd-009` · 34abc2f | Integrada (3/3) |
| FND-005, DEC-010 | critico / padrao | — | **Não iniciadas** (onda 3, passagem A) |
| DEC-007, DEC-009, DEC-013, FND-003, FND-006, DEC-008, FND-007 | — | — | **Não iniciadas**: dependem do aceite humano dos ADR-017/018/020/021 (passagem B) |
| DEC-005 | critico | — | **Bloqueada** (VPS, Q-03) |

Evidências (relatórios commitados): [documentacoes/reviews/](../reviews/) — review, auditoria, QA e revalidações por tarefa; validação integrada [onda 1+2](../reviews/2026-10-26-validacao-integrada-onda1-onda2.md) (CHANGES_REQUESTED) e [revalidação final](../reviews/2026-10-26-revalidacao-integrada-final.md) (**APROVADO**, INT-001..007 resolvidos).

## 3. O que testar no checkout principal

`git switch revisao/2026-10-25-ep00-ep01-fundacao` (branch anterior: `developer`). Node 24.22.1 e `uv` precisam estar no `PATH` (instalados em `~/.local`, ver [FND-001](../engenharia/2026-10-25-fnd-001-scaffolding-monorepo.md)). Lockfiles mudaram: `make setup`.
`make setup && make lint && make test && make build`; `make up && make health && make down`; `make compose-up && make compose-smoke && make compose-down` (`PERFIS="runtime observability"` exige `make setup && make build`). Portas do Compose só em `127.0.0.1`; o host já usa 5432/6379/8080 de outros projetos. Não há telas.
Revisão de diff sugerida por tarefa: o primeiro-pai de cada merge (`git log --first-parent --merges`).

## 4. Decisões que dependem de você

1. Aceitar, rejeitar ou alterar **ADR-016, 017, 018, 020 e 026** (todos *Proposto*; ADR-001..015 constam "Aceito como baseline" por herança do consolidado).
2. DEC-001: nomear responsáveis dos RISK-001..014 e fazer a revisão do threat model (RISK-013 = confused deputy sem ticket no backlog; RISK-014 = resíduo em backups/logs).
3. DEC-011: indicar o responsável legal/DPO. DEC-012: fechar Q-06. Também Q-02/Q-03/Q-09 seguem abertas.
4. H-1: confirmar a trilha de lessons (TS/Python/Docker/PostgreSQL/segurança).
5. ADR-018: valor de `max_staleness` (proposta 90 s) e política de degradação; ADR-020: custódia do backup da chave mestra.

## 5. Decisões do auditor (ADIAR/REJEITAR) e limitações

- **Adiados com destino:** FND-001 REVIEW-001/002/004 e NOTA-2/3 (parte já tratada em FND-002; CODEOWNERS/branch protection → FND-005); DEC-002 itens de PoC; DEC-003 003b/004/005/007 → DAT-002; DEC-004 REV-005 e API de revogação de `jti` → PRV-004/MSG-002, `ajv` → FND-003; DEC-006 REVIEW-005/009 → FND-006/PRV-004; DEC-012 REVIEW-002 → EP-09, teste de reordenação → FND-003; FND-009 REVIEW-007/009/010, OTLP malformado → FND-006, exemplars; FND-004 REVIEW-004/restart/healthcheck do otel.
- **Rejeitados:** ver `documentacoes/reviews/*auditoria*`.
- **Exceção ao protocolo (transparência):** (a) DEC-003, rodada 3: o plano veio da própria revalidação independente, sem nova sessão de auditor; foi seguida de revalidação+QA independentes (PASS, 20.803 SQLs fuzzados sem estado preso). (b) A [validação integrada](../reviews/2026-10-26-validacao-integrada-onda1-onda2.md) exigiu uma rodada de correção em FND-004 e outra em FND-009 contadas nas suas 3 rodadas. (c) Várias notas BAIXAS foram auditadas em lote (um relatório para FND-002/FND-009/DEC-004).
- **Pendências de lessons (regra do CLAUDE.md):** as entregas FND-002, FND-004 e FND-009 exercitam conceitos relevantes e **a lesson ainda deve ser criada** (registrado em cada entrega). Existem 2 lessons (`00` PostgreSQL migrations, `01` sessão opaca).
- **Limites de teste:** PoCs só em containers descartáveis 127.0.0.1; ADR e PoCs de DEC-002/003/004/006 foram medidos em VM compartilhada (p99 instável); teste de LAN do Compose feito do próprio host; fontes web de provedores marcadas "não verificado" quando sem acesso; CI inexistente (FND-005).
- **Ferramentas instaladas fora do repositório (escopo de usuário, sem sudo):** Node 24.22.1 em `~/.local/opt`, `uv` + Python 3.13 e `gitleaks` em `~/.local/bin`. Nenhuma alteração do sistema.

## 6. PRs sugeridos (não criados)

Um PR de `revisao/2026-10-25-ep00-ep01-fundacao` para `developer`, ou PRs por grupo: (1) documentação e regras: FND-008, LOC-001, DEC-001/011/012, ADRs; (2) fundação de código: FND-001/002/009; (3) infraestrutura: FND-004; (4) PoCs de decisão: DEC-002/003/004/006. Descrição: ver tabela da seção 2; ADRs seguem *Proposto*.

## 7. Inventário de limpeza

Branches `tarefa/*` (13) **preservadas** (não excluídas). Worktrees de tarefa em `/home/vinicius/nucleos-worktrees/tarefa/*`: removidas após conferir árvore limpa e merge na branch de revisão (inventário final no resumo da sessão). Worktree de integração `/home/vinicius/nucleos-worktrees/revisao-ep00-ep01`: removida depois do commit deste pacote. Branch `developer` e remoto: intocados.
