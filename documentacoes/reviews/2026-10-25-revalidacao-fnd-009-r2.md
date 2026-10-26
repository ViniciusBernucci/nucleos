# Revalidacao focal FND-009 rodada 2 - BUG-001

- Revisor/QA independente (nao implementou). Sem edicao de codigo; sem commit.
- Worktree: /home/vinicius/nucleos-worktrees/tarefa/fnd-009, branch tarefa/fnd-009
- Correcao: 7c19dab8afc38a1c3272e6e9d73868412d8f989b (pai 6217fd453ee718797cbb6694b4e1451b363f56d1); HEAD = 7c19dab8..., arvore limpa.
- Ambiente: Node 24.22.1, uv; nproc=4.

## Veredito BUG-001: RESOLVIDO (sem regressao)

## Leitura do diff
- Causa raiz confirmada: em `packages/observability-py/src/nucleos_observability/http.py` o `_dispatch` chamava `_send` (resposta ao cliente) antes de `kit.red.record` e `kit.logger.log`; com ThreadingHTTPServer o cliente podia consultar o log antes da escrita.
- Fix: `_dispatch` passa a devolver `(status, body, extra)` (sem I/O); `_send` ocorre por ultimo, depois de span attrs, RED e log, ainda dentro de `use_context` (correlation id/span ativos) e antes de `span.end()` no `finally`. Ordem log->resposta nao altera campos de RED (method/route/status), do log (campos identicos) nem de span (nome, http.route, status code, ERROR >=500) nem ids (correlation_id e o mesmo no header e no log).
- Assercoes: unica mudanca de teste e a remocao de `time.sleep(0.05)` em `test_header_server_neutro_e_metodos_nao_get_com_red_e_log`; nenhuma assercao removida ou enfraquecida (o sleep era o paliativo; a assercao de ordem `[POST, DELETE, PUT]` e mantida).
- Nota baixa (nao bloqueante): a duracao RED/span agora exclui o tempo de escrita da resposta (antes incluia); mudanca sutil e coerente com medir processamento. Se `_send` falhar (cliente desconectou), log/RED ja foram registrados e o span marca ERROR via except; comportamento aceitavel.

## Medicoes (suite Python completa = 18 testes, `uv run --frozen --all-packages pytest`)
| Cenario | Resultado |
|---|---|
| Fix, sem carga, 30 execucoes | 30 passed / 0 failed |
| Fix, com 4 processos de CPU (nproc=4), 30 execucoes | 30 passed / 0 failed |
| Mutacao (copia no scratchpad: http.py do pai 6217fd4 + teste sem sleep), sob carga, 30 execucoes | 6 passed / 24 failed |

Falhas da mutacao, todas em `test_header_server_neutro_e_metodos_nao_get_com_red_e_log` (linha 295): 22x `['GET','POST','DELETE'] == ['POST','DELETE','PUT']`, 1x `['GET','POST']`, 1x `['POST','GET','DELETE']`. Ou seja, o defeito reaparece sem o fix e some com ele; a causa raiz esta correta. (Observacao: a mutacao usa o teste novo; com o `sleep(0.05)` original a falha ficava mascarada, o que explica a intermitencia anterior.)
Cargas de CPU encerradas (0 processos restantes).

## Gate
- `make setup`: OK. `make lint`: 8/8 tasks, compileall OK. `make test`: TS turbo OK; pytest 18 passed em 9.96 s.
- ACs (regressao): os testes existentes de sentinelas, correlation e OTLP no-op fazem parte dos 18 passed e dos 60 runs do fix; nao reexecutei os cenarios manuais da QA rodada 1 (servicos reais + coletor), cobertos apenas pelos testes automatizados; o diff nao toca em telemetria/exportacao.

## Evidencias
Logs no scratchpad: r2-noload-N.log, r2-load-N.log, r2-mut-N.log (`/tmp/claude-1001/-home-vinicius-nucleos/b6db1bfe-9d03-4f5f-8423-dc23e91e0173/scratchpad/`). Nenhum commit criado.
