# DEC-006 — Gestão de segredos do MVP (ADR-020 e PoC)

Data: 2026-10-25

- **Domínio:** seguranca
- **Solicitação:** [ENT-DEC-006](../backlog/EP-00-decisoes-pocs-e-threat-model/tickets.md#ent-dec-006) (lote 2026-10-25-ep00-ep01-fundacao)
- **Branch:** `tarefa/dec-006`; **base/HEAD inicial:** `4be3ce391a51b9e24cd85f7c894d841636dcd50f`; árvore limpa no início
- **Estado:** correção rodada 2 aplicada (OBS-1 do QA), pronto para nova validação independente; ADR-020 **Proposto** (aceite é do usuário)
- **Autores:** executor de IA (Claude) sob demanda do usuário

## Objetivo, contexto, escopo

Escolher o mecanismo de armazenar, entregar, rotacionar e revogar segredos (plataforma, por tenant, integração do cliente). Escopo: ADR-020, PoC descartável, teste de ausência de segredo em `env`/`inspect`/logs. Fora do escopo: implementação do provisioner/gateway (PRV-004, TGW-004, DAT-009), SOPS+age, OpenBao/Infisical (apenas comparados), rotação da chave mestra, CI (FND-005).

## Resumo da implementação

Broker de ~130 linhas (somente `node:crypto`) com hierarquia chave mestra -> DEK por tenant -> segredo (AES-256-GCM, AAD por tenant/versão), entrega em arquivos 0400 num volume tmpfs com `volume-subpath` por tenant, rotação com janela dupla, revogação por descarte da DEK embrulhada (não é crypto-shredding verdadeiro; ver ADR item 4), trilha de auditoria sem valores e backup/recuperação da chave mestra (scrypt + AES-GCM). Dois tenants sintéticos em containers `--network none`.

## Mudanças por arquivo

- `documentacoes/arquitetura/adr/0020-gestao-de-segredos-do-mvp.md`: ADR-020 (Proposto).
- `documentacoes/arquitetura/poc/dec-006/broker.mjs`, `tenant-app.mjs`, `poc.test.mjs`, `README.md`, `saida-execucao.txt`: PoC, teste e evidência.
- Este documento e o de [diffs](2026-10-25-dec-006-gestao-de-segredos-diffs.md).
- Sem migração, sem configuração global, sem dependências (nenhum `package.json`, `pnpm-lock.yaml`/`uv.lock` intactos). Registro de ferramentas: Node 24.22.1 (`~/.local/opt/node-v24.22.1-linux-x64`), Docker 29.8.1, imagem local `node:22-alpine` dos containers (não puxada da rede); `uv` não usado.

## Decisões e consequências

Ver ADR-020. Alternativas: Compose secrets, SOPS+age, OpenBao, Infisical, env. Fatos de produtos citados no ADR com fonte e data (docs.docker.com/compose/how-tos/use-secrets e openbao.org/docs/what-is-openbao, ambas consultadas em 2026-10-25). Infisical não foi pesquisado; nenhuma afirmação sobre ele.

## Validações (reais)

`PATH=~/.local/opt/node-v24.22.1-linux-x64/bin:$PATH node --test documentacoes/arquitetura/poc/dec-006/poc.test.mjs`: 4 testes, 4 aprovados, 0 falhas (duas execuções; a última em [saida-execucao.txt](../arquitetura/poc/dec-006/saida-execucao.txt)).

- AC-1: criar/entregar/rotacionar/revogar tenant-a; `ID`, `StartedAt` e `RestartCount` de tenant-b inalterados; tenant-a também não reiniciou na rotação; HMAC prova valor entregue correto; store e auditoria sem valores em claro.
- AC-2: sentinelas (segredos v1/v2/b, chave mestra em hex e base64, frase) ausentes em `docker inspect`, `docker logs`, `env`, `/proc/1/environ` e `volume inspect` de broker e tenants, e em `image inspect`. Controle negativo com `-e` confirma que o scanner detecta vazamento.
- AC-3: limitações no ADR-020 (Consequências).
- Backup/recuperação: perda da KEK detectada, frase errada rejeitada, restauração com frase correta idêntica à original.
- Pós-execução: 0 containers e 0 volumes `dec006` remanescentes. Lint/build do monorepo: NA (nenhum arquivo dos workspaces alterado). Ambiente isolado conforme `CLAUDE.md`: containers descartáveis, sem rede, sem portas, sem dados reais.

## Impactos, riscos, rollback

Somente documentos e PoC isolados; rollback = reverter o commit. Riscos de segurança do desenho: ADR-020 (broker caseiro exige revisão independente; custódia do backup).

## Commits e diffs

Commit único local em `tarefa/dec-006` (SHA no retorno ao coordenador, pois não pode constar no próprio commit). Patch do código do PoC em [diffs](2026-10-25-dec-006-gestao-de-segredos-diffs.md); ADR, README do PoC, saída e este documento (escrita em `documentacoes/`) listados acima e não repetidos no patch. Nada foi enviado (sem push).

## Lessons

Nenhuma lesson criada: o bloco "Seguranca: segredos" ainda não tem posição na trilha (os pré-requisitos Docker/TypeScript não foram publicados) e `lessons/README.md` pertence a LOC-001 neste lote. Pendência de ensino: criar a lesson de criptografia envelope e segredos quando a trilha existir.

## Pendências

- Decisão humana: aceitar/rejeitar ADR-020 e custódia do backup da KEK.
- Revisão independente do broker; índice `adr/README.md` ainda sem a linha ADR-020 (arquivo compartilhado, evitado para não conflitar no lote).
- Gate de CI do teste (FND-005/FND-006) e rotação da KEK: trabalho derivado.

## Correção rodada 1 (2026-10-25)

Origem: [auditoria](../reviews/2026-10-25-auditoria-dec-006.md) (veredito CORRECOES_NECESSARIAS) sobre o [review](../reviews/2026-10-25-review-dec-006.md). Partida: HEAD `8105de1285b90b46b55d78de139506fbb0f55045`, árvore limpa. Um novo commit (sem amend), local, sem push/merge; SHA informado ao coordenador. ADR-020 continua **Proposto**. Diff incremental em [diffs](2026-10-25-dec-006-gestao-de-segredos-diffs.md).

Aplicados:
- REVIEW-001: `nextUid` persistido e nunca reutilizado (recriação gera UID novo; store legado inicia em max+1). Teste create/revoke/recreate/create com UIDs distintos e caso legado.
- REVIEW-002: allowlist `^[a-z0-9][a-z0-9-]{0,62}$` antes de qualquer E/S, mais checagem `path.resolve` (defesa em profundidade, inalcançável após a allowlist) e `Object.hasOwn` no store. Testes negativos (`..`, `.`, `../x`, `a/b`, vazio, maiúsculas, espaço, `-x`, `../../victim/x`, 64 caracteres, newline) em create/rotate/retire-previous/revoke; store e árvore de arquivos inalterados.
- REVIEW-003: ADR (item 4), README e este documento passam a "descarte da DEK embrulhada", com as ressalvas de cópias do store, KEK única e credencial no destino. Desenho mantido. Teste de que `wrappedDek`/`secrets` somem do store após revoke (irrecuperabilidade não é testada, de propósito).
- REVIEW-004: `hits()` única; varredura de inspect, logs (stdout+stderr), env, environ, `/proc/*/cmdline`, saída capturada de todas as chamadas ao broker e conteúdo dos volumes com allowlist explícita; controle negativo por canal (env/inspect/environ, logs, argv, arquivo em volume, saída capturada); isolamento por leitura real de `/run/secrets/<outro>` (4 caminhos, nos dois sentidos) com controle positivo.
- REVIEW-006: `{N,r,p}` no blob (N=2^17, r=8, p=1, `maxmem` ajustado), versão e parâmetros na AAD, frase mínima de 16 caracteres, limites de parâmetros na restauração. Testes: vazia/curta rejeitada, p/N/versão adulterados falham, controle íntegro restaura.
- REVIEW-007: `redeliver-all`; teste de desastre completo (apaga KEK e arquivos, KEK ausente e KEK errada reportadas, frase errada rejeitada, restaura, reentrega, `tenantCheck` correto, previous reentregue); `verify-store` retorna `{ok:false,reason}` com saída 2; ADR declara dependência humana após reboot e backup no mesmo volume só no PoC.
- REVIEW-008 (parte): `authTagLength: 16` em cifrar/decifrar e checagem de tamanho do blob.

Adiados e registrados no ADR (Consequências), sem implementação: REVIEW-005 (lock, escrita atômica, auditoria write-ahead; destino FND-006/PRV-004), restante de REVIEW-008 (ID de KEK, autenticar `version`, segredos binários, zerar chaves, HMAC fixo; destino FND-006), REVIEW-009 (integridade do `audit.log`; destino FND-006). Limites do scanner (histórico de imagem, outras codificações) e versão mínima do Docker para `volume-subpath` também registrados. Não houve REJEITAR.

Validação real: `PATH=~/.local/opt/node-v24.22.1-linux-x64/bin:$PATH node --test documentacoes/arquitetura/poc/dec-006/poc.test.mjs`: 7 testes, 7 aprovados, 0 falhas (saída em [saida-execucao.txt](../arquitetura/poc/dec-006/saida-execucao.txt)). A primeira execução falhou em 2 testes por defeitos do próprio teste (prefixo de caminho do varredor de volumes; `sh -c` que faz `exec` e some do argv), corrigidos e reexecutados. Containers com `--network none`, sentinelas sintéticas; ao final 0 containers e 0 volumes `dec006` restantes. Lint/build do monorepo: NA (workspaces intactos). As citações web do ADR não foram reverificadas (sem acesso web).

Lessons: sem alteração; mesma justificativa da seção Lessons (trilha de segurança ainda inexistente; `lessons/README.md` pertence a LOC-001).

Pendências: aceite humano do ADR; nova revisão independente; itens adiados acima.

## Correção rodada 2 (2026-10-26)

Origem: OBS-1 (MÉDIO) do [relatório de QA](../reviews/2026-10-25-qa-dec-006.md): `create` com KEK de 32 bytes válidos porém diferentes da KEK do store retornava sucesso e deixava o tenant irrecuperável; `verify-store`/`redeliver-all` falhavam para o store inteiro. Partida: HEAD `9a500a43d0c97bb1ace603be2cffd9ec619b4414`, árvore limpa. Um novo commit (sem amend), local, sem push/merge; SHA informado ao coordenador. ADR-020 continua **Proposto**. Diff incremental em [diffs](2026-10-25-dec-006-gestao-de-segredos-diffs.md).

Aplicado em `broker.mjs`:
- Canário da KEK (`kekCanary`, bloco aleatório selado pela KEK com AAD fixa) no store; `requireKek` roda em `create`, `rotate` e `retire-previous` antes de qualquer gravação e falha fechado com `kek invalida`. Store legado sem canário: valida pela DEK do primeiro tenant ativo; o canário é gravado na próxima escrita bem-sucedida. KEK ausente ou de tamanho diferente de 32 bytes também falha.
- `redeliver-all`: KEK inválida aborta sem tocar em arquivos (`{ok:false,reason:"kek-invalida"}`, saída 2); com KEK válida segue por tenant e reporta `failed` (também no `audit.log`), saída 2 se houver falha.
- `verify-store`: reporta `tenants-com-falha` com `checked` e `failed` em vez de falhar o store inteiro; `kek-invalida` quando o canário não abre.

Testes novos em `poc.test.mjs` (9 no total): (a) KEK errada (32 bytes aleatórios) com canário e em store legado, e KEK de 16 bytes: `create`, `rotate`, `retire-previous` e `create` de tenant existente falham, e store, `audit.log` e árvore `/tenants` ficam idênticos; KEK correta volta a funcionar e regrava o canário; (b) DEK de um tenant corrompida: `verify-store` e `redeliver-all` reportam apenas esse tenant, entregam os demais (conteúdo verificado), auditoria registra `failed`; KEK errada em `redeliver-all` não entrega nada; store restaurado volta a entregar tudo.

Validação real: `PATH=~/.local/opt/node-v24.22.1-linux-x64/bin:$PATH node --test documentacoes/arquitetura/poc/dec-006/poc.test.mjs`: 9 testes, 9 aprovados, 0 falhas, 70,5 s (saída em [saida-execucao.txt](../arquitetura/poc/dec-006/saida-execucao.txt)), aprovados já na primeira execução. Containers `--network none`, sentinelas sintéticas; ao final 0 containers e 0 volumes `dec006`. Lint/build do monorepo: NA (workspaces intactos).

Limitação residual (registrada no ADR-020, Consequências): o canário detecta KEK trocada, não store adulterado ou restaurado de backup antigo, nem protege o tenant com DEK corrompida (só o isola e o reporta; recuperação por backup do store ou reinformando o segredo); em store legado, DEK corrompida do primeiro tenant ativo faz uma KEK correta ser tratada como inválida. ID/versão da KEK segue em FND-006.

Lessons: sem alteração; mesma justificativa da seção Lessons. Pendências: aceite humano do ADR; nova validação independente; itens adiados anteriores.
