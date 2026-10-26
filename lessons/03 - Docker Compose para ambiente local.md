# 03 - Docker Compose para ambiente local

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26.
Versoes: Docker 29.8.1 com Compose v2 (exemplo executado com `redis:8.8.3-alpine`); no repositorio, Node 24.22.1, TypeScript 5.9.3 e Python 3.13.17 rodam dentro dos containers do perfil `runtime`. Os comandos foram executados em 2026-10-26.

## Objetivo, pre-requisitos e posicao na trilha

Aprender a descrever um ambiente de desenvolvimento reprodutivel e **seguro por padrao** em Docker Compose: perfis, healthchecks, ordem de subida, segredos descartaveis, portas somente em loopback, volumes e um smoke test. Pre-requisitos: conceito de container/imagem e rede, shell, e as nocoes de segredo da lesson [02 - Qualidade estatica em TypeScript e Python](02%20-%20Qualidade%20estatica%20em%20TypeScript%20e%20Python.md) (gitleaks). Posicao: bloco 4 (Docker e Compose). Vem antes de [04 - CI bloqueante e cadeia de suprimentos](04%20-%20CI%20bloqueante%20e%20cadeia%20de%20suprimentos.md) (o CI sobe servicos auxiliares com a mesma ideia) e de [06 - Isolamento de telemetria por tenant](06%20-%20Isolamento%20de%20telemetria%20por%20tenant.md) (o PoC de telemetria e um Compose descartavel).

## Modelo mental

O Compose e uma **receita declarativa**: voce descreve servicos, redes e volumes; o Docker converge o estado real para a receita.

- **Perfil** (`profiles`) = "grupo opcional". Servico sem perfil sempre sobe; com perfil, so quando o perfil e ativado (`--profile`).
- **Healthcheck** = o servico diz se esta pronto, nao apenas "o processo existe". `depends_on: {condition: service_healthy}` usa isso para ordenar a subida.
- **Porta publicada** e uma decisao de seguranca: `"127.0.0.1:19379:6379"` expoe so na propria maquina; `"6379:6379"` expoe em todas as interfaces (LAN, wifi do cafe).
- **Volume nomeado** guarda dado entre reinicios; `down -v` o apaga (reset).
- Ambiente local nao e producao: segredos sao gerados na hora, descartaveis e fora do Git.

## Conexao com a implementacao real

Entrega ENT-FND-004: [registro](../documentacoes/infraestrutura/2026-10-25-fnd-004-ambiente-local-docker-compose.md). Em `infrastructure/docker/compose.dev.yml` (projeto `nucleos-dev`):

- Perfis: `core` (postgres, redis, minio, minio-init, minio-seed, mailpit, proxy), `runtime` (web, api, tenant-provisioner e 4 servicos Python) e `observability` (otel-collector). Confirmado com `docker compose config --services`: `core` lista `mailpit minio minio-init minio-seed postgres proxy redis`; `observability` lista `otel-collector`.
- Todas as portas sao `127.0.0.1:<porta>` e fora das comuns (Postgres 15432, Redis 16379, proxy 18080...), para nao colidir com servicos do host.
- Redes `interna` (`internal: true`) e `publicada`: o Docker nao publica portas de containers que estao so em rede interna; por isso datastores ficam nas duas, e a protecao contra a LAN vem do **bind em loopback**, nao da rede interna.
- Segredos: `scripts/gerar-segredos.sh` cria `.env.local` (modo 600, ignorado pelo Git) com senhas aleatorias; o compose usa `${VAR:?mensagem}` e falha sem o arquivo.
- Imagens por tag **e digest**; `security_opt: no-new-privileges`.
- Scripts: `scripts/dev.sh` (sobe e espera `healthy` por polling proprio, porque `up --wait` trata containers one-shot como `minio-init` como falha), `reset.sh`, `smoke.sh`, `verificar-lan.sh`. Alvos: `make compose-up`, `compose-smoke`, `compose-down`, `compose-reset` (`PERFIS="runtime observability"` para os demais perfis; `runtime` exige `make setup && make build`).
- O `otel-collector` e distroless (sem shell), portanto sem healthcheck do Compose: o smoke consulta o `health_check` que ele publica.

## Exemplo executavel (Docker)

Salve como `compose.yml` num diretorio vazio. Usa a mesma imagem do repositorio (`redis:8.8.3-alpine`):

```yaml
name: licao-compose

services:
  redis:
    image: redis:8.8.3-alpine
    profiles: ["core"]
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:?defina REDIS_PASSWORD}
    command: ["sh", "-c", "exec redis-server --requirepass \"$$REDIS_PASSWORD\""]
    ports: ["127.0.0.1:${REDIS_HOST_PORT:-19379}:6379"]
    healthcheck:
      test: ["CMD-SHELL", "REDISCLI_AUTH=\"$$REDIS_PASSWORD\" redis-cli ping | grep -q PONG"]
      interval: 2s
      timeout: 3s
      retries: 15
    volumes: [redis-data:/data]

  cliente:
    image: redis:8.8.3-alpine
    profiles: ["runtime"]
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:?defina REDIS_PASSWORD}
    command: ["sh", "-c", "REDISCLI_AUTH=\"$$REDIS_PASSWORD\" redis-cli -h redis ping && sleep 3600"]
    depends_on:
      redis: {condition: service_healthy}

volumes:
  redis-data:
```

