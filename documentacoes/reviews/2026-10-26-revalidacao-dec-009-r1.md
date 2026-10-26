# Revalidacao focal - DEC-009, rodada de correcao 1/3

- **Revisor:** sessao independente (Claude Sonnet 5.5), distinta do implementador; nao editou codigo.
- **Tarefa:** ENT-DEC-009 (ADR-023 Proposto), perfil CRITICO. Worktree `/home/vinicius/nucleos-worktrees/tarefa/dec-009`, branch `tarefa/dec-009`.
- **Escopo:** IDs APLICADOS REVIEW-001..005, 006 (script), 007 de [review](2026-10-26-review-dec-009.md) (`1fe0e18`) e [auditoria](2026-10-26-auditoria-dec-009.md) (`ffa87fa`); correcoes `70a66c7` (PoC) e `3e18cae` (ADR, registro, diffs, saida, lesson). `git diff 8bb3a0f..HEAD` lido (10 arquivos; review e auditoria entram pelos commits anteriores). HEAD revisado `3e18cae`; arvore limpa antes e depois.

## Verificacoes executadas

| Verificacao | Resultado |
| --- | --- |
| Residuo antes/depois (`docker ps -a`, `docker volume ls`, porta 19000, `git status`) | zero / zero / livre / limpo, antes e depois (tambem apos as 5 mutacoes) |
| `run-poc.sh` reexecutado (efemero, `--pull=never`) | rc 0; **83 OK, 0 FALHA**; `docker port` so `127.0.0.1:19000`; env so com `*_FILE` |
| Modos durante a execucao (`stat`) | dir temporario, `secrets/`, `mc/`: 700; `kms-key`, `root-password`, `root-user`, `mc/config.json`: 600; o script ainda aborta se `find -perm /o+rwx` achar algo |
| Varredura de vazamento | 21 segredos (raiz, KMS valor e arquivo, 12 usuarios, SecretAccessKey/SessionToken do STS), 0 vazamentos; contagem confere com a esperada (3 + 12 + 6) |
| Objeto `..%2F` | listagem de `tenants/b/` tem so 1 chave (a original de B); objeto `..%2F` existe so sob `tenants/a/` (2 checks OK) |
| Saida registrada | execucao original (73 OK) preservada byte a byte (confirmado com `diff` contra `8bb3a0f`); secao "RODADA 1" anexada; mesma estrutura e contagem da minha reexecucao |
| `-diffs.md` | contem literalmente o patch de `70a66c7` (comparacao textual: verdadeiro) e preserva o de `ae94179` |

### Mutacoes (clones `git clone --no-hardlinks` no scratchpad; produto intacto)

| Mutacao | Resultado | Leitura |
| --- | --- | --- |
| A: `TTL_MAXIMO_SEGUNDOS` 300 -> 604800 | 3 FALHA (TTL 301, TTL 604800, presign 301) | REVIEW-001 resolvido (antes: 0 FALHA) |
| B: politica P do tenant com `s3:BypassGovernanceRetention` | 2 FALHA (bypass recusado; lock protege a versao) | teste usa a politica real |
| C: politica P do tenant com `s3:*` | 2 FALHA (mesmos) | idem |
| D: `presign` sem `validarTtl` | 1 FALHA ("presign com TTL 301 recusa antes de assinar") | a ligacao presign/politica e testada |
| E: bucket de lock criado sem `--with-lock` | aborta com excecao (1 FALHA, 75 OK) | falha, embora por excecao e nao por assert; aceitavel |

## Classificacao

| ID | Status | Evidencia |
| --- | --- | --- |
| REVIEW-001 | CORRIGIDO | literais 300 ok/301/1.5/"60"/604800 recusados; `presign` chama `validarTtl` (sigv4.mjs); mutacoes A e D falham |
| REVIEW-002 | CORRIGIDO | lock/versionamento medidos com `politicaBucketDoTenant`, incluindo cabecalho de bypass (403 AccessDenied) e DELETE sem bypass (400 InvalidRequest); mutacoes B, C e E derrubam; rotulos `(s3:*)` e `(tenant)` explicitos |
| REVIEW-003 | CORRIGIDO | modos 700/600 observados em execucao; MinIO le copia 0400 uid 65532 em volume proprio (removido no `trap`); fallback "host de usuario unico" nao foi necessario |
| REVIEW-004 | CORRIGIDO | 21 segredos incluindo KMS e STS; 0 vazamentos |
| REVIEW-005 | CORRIGIDO | check por listagem do prefixo de B + existencia so sob A (nao tautologico) |
| REVIEW-006 (script) | CORRIGIDO | imagem ausente e fatal (`docker image inspect` com mensagem), `--pull=never` em todos os `docker run` (MinIO, mc, helper, versao); `MINIO_IMAGE@sha256` aceito pela variavel. Licenca e pin de digest permanecem ADIADOS (pendencia 4), como decidido |
| REVIEW-007 | CORRIGIDO | ADR decisoes 1, 6, 8 e alternativas dizem "no MinIO"/"reconfirmar"; pendencia 7 do registro alinhada; lesson tambem |

