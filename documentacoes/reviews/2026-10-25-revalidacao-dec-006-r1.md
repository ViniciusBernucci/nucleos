# Revalidacao focal DEC-006 r1 (revisor independente)

- Tarefa: ENT-DEC-006 (ADR-020 + PoC). Branch `tarefa/dec-006`, worktree `/home/vinicius/nucleos-worktrees/tarefa/dec-006`.
- Correcao revisada: `9a500a43d0c97bb1ace603be2cffd9ec619b4414` (pai `8105de1285b90b46b55d78de139506fbb0f55045`). HEAD confirmado; arvore limpa. Sem edicao e sem commit.
- Itens: REVIEW-001, 002, 003, 004, 006, 007 e `authTagLength` de 008 (IDs de `2026-10-25-auditoria-dec-006.md`).
- Execucao propria: Node 24.22.1, Docker, `node:22-alpine`, `--network none`. Container/volumes dec006 destruidos ao final (0 restantes; conferido tambem apos a interrupcao anterior, sem orfaos).

## Verificacoes executadas
1. `node --test poc.test.mjs` (HEAD): 7/7 passam.
2. Mutacoes do teste (copias fora do repositorio): vazamento do segredo injetado e o teste AC-2 DEVE falhar.
   - A: sentinela no log do broker (`/proc/1/fd/1`): AC-2 falha (detectado).
   - B: tenant iniciado com `-e X=<segredo>`: AC-2 falha (detectado).
   - C: arquivo extra com segredo no volume `/tenants/tenant-b/stray.txt`: AC-2 falha (detectado).
   - D: segredo em stderr de chamada ao broker: AC-2 e desastre completo falham (detectado).
   Os demais testes permanecem verdes nas mutacoes A-C. Controle negativo real confirmado.
   (Uma primeira tentativa de mutacao foi invalida por erro de expansao de shell minha e foi refeita; so os resultados acima valem.)
3. Ataques manuais ao broker (store/KEK sinteticos, container descartavel):
   - UID: create a,b; revoke a; recreate a; create c => a=10003, b=10002, c=10004, nextUid=10005. Todos distintos.
   - Traversal: `../../victim/x`, `..`, `a/b`, vazio => "nome de tenant invalido"; `/victim` e `/x` nao existem; `/tenants` so com a,b,c.
   - Copia antiga do store + KEK: `recovered: secretZ` (reproduzido, como previsto; ver REVIEW-003).
   - KDF: frase vazia e "curta" rejeitadas; blob grava `{name:scrypt,N:131072,r:8,p:1}`.
   - Desastre: sem KEK `verify-store` => `{ok:false,reason:kek-ausente}`, rc=2; restore com frase, `verify-store` ok (3), `redeliver-all` entrega 3, conteudos corretos (c e a), revogado com `{revoked:true}`.

## Resultado por ID
| ID | Resultado | Evidencia |
| --- | --- | --- |
| REVIEW-001 | RESOLVIDO | `allocUid` com `nextUid` persistido e fallback `max+1`; UIDs distintos no ataque e no teste (inclui store legado sem `nextUid`). |
| REVIEW-002 | RESOLVIDO | Allowlist + confirmacao `dirname==root` antes de qualquer E/S, aplicada a create/rotate/retire-previous/revoke/verify-store; nada criado fora da raiz; teste negativo com 11 nomes x 4 comandos e snapshot. |
| REVIEW-003 | RESOLVIDO | Desenho mantido (decisao do auditor). ADR item 4 renomeado para "revogacao por descarte da DEK embrulhada", declara que NAO e crypto-shredding verdadeiro, ressalvas de copias do store/KEK unica/credencial no destino. README, comentario do broker e documento da entrega alinhados; nenhuma afirmacao de irrecuperabilidade indevida (grep). Teste afirma que `wrappedDek`/`secrets` somem do store vivo. O ataque da copia antiga continua possivel e esta documentado como limitacao. |
| REVIEW-004 | RESOLVIDO | Scanner por canal com uma unica `hits()`: inspect, logs (stdout+stderr), env, environ, `/proc/*/cmdline`, saida de todas as chamadas ao broker, metadados e conteudo dos volumes com allowlist, `image inspect`; isolamento via leitura real de `/run/secrets/<outro>` falhando; controle negativo por canal; mutacoes A-D detectadas. Limites (historico de imagem e outras codificacoes) registrados no ADR item 7. Ressalva menor: o "log do broker" do teste e o log do PID 1 (`sleep`), entao so cobre o que o processo imprime via exec, coberto pelo canal "saida das chamadas ao broker". |
| REVIEW-006 | RESOLVIDO | scrypt N=2^17,r=8,p=1 gravado e autenticado na AAD (`mk-backup:v1:scrypt:N:r:p`); minimo 16 caracteres; N fraco recusado; N/p/versao adulterados falham. ADR admite que o minimo nao garante entropia. |
| REVIEW-007 | RESOLVIDO | `redeliver-all` implementado e testado em desastre completo; `verify-store` retorna `{ok:false,reason}` com rc=2 e o teste distingue `kek-ausente` de `kek-invalida`; ADR declara dependencia humana apos reboot (KEK em tmpfs) e que o backup no mesmo volume e so do PoC. |
| REVIEW-008 (authTagLength) | RESOLVIDO | `authTagLength:16` em cifrar e decifrar; ADR item 2 cita tag fixada. O restante de 008 segue ADIADO, registrado no ADR. |

## ADR e adiados
- ADR-020 segue `Status: Proposto (somente o usuario pode torna-lo Aceito)`.
- ADIADOS registrados em Consequencias: REVIEW-005 (persistencia sem lock/atomicidade), restante de REVIEW-008 (formato de producao), REVIEW-009 (audit.log adulteravel), com destino/retomada em FND-006/PRV-004.
- Pendencia declarada no ADR (nao bloqueante para a revalidacao): versao minima do Docker para `volume-subpath` nao verificada (PoC em 29.8.1).

## Regressoes
Nenhuma identificada: AC-1 (rotacao/revogacao sem reiniciar outros tenants, `stamp` igual) e AC-2 continuam passando; 7/7 no HEAD.

## Nao verificado
Citacoes web (docs.docker.com, openbao.org) nao reverificadas; concorrencia de creates (adiada em 005).

## Veredito: APPROVED WITH NOTES
Todos os IDs APLICAR estao RESOLVIDOS; sem REGRESSAO. Notas: limitacao do ADR sobre copia antiga do store com KEK permanente, itens adiados e versao minima do Docker. Aceite do ADR cabe somente ao usuario.
