# Auditoria de review - DEC-009 (object storage, ADR-023)

- **Auditor:** sessao independente (Claude Sonnet 5.5), distinta do implementador e do revisor. Nao editou codigo.
- **Relatorio de origem:** [2026-10-26-review-dec-009.md](2026-10-26-review-dec-009.md) (APPROVED WITH NOTES, commit `1fe0e18`).
- **Tarefa:** ENT-DEC-009, lote 2026-10-25-ep00-ep01-fundacao, perfil CRITICO (ADR-023 esta Proposto; a decisao final e humana).
- **Worktree/branch:** `/home/vinicius/nucleos-worktrees/tarefa/dec-009`, `tarefa/dec-009`. Base `d00e8df`; HEAD auditado `1fe0e18` (sem mudancas desde a revisao; commits da tarefa `ae94179`, `8bb3a0f`). Arvore limpa.
- **Lido:** CLAUDE.md, SKILL do auditor, relatorio, ENT-DEC-009 (AC-1..3), ADR-023, `run-poc.sh`, `poc.mjs`, `politica.mjs`, trechos de `sigv4.mjs`. ADR-018/020 e threat model por referencia do ADR/relatorio. Nao foi executado nada (PoC nao reexecutado; fica ao implementador).

## Decisoes

| ID | Sev. original | Sev. avaliada | Decisao | Resumo |
| --- | --- | --- | --- | --- |
| REVIEW-001 | MEDIO | MEDIO | APLICAR | Teste de TTL tautologico; `presign` nao chama `validarTtl` |
| REVIEW-002 | MEDIO | MEDIO | APLICAR | Lock/versao/SSE medidos com `s3:*`, nao com a politica real do tenant |
| REVIEW-003 | BAIXO | BAIXO | APLICAR | Credenciais raiz em arquivos 0644/0755 |
| REVIEW-004 | BAIXO | BAIXO | APLICAR | Varredura nao cobre KMS nem credenciais STS |
| REVIEW-005 | BAIXO | BAIXO | APLICAR | Check `..%2F` nao prova confinamento |
| REVIEW-006 | BAIXO | BAIXO | APLICAR (script) / ADIAR (licenca e pin de digest) | Pull implicito de imagem `latest` |
| REVIEW-007 | BAIXO | BAIXO | APLICAR | ADR generaliza revogacao medida so no MinIO |

## Justificativa e instrucoes

### REVIEW-001 - APLICAR
- Evidencia: `poc.mjs` testa `validarTtl(0)` e `validarTtl(TTL_MAXIMO_SEGUNDOS + 1)`, ambos derivados da constante; mutar a constante nao falha. `sigv4.mjs:84` `presign(metodo, bucket, chave, expiraSegundos, ...)` nao valida TTL. O ADR-023 decisao 5 e ENT-DAT-006 tratam 300 s como regra do servidor, entao o PoC deve demonstra-la.
- Instrucao: em `poc.mjs` usar literais (`validarTtl(300) === 300`, `validarTtl(301)` rejeita, `validarTtl(0)`, `validarTtl(1.5)`, `validarTtl("60")` rejeitam). Fazer o wrapper do PoC que gera URLs (ou `presign`, via import de `politica.mjs`) chamar `validarTtl` antes de assinar; adicionar check de que `presign(..., 301)` lanca antes de qualquer assinatura. Os `presign` existentes usam 60 s e 1 s (o 1 s da expiracao deve continuar valido). Teste esperado: mutar a constante para 604800 deve produzir FALHA.
- Risco de regressao: baixo; so a chamada de expiracao com TTL 1 s e os TTL 60 devem continuar aceitos (TTL minimo 1).

### REVIEW-002 - APLICAR
- Evidencia: `backupECriptografia()` usa usuario com `s3:*` (`total`/`pol-enc`); `politicaBucketDoTenant` so permite Get/Put/DeleteObject e ListBucket. O ADR decisao 8 diz "medido" sem qualificar a credencial. A configuracao recomendada (bucket por tenant + versionamento + lock) nunca foi medida com a credencial real do tenant; o `DELETE` de versao recusado pode refletir so a ausencia do cabecalho de bypass. Isto afeta DAT-006/backup (SEC-14) e e barato de medir no MinIO local.
- Instrucao: (a) criar usuario com `politicaBucketDoTenant(bucket)` num bucket com lock + default retention GOVERNANCE (e outro versionado); assertar: PUT funciona e devolve versionId; DELETE com `versionId` sem bypass e recusado; DELETE com `x-amz-bypass-governance-retention: true` e recusado (AccessDenied, pois falta `s3:BypassGovernanceRetention`/`DeleteObjectVersion`); GET `?versionId=` da versao antiga: registrar o resultado real (esperado AccessDenied por falta de `s3:GetObjectVersion`) como achado de projeto, nao ajustar a politica para passar. Se `del()` nao aceitar cabecalho extra, estender `sigv4.mjs` minimamente. (b) Registrar o DELETE simples do tenant (cria delete marker) como risco aceito/pendencia: o tenant apaga o dado corrente, mas a versao permanece. (c) Qualificar ADR decisao 8 e registro: "medido no MinIO com credencial de tenant (politica P)" ou, se alguma parte nao for medida, dizer explicitamente. Manter SSE com `s3:*` apenas se o texto disser que mede criptografia em repouso, nao autorizacao.
- Risco: o resultado pode contradizer o texto atual do ADR (ex.: tenant nao le versoes antigas); nesse caso o texto do ADR e que muda, nao a politica para forcar passagem. Manter 0 residuos de container/volume.