Nenhum REGRESSAO.

## Afirmacao nova do executor (ADR decisao 8)

"Em bucket so versionado, `s3:DeleteObject` basta para apagar uma versao especifica; o object lock protege." **Correta como medida e bem qualificada**: o ADR a introduz como "Medido no MinIO com a credencial real do tenant", o PoC a afirma com assert (DELETE 204 e GET posterior 404 NoSuchVersion), e a protecao do lock foi mutada (B, C, E). A nova pendencia 8 do registro (risco do DELETE simples do tenant e credencial de backup sem apagar/bypass) esta declarada e a decisao proposta no ADR e coerente com ela. Ressalva em REV-001.

## Novos achados

### REV-001 - BAIXO - Decisao 8 nao avisa que a semantica de DeleteObject/versao difere entre provedores
- `documentacoes/arquitetura/adr/0023-...md` decisao 8.
- A frase "`s3:DeleteObject` basta para apagar uma versao especifica" e verdadeira no MinIO medido, mas em AWS S3 apagar versao especifica exige `s3:DeleteObjectVersion` (e ler versao, `s3:GetObjectVersion`); o ADR so diz "no MinIO" para o conjunto. Nao e erro, mas o leitor pode inferir a regra para o provedor final. Correcao: acrescentar "(MinIO; no S3 da AWS a versao exige `s3:DeleteObjectVersion`; reconfirmar no provedor escolhido)". Atenuante: pendencia 7 ja pede reexecutar os testes negativos no provedor.

### REV-002 - BAIXO (informativo) - Item "o tenant le versoes antigas por versionId" e so INFO, sem assert
- `poc.mjs` (blocos `info(...)`): a leitura de versao e o DELETE simples do tenant sao registrados como INFO (nao entram nas 83 verificacoes), enquanto o ADR os cita como medidos. Os valores estao na saida registrada (200 e 204 marker=true); o comportamento e deliberadamente "achado" e nao regra a forcar. Sem acao obrigatoria; se virar requisito, transformar em assert na DAT-006.

### Conferencias sem achado
- ADR-023 continua **Proposto** (cabecalho e indice `adr/README.md`); nenhuma decisao simulada como aceita.
- Honestidade: "medido no MinIO; reconfirmar" presente; AGPLv3/digest adiados declarados no ADR (Consequencias) e no registro.
- Segredos: nenhum valor real nos documentos ou diffs; saida com digests de imagem apenas.
- Arquivos fora do escopo: nenhum (10 arquivos, todos de DEC-009: PoC, ADR, registro, diffs, saida, lesson 08; os 2 de reviews vieram dos commits `1fe0e18`/`ffa87fa`). `lessons/README.md` nao mudou e ja listava a lesson 08.
- Registro cita "o de documentacao seguinte" sem SHA para o commit `3e18cae` (impossivel auto-referenciar); aceitavel, mas o SHA pode ser acrescentado pelo coordenador ao fechar.

## Limitacoes
Provedores reais nao acessados; comportamento observado so na imagem MinIO `RELEASE.2026-10-23T20-06-51Z`; a afirmacao sobre AWS em REV-001 vem de conhecimento da documentacao da AWS, nao verificada nesta sessao; `make lint/test/build` nao reexecutados (arquivos fora dos globs, como no review original); gitleaks nao rodado (varredura manual dos diffs).

## Veredito
**VERIFICADO**: os 7 IDs aplicados estao CORRIGIDOS, sem regressao e sem achado medio ou superior. REV-001 e REV-002 sao baixos e opcionais. O gate do ADR-023 segue dependendo do aceite humano.
