# Revalidacao focal r1 - FND-001 e LOC-001 (2026-10-25)

Revisor independente (sem edicao de codigo). Escopo: somente os IDs abaixo, os commits de correcao e o raio de impacto.

| ID | Commit | Resultado |
| --- | --- | --- |
| FND-001/REVIEW-003 | 54448cb (pai a995596) | RESOLVIDO |
| LOC-001/REVIEW-002 | 4623970 (pai 8d5d19a) | RESOLVIDO |

## FND-001/REVIEW-003 - RESOLVIDO
Evidencia executada em `/home/vinicius/nucleos-worktrees/tarefa/fnd-001`:
- Porta ocupada: servidor trivial 200 em 127.0.0.1:8001; `make up` falhou (`ERRO: porta 8001 (tenant-runtime) ja esta em escuta`, make rc=2, script rc=1), nenhum pid-file criado, nenhum componente subiu (so a 8001 do servidor de teste em escuta). Mesmo resultado com a 3002 ocupada (rc=1, sem pid-files).
- Fluxo normal: `make up` rc=0, `make health` 7/7 OK; `down` deixa 0 portas em escuta (repetido 3x, 0 portas e sem pid-files). Uma leitura isolada de "1 porta" logo apos o primeiro `down` nao se reproduziu em 3 repeticoes (provavel latencia de encerramento do socket); sem evidencia de defeito.
- `down` com PID alheio: pid-file apontando para processo vivo que nao e lider de grupo (pgid diferente) -> processo permaneceu vivo e o pid-file foi removido. PID inexistente (999999) e conteudo nao numerico ("abc") -> ignorados, rc=0. `.run` ausente -> rc=0 (antes `exit 0`, agora `return 0`: correto tambem quando `down` e chamado por `up`). Observacao: PID alheio que seja lider do proprio grupo ainda e morto; limitacao inerente a heuristica do plano (igualdade pgid==pid), aceita pelo plano de correcao.
- `make lint` rc=0; `make test` rc=0 (4 pytest passed + TS).
- Regressoes procuradas: com `set -euo pipefail`, `pgid_de` usa `|| true` (ok); `porta_em_escuta` roda em subshell (fd 3 nao vaza); falha de saude chama `down` e retorna 1 (limpa os filhos); o laco de espera sai cedo se o PID morreu. Sem regressao. Diff de codigo restrito a `scripts/local.sh` (+ documentacao da entrega).

Nao ha achados novos.

## LOC-001/REVIEW-002 - RESOLVIDO
- `git diff 8d5d19a 4623970`: 1 arquivo (`documentacoes/transversal/2026-10-25-loc-001-regras-stack-typescript.md`), +4/-1, todas as linhas dentro da secao "Pendencias". Nada alem dela mudou.
- A frase "Nenhuma pendencia conhecida" nao existe mais (grep vazio). A secao lista: aprovacao de H-1, comandos reais de build/teste apos ENT-FND-001, SHA/mensagem do commit no fechamento do lote (cobre LOC-001/REVIEW-001 ADIAR) e QA independente pendente. Consistente com o campo Estado ("aguardando review independente") e com H-1 nao aprovada.
- Arvore limpa; links nao tocados.

## Veredito
Ambos RESOLVIDO. Nenhuma REGRESSAO, nenhum AINDA PRESENTE. Processos de teste encerrados (0 portas 3000-3002/8001-8004 em escuta; servidores auxiliares finalizados).
