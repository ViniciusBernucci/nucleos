# Retomada do lote (execução interrompida por limite de uso, 2026-10-25)

Estado do lote: **EM_ANDAMENTO / PARCIAL**. Branch de revisão `revisao/2026-10-25-ep00-ep01-fundacao` @ HEAD desta nota; worktree de integração `/home/vinicius/nucleos-worktrees/revisao-ep00-ep01`. Checkout principal permaneceu em `developer`.

## Onda 1 — integrada e validada (make setup/lint/test rc=0)
FND-001 (60d5e5f), FND-008 (42c1f60), LOC-001 (4623970). Gates: review, auditoria, correções, revalidação e QA (ou COBERTO_NO_REVIEW em FND-008) concluídos. Commit 4be3ce3 declara comandos reais de validação em CLAUDE.md/AGENTS.md/.agents.
Adiados com destino: FND-001 REVIEW-001/002/004 e NOTA-2/3 (FND-002/FND-005); FND-008 REVIEW-002 e LOC-001 REVIEW-001 (commit documental de fechamento: preencher SHAs; marcar Q-01 como decidida na tabela do backlog README).

## Onda 2 — worktrees em ../nucleos-worktrees/tarefa/<chave>, base 4be3ce3
| Tarefa | Commit | Situação |
| --- | --- | --- |
| DEC-001 | b85ecb0 | review CHANGES_REQUESTED (REV-001..010); auditoria em andamento/pendente; correção v0.2 pendente |
| DEC-011 | f8f6c30 (corr. r1) | review+auditoria feitas; revalidação focal pendente; AC-1 depende de revisão legal |
| DEC-006 | 8105de1 | review pendente/em andamento |
| DEC-012 | a790676 | review APPROVED WITH NOTES (REVIEW-001..007); auditoria pendente |
| DEC-003 | 45eb146 | implementada; review pendente. Lesson `00 - Migracoes...` precisa renumeração na integração |
| DEC-002, DEC-004, FND-002, FND-004, FND-009 | — | implementação possivelmente concluída por agentes em segundo plano; conferir `git log` das branches `tarefa/*` |
Pendência de integração: linhas dos ADR-017/020/026 em `documentacoes/arquitetura/adr/README.md`.

## Não iniciadas
FND-005, DEC-010 (onda 3 da passagem A); passagem B (DEC-007/008/009/013, FND-003/006/007) depende do aceite humano de ADR-017/018/020/021. DEC-005 bloqueada (VPS).
Contadores de rodadas: FND-001 2/3, LOC-001 1/3, DEC-011 1/3; demais 0/3. Os relatórios em `documentacoes/reviews/` do checkout principal estão sem commit.
