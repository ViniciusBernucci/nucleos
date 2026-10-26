# Auditoria de review — DEC-003 (acesso a dados e migrations)

- Relatorio de origem: `documentacoes/reviews/2026-10-25-review-dec-003.md` (namespace DEC-003; REVIEW-001..007 deste relatorio nao se confundem com os de outras tarefas).
- Tarefa: ENT-DEC-003 (AC-1..3), perfil critico (dados/migrations); auditoria obrigatoria.
- Worktree/branch: `/home/vinicius/nucleos-worktrees/tarefa/dec-003`, `tarefa/dec-003`. Base `4be3ce391a51b9e24cd85f7c894d841636dcd50f`; HEAD `45eb1465ee43fc27f8739edcbee19a64fe123932` (confirmado; arvore da tarefa sem mudanca desde a revisao).
- Auditor: sessao independente do implementador e do revisor (Claude Sonnet 5.5, agente de auditoria). Nao editou codigo, nao commitou. Este arquivo foi gravado em `documentacoes/reviews/` (caminho do projeto), nao em `docs/historico/`.
- Fontes lidas: relatorio, `runner.mjs`, `poc.mjs` (provision), lesson 00 e indice, ADR-017, ticket ENT-DEC-003 (AC-1..3), branches irmas para a colisao de numeracao.

## Reproducao pelo auditor
Node v24.22.1 (`~/.local/opt/node-v24.22.1-linux-x64/bin`), container descartavel `audit-dec003` (`pgvector/pgvector:pg16`, 127.0.0.1:55611, senha aleatoria nao registrada, tmpfs), destruido ao final (`docker ps -a --filter name=audit-dec003` = 0). Scripts em scratchpad, fora do repositorio.

- REVIEW-001 CONFIRMADO. Migration `CREATE TABLE b1(x int); COMMIT; CREATE TABLE b2(x int); SELECT 1/0;` via `migrateTenant` do HEAD: 1a execucao `division by zero`; 2a execucao `relation "b1" already exists`; `schema_migrations` vazia; `to_regclass('b1')` existe, `b2` nao. Tenant preso, como descrito.
- REVIEW-002 CONFIRMADO. Bloco `ts` da lesson extraido literalmente (so a porta trocada para o container): falha com `relation "schema_migrations" does not exist`. Com a tabela criada manualmente, o mesmo codigo executa (rc 0). Banco `poc_tenant_01` tambem so existe durante `run.sh`.
- Nao executado: REVIEW-003/004/005 (avaliados por leitura do codigo; REVIEW-005 e dedutivel: o hash cobre a string decodificada, logo CRLF muda o digest, mas nao foi reproduzido), run.sh completo (ja reproduzido pelo revisor).

## Decisoes por achado
| ID | Sev. original | Sev. avaliada | Decisao |
| --- | --- | --- | --- |
| REVIEW-001 | MEDIO | MEDIO (dados; afirmacao do ADR falsa sem a guarda) | APLICAR |
| REVIEW-002 | MEDIO | MEDIO | APLICAR |
| REVIEW-003a | BAIXO | BAIXO | APLICAR |
| REVIEW-003b | BAIXO | BAIXO | ADIAR |
| REVIEW-004 | BAIXO | BAIXO | ADIAR |
| REVIEW-005 | BAIXO | BAIXO ("precisa de validacao" mantido) | ADIAR |
| REVIEW-006 | BAIXO | BAIXO | APLICAR (itens 1, 2 e 3 parciais; ver abaixo) |
| REVIEW-007 | BAIXO | BAIXO | ADIAR |