Rode (a senha e gerada na hora e nunca impressa):

```bash
export REDIS_PASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc A-Za-z0-9)"
docker compose config --services                      # vazio: nenhum servico sem perfil
docker compose --profile core config --services       # redis
docker compose --profile core up -d --wait            # espera o healthcheck
docker compose --profile core ps --format '{{.Service}} {{.Status}}'   # redis Up ... (healthy)
ss -ltn | grep 19379                                  # 127.0.0.1:19379, nunca 0.0.0.0
(exec 3<>/dev/tcp/127.0.0.1/19379; printf 'PING\r\n' >&3; timeout 2 head -n1 <&3)   # -NOAUTH Authentication required.
docker compose --profile core --profile runtime up -d --wait
docker compose --profile core --profile runtime logs cliente           # PONG
docker compose --profile core --profile runtime down -v                # apaga containers, rede e volume
```

Resultados observados: sem `REDIS_PASSWORD`, `docker compose config` falha com `required variable REDIS_PASSWORD is missing a value`; o `ss` mostra apenas `127.0.0.1:19379`; o ping sem senha recebe `-NOAUTH`; o `cliente` so inicia depois de `redis` ficar `healthy` e imprime `PONG`. Depois do `down -v`, nenhum container do projeto `licao-compose` resta.

Pegadinha verificada: `docker compose --profile runtime config` **falha** com `service "cliente" depends on undefined service "redis": invalid compose project`, porque o perfil `core` nao foi ativado. O mesmo ocorre no repositorio real (`--profile runtime` sozinho: `service "web" depends on undefined service "redis"`). Por isso `scripts/dev.sh` sempre inclui `core`.

## Do minimo ao padrao do projeto

1. Minimo: um servico com `image` e `ports: ["6379:6379"]` (exposto em todas as interfaces, sem senha: inseguro mesmo em dev).
2. Loopback: `127.0.0.1:` no mapeamento.
3. Pronto de verdade: `healthcheck` e `depends_on: service_healthy`.
4. Segredos: `${VAR:?}` + arquivo gerado, modo 600, ignorado.
5. Perfis para nao subir tudo sempre; redes separadas; imagens por digest; `no-new-privileges`.
6. Prova automatizada: `smoke.sh` (pg_isready, `redis-cli ping`, `mc ls`, curl nos endpoints, `healthz` de cada servico runtime) e `verificar-lan.sh` (`ss -ltn` por porta publicada e `nc -z` no IP da LAN da maquina deve ser recusado). O smoke termina com `SMOKE OK` ou `SMOKE COM FALHAS` e exit code.

## Erros comuns e trade-offs

- `ports: ["6379:6379"]`: publica em `0.0.0.0`. Docker ignora regras de firewall simples (ele mexe no iptables); prefira o bind em loopback.
- Achar que rede `internal: true` protege portas publicadas: ela impede publicar, nao filtra a LAN.
- Healthcheck que depende de ferramenta ausente na imagem (o MinIO da Chainguard nao tem `grep`; o collector nao tem shell). O primeiro `up` do projeto falhou por isso.
- `up --wait` com containers one-shot: tratados como erro; o projeto usa polling proprio.
- Perfil com `depends_on` em servico de outro perfil inativo invalida o projeto (ver acima).
- Montar o repositorio inteiro em modo escrita dentro de container: o projeto monta `:ro` e esconde `.env.local` com `/dev/null:/workspace/infrastructure/docker/.env.local:ro`; so `apps/web` e gravavel (Next precisa).
- Senha do Redis aparece em `ps` dentro do container: aceitavel em dev, nunca em producao.
- Nao se aplica: staging e producao (FND-006) usam outros arquivos, secrets de verdade e Dockerfiles proprios.

## Verificacao e exercicios

- Verificacao: no repositorio, `make setup && make build && make compose-up PERFIS=runtime && make compose-smoke PERFIS=runtime` (espere `SMOKE OK`) e `make compose-down`. Exige Docker, `ss` e `nc`; usa apenas containers descartaveis em `127.0.0.1`.
- Exercicio 1: troque o bind para `"19379:6379"` no exemplo e rode `ss -ltn | grep 19379`. O que mudou? Desfaca.
- Exercicio 2: remova o `depends_on` e use `docker compose logs cliente`. Em que situacoes o ping falha por corrida?
- Exercicio 3: acrescente um servico no perfil `observability` e confirme que ele nao sobe com `--profile core`.
- Exercicio 4: por que `reset.sh --destroy-only` e `down -v` sao preferiveis a apagar volumes manualmente?
