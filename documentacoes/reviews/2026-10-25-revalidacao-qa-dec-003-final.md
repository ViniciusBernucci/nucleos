# Revalidacao final + QA DEC-003 (rodada 3/3)

- Revisor+QA independente (nao implementou). Sem edicao de codigo; sem commit.
- Branch `tarefa/dec-003`, worktree `/home/vinicius/nucleos-worktrees/tarefa/dec-003`, correcao `dc44814f3dab92b2fe2e253c2344ce81dc9f4487` (pai `be7211af6717a15a843275f3750c85528b432acd`). Arvore limpa (`git status --short` vazio).
- Origem: `documentacoes/reviews/2026-10-25-revalidacao-dec-003-r2.md` (bypass 1: `\r` encerra `--`; bypass 2: tag de dollar-quote longa).

## Parte 1 - Veredito dos bypasses: AMBOS FECHADOS

Metodo: PostgreSQL 16 (pgvector/pg16) descartavel `rev-dec003-r3` em 127.0.0.1:55712, senha aleatoria nunca impressa, Node 24.22.1. Container removido ao fim; senha apagada.

1. Fuzz diferencial proprio (`fz4.mjs` no scratchpad): tokens incluindo `\r`, `\r\n`, `\n`, `\f`, `\v`, U+2028, U+0085, aspas simples/duplas, `E'`, `U&`, `$1`, `$$`, `$a$`, `$t$`, tags aleatorias de 1..300 caracteres (abertas e fechadas), unicode, `--`, `/* */` (inclusive aninhado), COMMIT/END/ROLLBACK. Cada SQL aprovado pelo lint foi executado no PG dentro de BEGIN com `CREATE TABLE fz` antes e `SELECT 1/0` depois; bypass = `fz` persistiu apos ROLLBACK ou `xact_start` mudou.
   - 4 sementes x 25 mil geracoes: 5138 + 5237 + 5244 + 5184 = **20.803 SQLs aprovados pelo lint e executados; 0 bypasses**.
   - Controle de sensibilidade: o mesmo fuzz contra o `runner.mjs` da correcao anterior (be7211a) achou 62 bypasses em 3187 aprovados (todos com `\r` em `--`; ex.: `SELECT 1;--E\rCOMMIT;`). Logo o fuzzer detecta a classe e o dc44814 a eliminou.
2. Teste dirigido fim a fim com `migrateTenant` (`dir.mjs`), 46 casos, um banco novo por caso: `\r`, `\r\n`, `\n`, `\n\r` apos `--`; `\r` em `/* */` e em literal; tags `$L...$` com 0,1,2,10,63,64,77,78,79,80,81,100,200,255,299,300,301,1000 caracteres (ASCII e unicode) com aspas dentro; `E'\''`; comentario aninhado; `$1`; `"a--b"`. Resultado: **0 casos com estado preso** (b1 ausente e nenhuma versao registrada em todos); todos rejeitados pelo lint com "controle de transacao proibido (COMMIT)", exceto o aninhado legitimo (`/* /* */ COMMIT; */`), que corretamente passa e falha por `division by zero` com rollback total.
3. Limites ja documentados e fora do alcance (nao reavaliados como falha): `standard_conforming_strings=off` por `set_config`/`ALTER ROLE`, SQL dinamico `DO`/`EXECUTE`. Seguem descritos no ADR-017, lesson e entrega; gate humano.

Veredito: **nenhum SQL aprovado pelo lint deixou estado preso** nas classes testadas. A regra de isolamento (3 rodadas esgotadas) **nao e acionada**; a tarefa nao precisa ser isolada por motivo de bypass.

## Parte 2 - QA (criterios do ticket ENT-DEC-003)

`./run.sh` (worktree, `documentacoes/arquitetura/poc/dec-003`): rc 0, 42 s, "PoC concluida: todas as asserções passaram", container `dec003-poc-pg` destruido ao sair; `git status` limpo apos a execucao. Postgres 16.15, pgvector 0.8.7.

Numeros conferidos na execucao:
- 3 migrations (0001_base, 0002_documento_vetor, 0003_documento_busca_texto), 20 bancos `poc_tenant_01..20`.
- [A1] falha induzida no banco 12 apos 0002: 11 bancos com [0001,0002,0003]; banco 12 so [0001] (rollback da 0002); bancos 13-20 sem versao (fail-fast, 8 nao iniciados); 1896 ms.
- [A2] retomada com o mesmo comando: ok=20, falhas=0; banco 12 aplicou [0002,0003] e pulou 1; banco 11 pulou 3; todos os 20 com [0001,0002,0003]; 1622 ms.
- [B] reexecucao idempotente: 0 aplicadas. [C] checksum divergente rejeitado. [D] 2 runners concorrentes: 3 linhas, sem duplicidade (advisory lock).
- [E] HNSW, IVFFlat e GIN/tsvector com planos de indice; [F] snapshot de esquema == schema Python (check_tenant.py em 2 bancos: esquema==snapshot).
- [G] tempo (20 bancos novos x 3 migrations): concorrencia=1 total 3675 ms (media 174 ms/banco, max 356); concorrencia=4 total 1679 ms (media 295, max 492).
- [H1/H1b/H2/H3]: lint de transacao (inclui os casos da rodada 3), rollback total em erro SQL, allowlist de nomes.

Documento "como adicionar migration e reverter por roll-forward": `documentacoes/dados/2026-10-25-dec-003-como-adicionar-migration-e-roll-forward.md` existe, com secoes "Adicionar uma migration", "O que acontece numa falha", "Reverter por roll-forward", "Reproduzir a PoC".

Lesson `lessons/00 - Migracoes SQL forward-only no PostgreSQL.md`: exemplo `exemplo.mjs` extraido do proprio texto e executado em PG descartavel com `pg@8.23.1`: rc 0, imprime `[ { version: '0001', name: 'exemplo' } ]`. Nao renumerada (e a unica lesson alem do README; esperado).

## Matriz AC -> resultado

| Criterio | Resultado | Evidencia |
|---|---|---|
| AC-1 ADR-017 aceito com as convencoes | **BLOCKED** | ADR-017 `Status: Proposto`; aceitacao e decisao humana (dependencia humana, nao defeito). Convencoes presentes no ADR para a decisao. |
| AC-2 PoC: 3 migrations x 20 bancos, tempo medido, retomada apos falha no banco 12 | **PASS** | [A1]/[A2]/[G] acima, reproduzido por `./run.sh` (rc 0). |
| AC-3 Documento de adicionar migration e roll-forward | **PASS** | Arquivo acima; roll-forward descrito. |
| Extra: bypasses do lint (REVIEW-001 r2) | **PASS (fechados)** | Parte 1. |
| Extra: lesson 00 com exemplo executavel | **PASS** | Executado, rc 0. |

## Veredito geral

Codigo e PoC aprovados: bypasses fechados e AC-2/AC-3 atendidos. A tarefa permanece **BLOCKED apenas em AC-1** (aceite humano do ADR-017); nao ha bypass pendente e nao ha motivo para isolar a tarefa.

## Limpeza

Container `rev-dec003-r3` removido; `dec003-poc-pg` removido pelo `run.sh`; nenhum container dec003/rev-dec restante. Scripts em `/tmp/claude-1001/-home-vinicius-nucleos/b6db1bfe-9d03-4f5f-8423-dc23e91e0173/scratchpad/` (`fz4.mjs`, `dir.mjs`, `lessonrun/`). Nenhum arquivo do repositorio alterado alem deste relatorio.
