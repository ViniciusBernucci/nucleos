# Revalidacao focal DEC-004 rodada 3 (BUG-001)

- Revisor/QA independente (nao implementou). Modo: revalidacao focal, sem edicao.
- Worktree: `/home/vinicius/nucleos-worktrees/tarefa/dec-004`, branch `tarefa/dec-004`, HEAD `9a4ca6313c176f340d420a68154601ebacd5c50a` (pai `d65b84292b5f68cb4d3128bacda465c9c24a4847`); arvore limpa.
- Decisao de origem: `2026-10-25-auditoria-notas-fnd-002-fnd-009-dec-004.md` (DEC-004/BUG-001, APLICAR).
- Execucao em copia (`git archive 9a4ca63`) no scratchpad, Node v24.22.1; a worktree nao foi alterada.

## Evidencias
| Verificacao | Resultado |
|---|---|
| `validator.mjs` `refresh()`: `validate.jwks(j)` antes de montar o `Map`, dentro do mesmo `try` | Presente (linha 45); usa o schema ja usado pelo CP (`control-plane.mjs:56`) |
| `npm ci` | OK |
| `npm test` (corrigido) | 23 testes, 23 pass, 0 fail |
| Mutacao: `validator.mjs` do pai `d65b842` com o teste novo (copia) | 22 pass, 1 FAIL: teste "REFRESH atomico: JWKS malformado ..." (teste e discriminante) |
| Casos null, `{}`, `{keys:[]}`, `{keys:null}`, 4 chaves | Cada um lanca Error (nao TypeError); `keys`, `minVer`, `lastRefreshOk` inalterados; `refreshFailures` incrementa; token valido segue aceito com cache |
| JWKS valido continua aceito | Testes de ROTACAO (duas chaves, refresh por kid desconhecido) passam |
| `npm run demo` | OK; narrativa inalterada (ACEITO 60 s, REJEITADO 91 s `revocation_state_stale`, `version_revoked`; 9 chamadas) |
| Saidas `saida/*.txt` | Atualizadas 22 -> 23 coerentes com a execucao |
| ADR-018 | Status segue `Proposto (somente decisao humana o torna Aceito)`; linha 32 ampliada para JWKS (1 a 3 chaves) e revogacao |
| `bad_issuer` | Intocado: `validator.mjs:85` fora do diff da correcao |
| Escopo do diff | validator (3 linhas), 1 teste, README (22->23), ADR, saidas, doc da entrega e diffs; sem expansao |

## Resultado por ID
| ID | Veredito |
|---|---|
| DEC-004/BUG-001 | RESOLVIDO (VERIFICADO) |
| DEC-004/QA-bad_issuer | Inalterado (REJEITADO pelo auditor; codigo intocado) |

Regressoes: nenhuma. Nota: `npm ci` reporta avisos de `npm audit` (preexistentes, fora do escopo; nao avaliados). Limite de rodadas de DEC-004 (3) consumido; nao ha pendencia aberta no escopo.

Veredito: RESOLVIDO. Nenhum commit criado por este revisor.