### REVIEW-001 — APLICAR
- Criterio: ADR-017 e o procedimento afirmam "falha faz ROLLBACK completo" (AC-2/AC-3, atomicidade por migration); `runner.mjs:60-62` envia `m.sql` em simple query multi-statement dentro de `BEGIN` do runner, e um `COMMIT` interno o quebra. Defeito real, reproduzido, em perfil critico: a garantia central da PoC so vale por convencao textual.
- Observacao sobre o plano do revisor: o item (b) ("conferir txid/`now() = transaction_timestamp()`") esta confuso e nao e confiavel; descartar. Plano corrigido abaixo.
- Plano minimo: (1) `runner.mjs`: funcao `assertTransactional(m)` chamada em `migrateTenant` antes do `BEGIN` (ou em `loadMigrations`), removendo comentarios `--`/`/* */` e literais `'...'`/`$$...$$` de forma simples e rejeitando `\b(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE|PREPARE TRANSACTION)\b` em nivel de statement, `CONCURRENTLY` e `VACUUM`; sem escape silencioso (migration que exija fora de transacao e outro fluxo, fora do escopo da PoC). Limitacao residual a registrar: lint textual nao pega SQL dinamico (`DO`/`EXECUTE`); a revisao de migration continua sendo gate. (2) `poc.mjs`: dois testes novos: migration com `COMMIT` interno rejeitada antes de executar (nada criado, versao ausente) e migration com erro SQL real no 2o statement (rollback total e retomada), cobrindo tambem o ponto 3 de REVIEW-006. (3) ADR-017 e procedimento: trocar a afirmacao incondicional por "rollback completo, garantido pela rejeicao estatica no runner; lint e requisito do runner de producao (DAT-*)". (4) Atualizar `saida-poc.txt` rodando `run.sh` de novo.
- Risco da mudanca: baixo (PoC descartavel; falso positivo do lint e visivel e barato). Teste esperado: os dois novos casos no `poc.mjs` + `run.sh` verde.

### REVIEW-002 — APLICAR
- Criterio: CLAUDE.md exige exemplos que compilem/executem ou sejam marcados como pseudocodigo; a entrega afirma exemplo executavel. Reproduzido.
- Plano minimo: tornar o exemplo autossuficiente (`CREATE TABLE IF NOT EXISTS schema_migrations ...` igual ao runner; comandos `docker run` descartavel em 127.0.0.1 com `PGPASSWORD` gerado e `CREATE DATABASE`, ou apontar para a conexao do `run.sh`), explicar de onde vem `PGPASSWORD`; rodar o trecho e registrar o resultado na entrega. Sobre o pre-requisito "uso de Docker" sem lesson: nao criar lesson artificial; reescrever o pre-requisito como "Docker local (a lesson de Docker ainda nao existe; bloco 4 do indice)". Risco: nulo. Teste: executar o exemplo do zero em container novo.

### REVIEW-003 — dividido
- 003a APLICAR: `provision()` (`poc.mjs:25-33`) nao chama `assertDbName` antes de `DROP DATABASE ... WITH (FORCE)`, enquanto a decisao 2 do ADR descreve allowlist + `escapeIdentifier` como contrato do provisioner. Divergencia entre ADR e unico provisioner demonstrado; correcao de uma linha. Teste: chamada com nome invalido lanca antes de qualquer SQL (pode ser parte do teste negativo de REVIEW-001). Risco: nulo.
- 003b ADIAR: `failAfter`/`holdMs` na assinatura de `migrateTenant` sao ganchos da PoC; o runner de producao nasce em DAT-*, nao aqui (ADR-017, consequencias). Impacto residual: se o codigo for copiado, falha induzivel por configuracao. Retomada: DAT-002 (runner de producao) deve injetar ganchos so em teste; registrar essa frase no mesmo trecho do ADR editado em REVIEW-001 (custo de uma linha, sem novo codigo).

### REVIEW-004 — ADIAR
Real mas de baixo impacto: `ROLLBACK` apos queda de conexao mascara a causa. Nao afeta aceite da PoC nem dados (o servidor desfaz a transacao ao perder a sessao). Condicao de retomada: runner de producao em DAT-002; requisito anotado no ADR (`ROLLBACK ... .catch(() => {})` preservando a causa, teste com `pg_terminate_backend`).

### REVIEW-005 — ADIAR
"Precisa de validacao" nao e falso positivo; nao reproduzido por mim, mas o mecanismo e evidente (hash da string decodificada; CRLF/BOM alteram o digest). Nao ha checkout Windows nem `.gitattributes` neste repositorio hoje. Impacto residual: abort do runner em tenants ja migrados. Condicao de retomada: DAT-002 (runner de producao) ou primeiro contribuidor em Windows; registrar no ADR o requisito "hash sobre bytes e `*.up.sql text eol=lf`" (mesma edicao do ADR de REVIEW-001) e testar com CRLF no runner de producao.