### REVIEW-003 - APLICAR
- Evidencia: `run-poc.sh:38-41` define `0755`/`0644` em segredos raiz e KMS, e em `mc/config.json`, que contem o segredo raiz. O mc ja roda com `--user "$(id -u)"` (`poc.mjs`), logo `mc/` nao precisa ser legivel por outros. Regra do projeto: nunca expor segredos; o aviso do registro cobre so `ps`.
- Instrucao: manter `mc/` em `0700`/`0600`. Para os segredos do MinIO, preferir `docker run --user "$(id -u):$(id -g)"` mais preparar o volume com `chown` por container auxiliar (o `POC_HELPER_IMAGE` ja existe) e manter `0700`/`0600`. Se o MinIO nao subir assim, alternativa minima: `chown` dos arquivos ao UID do container por container auxiliar (mantendo `0400`) ou, no ultimo caso, registrar no cabecalho do script e no registro que o PoC assume host de usuario unico, e reduzir a janela. Verificar com `ls -l` dentro do script (aviso) que nenhum arquivo e legivel por "outros" salvo a alternativa registrada.
- Risco: baixo/medio de o MinIO nao conseguir ler os segredos ou gravar no volume; o fallback documentado cobre.

### REVIEW-004 - APLICAR
- Evidencia: `run-poc.sh:70-76` varre 11 segredos; faltam `kms-key` e `SecretAccessKey`/`SessionToken` do STS (`assumirPapel`), embora hoje nada seja impresso.
- Instrucao: no `run-poc.sh` incluir o valor de `kms-key` (parte apos `poc-key:` e o valor inteiro) na lista; em `poc.mjs` chamar `segredo` equivalente para registrar em `segredos.txt` SecretAccessKey e SessionToken de cada `assumirPapel`. Atualizar a contagem registrada ("segredos verificados: N"). Opcional: varrer tambem os arquivos de saida.
- Risco: nenhum funcional; a contagem de segredos na saida registrada muda.

### REVIEW-005 - APLICAR
- Evidencia: `poc.mjs:157-159`; `confinada` e verdadeira se o PUT nao der 200 ou se outra chave (que nunca seria escrita) der 404/403: nao prova nada, e o `%2F` e re-codificado por `enc`. Check fraco num teste de seguranca (SEC-08) e correcao e barata.
- Instrucao: remover o check fraco ou substitui-lo por: apos o PUT, listar `tenants/` com credencial de plataforma (ou a credencial de B para `tenants/b/`) e assertar que nenhuma chave nova apareceu em `tenants/b/` e que, se gravado, o objeto existe apenas sob `tenants/a/`. Atualizar o nome do check e a contagem registrada. Manter `validarChaveDoTenant` como evidencia principal.
- Risco: baixo.

### REVIEW-006 - APLICAR parcialmente; ADIAR o restante
- Evidencia: `run-poc.sh:14-16,44-48`; `docker image inspect` ja roda, mas `docker run` pode baixar `latest`. O ADR ja registra AGPLv3 e a verificacao de distribuicao como pendente (item humano).
- APLICAR: fazer `docker image inspect` fatal e usar `--pull=never` nos `docker run` do MinIO, mc e helper; aceitar `MINIO_IMAGE` com `@sha256:`. Mensagem de erro clara para a imagem ausente.
- ADIAR: fixar digest por padrao e verificar licenca/distribuicao do MinIO. Impacto residual: reprodutibilidade e risco legal do candidato MinIO. Motivo: depende de decisao humana de provedor e de consulta externa. Retomada: ao aceitar/rejeitar o ADR-023 (pendencia 4 do registro) ou antes da DAT-006/PRV-004. Nao tratar MinIO como recomendado sem essa verificacao.

### REVIEW-007 - APLICAR
- Evidencia: ADR decisao 6 apresenta "Medido: apagar a chave invalida imediatamente as URLs..." como regra geral; foi medido so com usuario MinIO. Tratar a medicao de um provedor como regra geral engana a decisao humana.
- Instrucao: acrescentar "(MinIO; reconfirmar no provedor escolhido)" e, no procedimento (iii), manter o teste negativo como passo obrigatorio por provedor. Revisar da mesma forma outras frases de "medido" no ADR (decisao 1 e 8) para dizer "no MinIO". Alinhar a pendencia 7 do registro.
- Risco: nenhum.

## Lacunas essenciais do review
Nenhuma que bloqueie. Observacoes: (1) o review nao verificou `ListAllMyBuckets` e `GetBucketLocation` em provedores reais (declarado no ADR como trade-off); (2) nao mutou `sigv4.mjs` nem os caminhos de SSE/lock (declarado), coberto parcialmente pela REVIEW-002; (3) a conferencia de precos e das paginas de provedores nao foi feita (limitacao declarada).

## Limitacoes desta auditoria
Leitura de codigo e documentos; o PoC nao foi executado e nenhuma mutacao foi repetida. O comportamento esperado de MinIO nas instrucoes da REVIEW-002 (nega bypass/leitura de versao) e uma previsao a confirmar na reexecucao. Nenhum provedor real foi acessado.

## Veredito
**CORRECOES_NECESSARIAS** (IDs APLICAR: REVIEW-001, 002, 003, 004, 005, 006 parcial, 007). Nenhum achado critico ou alto. Apos as correcoes: reexecutar `run-poc.sh`, atualizar `-saida-poc.txt`, `-diffs.md`, registro, ADR e lesson 08, e passar por revisao independente. O gate do ADR continua pendente de aceite humano.
