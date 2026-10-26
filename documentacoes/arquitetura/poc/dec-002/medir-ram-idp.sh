#!/usr/bin/env bash
# Mede RAM em repouso de Keycloak (start-dev, H2) em container descartavel 127.0.0.1. Sem dados reais.
set -euo pipefail
NAME=poc-dec002-kc; PORT=${POC_KC_PORT:-58080}
trap 'docker rm -f $NAME >/dev/null 2>&1 || true' EXIT
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --name $NAME -p 127.0.0.1:$PORT:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD="$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')" \
  quay.io/keycloak/keycloak:26.0 start-dev >/dev/null
for i in $(seq 1 120); do
  curl -fs -o /dev/null "http://127.0.0.1:$PORT/realms/master" && break; sleep 2
done
echo "keycloak pronto apos ~$((i*2)) s"
sleep 20
for n in 1 2 3; do echo "MEDIDA_RAM keycloak_idle: $(docker stats --no-stream --format '{{.MemUsage}}' $NAME)"; sleep 5; done

# --- Ory Kratos (dsn=memory), mesma abordagem ---
KN=poc-dec002-kratos
trap 'docker rm -f $NAME $KN >/dev/null 2>&1 || true' EXIT
D=$(cd "$(dirname "$0")" && pwd)
docker run -d --name $KN -p 127.0.0.1:54433:4433 -v "$D/kratos.yml:/etc/config/kratos.yml:ro" \
  -v "$D/kratos-identity.schema.json:/etc/config/identity.schema.json:ro" \
  oryd/kratos:v1.3.1 serve --config /etc/config/kratos.yml --dev >/dev/null
for i in $(seq 1 60); do curl -fs -o /dev/null "http://127.0.0.1:54433/health/ready" && break; sleep 1; done
sleep 10
for n in 1 2 3; do echo "MEDIDA_RAM kratos_idle: $(docker stats --no-stream --format '{{.MemUsage}}' $KN)"; sleep 3; done