### REVIEW-006 — APLICAR (parcial)
- Aplicar: (1) corrigir no arquivo de diffs a frase "Nenhum commit existe ainda" e na entrega a de futuro ("Sera criado um unico commit"), registrando que o commit existe e que o SHA e informado no relatorio de integracao (o SHA nao pode constar no proprio commit); com a correcao de REVIEW-001/002/003a, o fix entra como commit adicional documentado, com diffs reais atualizados. (2) citar tempos como "uma execucao local" com faixa (2,4-3,8 s sequencial; 0,86-1,2 s concorrencia 4) em vez de valor unico. (3) caso de erro SQL real (coberto em REVIEW-001).
- Nao exigir: reescrever o cenario C do checksum para editar arquivo em disco (equivalente verificado pelo revisor).

### REVIEW-007 — ADIAR
Senha em `docker inspect` de container local descartavel em 127.0.0.1 e aceitavel; tag `pg16` em vez de digest e risco menor de reprodutibilidade. Sem acao agora. Retomada: quando o Postgres entrar em CI (FND-*/DAT-*), fixar digest.

## Colisao do numero 00 das lessons — acao do COORDENADOR
Evidencia: `tarefa/dec-002` tem `lessons/00 - Sessao opaca e revogacao.md`; `tarefa/dec-003` tem `lessons/00 - Migracoes SQL forward-only no PostgreSQL.md`; ambas editam `lessons/README.md`. As branches das demais tarefas (dec-001/004/006) so tem `.gitkeep` e README base. Nao compete ao executor renumerar na branch da tarefa (nao ve a outra branch; renumerar la criaria nova colisao e conflito). Decisao: tratar na integracao `revisao/2026-10-25-ep00-ep01-fundacao`, por quem coordena a integracao:
1. Ordem pedagogica (CLAUDE.md): bloco 5 (PostgreSQL/migracoes) antes do bloco 7 (seguranca/sessao). Portanto `00 - Migracoes SQL forward-only no PostgreSQL.md` permanece 00 e `00 - Sessao opaca e revogacao.md` vira `01 - Sessao opaca e revogacao.md`.
2. Fazer o rename (git mv) na revisao/, atualizar `lessons/README.md` (resolver o conflito mantendo as duas linhas e a ordem), e todos os links relativos na lesson e na documentacao de DEC-002 (e referencias cruzadas em DEC-003); o texto de DEC-003 sobre renumeracao pode ficar.
3. Verificar com `grep -rn "00 - Sessao opaca"` (e URL-encoded `00%20-%20Sessao`) que nao restam referencias ao nome antigo; registrar no relatorio de integracao.
4. Se mais lessons entrarem no mesmo lote, recalcular a numeracao global dessa forma, ainda na integracao. Nada disso entra no plano do executor desta correcao.

## Plano consolidado para o review-loop-driver (somente IDs APLICAR)
REVIEW-001, REVIEW-002, REVIEW-003a, REVIEW-006 (itens 1-3), mais as linhas de ADR para 003b/004/005 (documentais, sem codigo). Arquivos tocados: `runner.mjs`, `poc.mjs`, `evidencia/saida-poc.txt`, ADR-017, procedimento roll-forward, lesson 00, entrega e arquivo de diffs, `lessons/README.md` se o texto de pre-requisito mudar. Nao tocar na numeracao das lessons. Rodar `run.sh` e anexar saida real; revisor independente valida a correcao.

## Pontos confirmados que nao mudam
AC-1 (ADR aceito) segue pendente de decisao humana; ADR em status Proposto nao e DONE de AC-1. AC-2 e AC-3 atendidos, com a ressalva de AC-3/atomicidade que REVIEW-001 corrige. Nenhuma vulnerabilidade foi adiada ou rejeitada; os ADIAR sao melhorias de runner de producao fora da PoC.

## Veredito
CORRECOES_NECESSARIAS. Veredito original do revisor (APPROVED WITH NOTES) preservado; o gate consolidado depende da correcao de REVIEW-001/002/003a/006 e da revalidacao independente. Primeiro ciclo de correcao; sem historico anterior a preservar.
