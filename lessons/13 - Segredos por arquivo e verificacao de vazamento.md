# 13 - Segredos por arquivo e verificacao de vazamento

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26. Numeracao PROVISORIA (o coordenador reconcilia a posicao na trilha). Exemplos executados com Docker 29.8.1 / Compose 5.5.1, Node 24.22.1, TypeScript 5.9.3 e Python 3.13.

## Objetivo, pre-requisitos e posicao

Entregar um segredo a um container **sem** que ele apareca em `docker inspect`, variaveis de ambiente, argumentos de processo, logs ou imagem, e **provar** isso com um teste. Pre-requisitos: [12 - Configuracao tipada com falha rapida](12%20-%20Configuracao%20tipada%20com%20falha%20rapida.md), nocoes de Docker/Compose e de permissoes Unix. Posicao: bloco 7 (seguranca) e bloco 4 (Docker).

## Modelo mental

- Variavel de ambiente **nao e cofre**: aparece em `docker inspect`, em `/proc/<pid>/environ` e herda para processos filhos. Argumentos aparecem em `/proc/<pid>/cmdline`.
- Arquivo `0400` montado em `/run/secrets/<nome>` so e legivel pelo dono. A configuracao guarda apenas o **caminho** (`DATABASE_PASSWORD_FILE`).
- Camadas: (1) o esquema recusa segredo no ambiente; (2) o leitor recusa arquivo com permissao aberta, link simbolico, vazio ou de outro dono; (3) o Compose so referencia o caminho do arquivo; (4) um teste procura um **valor sentinela** em todos os canais, com um **controle negativo** (passar o mesmo valor por `-e` precisa ser detectado, senao o teste nao prova nada).
- Hardening do container: `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, usuario nao-root, limites de CPU/memoria/PIDs, portas so em `127.0.0.1`, imagem por **digest**.

## Do minimo ao padrao do projeto

Minimo (inseguro): `environment: {DB_PASSWORD: abc123}` no Compose, versionado e visivel no `inspect`.

Padrao do projeto (trecho de `infrastructure/docker/compose.deploy.yml`):

```yaml
services:
  postgres:
    image: pgvector/pgvector:0.8.7-pg18-trixie@sha256:9d9c930220cb9bf2f956d10a8f909cf9973d9672ca0278aef2c1e6facccad2e0
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/database_password   # caminho, nao valor
    secrets: [database_password]
    read_only: true
    cap_drop: [ALL]
    cap_add: [CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID]      # allowlist do entrypoint oficial
secrets:
  database_password:
    file: ${SECRETS_DIR:?informe SECRETS_DIR}/database_password
```

Leitura segura em Python (mesmas regras do TypeScript em `packages/config`):

```python
import os
import stat


def read_secret(path: str) -> str:
    st = os.lstat(path)  # lstat: nao segue link simbolico
    if not stat.S_ISREG(st.st_mode) or st.st_mode & 0o077 or st.st_uid != os.getuid():
        raise PermissionError("segredo deve ser arquivo regular 0400/0600 do mesmo dono")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, encoding="utf-8") as fh:
        return fh.read().removesuffix("\n")
```

Teste de vazamento (essencia de `infrastructure/docker/tests/ambientes.test.mjs`):

```bash
SENT=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n')
docker inspect "$CID" | grep -c "$SENT"                       # esperado: 0
docker exec "$CID" sh -c 'cat /proc/[0-9]*/environ /proc/[0-9]*/cmdline | tr "\0" "\n"' | grep -c "$SENT"  # 0
docker logs "$CID" 2>&1 | grep -c "$SENT"                     # 0
```

## Conexao com a entrega

Overlays `compose.staging.yml`/`compose.prod.yml`, `scripts/deploy.sh` (deploy/rollback por digest) e `make test-ambientes`. Documento: [entrega FND-006](../documentacoes/infraestrutura/2026-10-26-fnd-006-configuracao-tipada-e-ambientes.md); runbook: [deploy por digest](../documentacoes/runbooks/deploy-staging-producao.md); decisao: ADR-020.

## Erros comuns e trade-offs

- Bind mount de arquivo herda dono/modo do **host**: `uid`/`mode` do Compose nao se aplicam fora do Swarm; ajuste o dono no host.
- `docker exec` e root do host leem o arquivo: o segredo em claro existe no tmpfs/disco do host (limite aceito no ADR-020).
- Segredo em `command:` ou `ENTRYPOINT` aparece em `cmdline`: leia o arquivo dentro do programa.
- O scanner so ve os canais que varre; nao cobre camadas antigas de imagem nem outras codificacoes do valor.
- `cap_drop: ALL` quebra imagens que trocam de usuario no entrypoint (Postgres): adicione so o minimo e documente.

## Verificacao e exercicios

- `make lint-deploy` (estatico) e `make test-ambientes` (efemero: config invalida, `docker inspect`, deploy e rollback).
- Exercicio 1: troque `POSTGRES_PASSWORD_FILE` por `POSTGRES_PASSWORD` no overlay e veja `make lint-deploy` falhar.
- Exercicio 2: por que o teste inclui o controle negativo com `-e`?
- Pergunta: qual canal de vazamento a varredura nao cobre e como cobri-lo?
