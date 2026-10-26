# Runbook — deploy e rollback de staging e producao por digest

Criado em 2026-10-26 (ENT-FND-006). **Estado: ensaiado apenas em ambiente efemero local (127.0.0.1); nenhum ambiente de staging ou producao esta declarado (sem VPS, Q-03). Execucao real: BLOCKED ate haver host declarado.**

## Objetivo

Publicar uma versao da API (e do Postgres de controle) por **digest de imagem**, verificar `readyz` e reverter pelo digest anterior, sem segredo em variavel de ambiente, imagem, repositorio ou linha de comando (ADR-020).

## Matriz de ambientes

| Ambiente | Onde | Dados | Segredos | Compose |
| --- | --- | --- | --- | --- |
| local | maquina do desenvolvedor | sinteticos | descartaveis (`.env.local`, FND-004) | `compose.dev.yml` |
| desenvolvimento/CI | runner efemero | sinteticos | gerados por execucao | `scripts/ci/servicos-auxiliares.sh` |
| staging | host proprio (nao declarado) | **somente sinteticos; nunca dados reais** | arquivos proprios de staging | `compose.deploy.yml` + `compose.staging.yml` |
| producao | VPS (nao declarada) | reais | arquivos proprios de producao | `compose.deploy.yml` + `compose.prod.yml` |

Staging e producao nunca compartilham arquivos de segredo, volumes nem rede.

## Pre-requisitos

- Docker Engine e Compose v2 no host; `node` (para `scripts/verificar-deploy.mjs`) e `curl`.
- Imagem da API publicada com digest verificado pelo CI (`build-images`: build, trivy, SBOM). Assinatura de imagem (cosign) **nao** esta adotada; ver pendencias.
- `SECRETS_DIR`: diretorio `0700` com o arquivo `database_password`, modo `0400`, dono = UID do servico (`10001`). Criar fora do repositorio, por pessoa autorizada, sem passar o valor por argumento ou historico do shell (ex.: `umask 077; head -c 24 /dev/urandom | base64 | tr -dc A-Za-z0-9 > "$SECRETS_DIR/database_password"; chown 10001:10001 ...; chmod 0400 ...`).
- Checkout do repositorio na revisao a ser publicada.

## Deploy

```bash
export SECRETS_DIR=/etc/nucleos/staging-segredos        # nunca versionar
infrastructure/docker/scripts/deploy.sh staging deploy registry.exemplo/nucleos/api@sha256:<64 hex>
```

O script executa, nesta ordem, e para no primeiro erro:

1. recusa tag (so `repositorio@sha256:<64 hex>`); confere modo `0400`, dono e ausencia de link simbolico do segredo;
2. `scripts/verificar-deploy.mjs`: configuracao renderizada com digest, hardening, limites, portas em `127.0.0.1` e sem segredo;
3. `docker pull` do digest (digest imutavel; a verificacao de conteudo e a do CI);
4. migracao do controle: **NA hoje** (nao ha migracoes versionadas); quando existir `scripts/migrar-controle.sh`, o deploy o executa e aborta se falhar;
5. guarda `anterior` e sobe Postgres (saudavel) e API;
6. aguarda `GET http://127.0.0.1:3001/readyz`; sucesso grava o digest em `atual`. Falha: rollback automatico para `anterior` (ou `stop api` se nao houver).

## Rollback

```bash
infrastructure/docker/scripts/deploy.sh staging rollback    # volta ao digest anterior e confere readyz
infrastructure/docker/scripts/deploy.sh staging status
```

Limite: migracoes de banco sao **forward-only** (lesson 00): o rollback de imagem nao desfaz migracao; migracao incompativel exige correcao para frente.

## Validacao

- `readyz` 200; `docker inspect` sem segredo: `make test-ambientes` reproduz o ensaio em containers efemeros.
- Hardening: `docker inspect -f '{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.CapDrop}} {{.HostConfig.RestartPolicy.Name}}'` => `true [ALL] unless-stopped`.
- Portas: apenas `127.0.0.1:3001` (a borda publica e o proxy, FND-007).

## Rotacao e falhas conhecidas

- Segredo rejeitado na subida (`permissoes`, `dono`, `ausente`): corrigir o arquivo (`chown 10001:10001`, `chmod 0400`) e repetir o deploy; a API imprime so o nome da variavel e o motivo.
- Rotacao do segredo do banco exige alterar a senha no Postgres e o arquivo, e reiniciar a API; janela dupla e entrega por tenant sao do broker (ADR-020, PRV-004), fora deste ticket.

## Responsaveis

Operador do host (a definir ao declarar o ambiente); aprovacao do deploy de producao pelo usuario.
