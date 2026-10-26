#!/usr/bin/env bash
# AC-2 (FND-004): nenhuma porta publicada pelo Compose do projeto pode escutar fora de 127.0.0.1.
# 1) lista as portas publicadas (docker) e exige bind 127.0.0.1 em cada uma (ss);
# 2) tenta conectar (nc) pelo IP da LAN da maquina: deve ser recusado.
set -uo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DC=(docker compose --env-file "$DIR/.env.local" -f "$DIR/compose.dev.yml" --profile core --profile runtime --profile observability)
fail=0
mapfile -t pubs < <(docker ps --filter label=com.docker.compose.project=nucleos-dev --format '{{.Ports}}' | grep -oE '[^ ,]+:[0-9]+->' | sed -E 's/->$//' | sed -E 's/^(.*):([0-9]+)$/\1 \2/' | sort -u)
[ "${#pubs[@]}" -gt 0 ] || { echo "FALHA lan: nenhuma porta publicada encontrada (ambiente no ar?)"; exit 1; }
lan_ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | grep -v '^127\.')
for l in "${pubs[@]}"; do
  addr=${l% *}; port=${l##* }
  [ "$addr" = "127.0.0.1" ] || { echo "FALHA publicada em $addr:$port (esperado 127.0.0.1)"; fail=1; }
  [ -n "$port" ] || continue
  bind=$(ss -ltnH "sport = :$port" | awk '{print $4}' | sort -u | tr '\n' ' ')
  case "$bind" in
    "127.0.0.1:$port ") echo "OK    porta $port escuta so em 127.0.0.1" ;;
    *) echo "FALHA porta $port escuta em: ${bind:-nada} (esperado 127.0.0.1)"; fail=1 ;;
  esac
  for lan_ip in $lan_ips; do
    if nc -z -w 2 "$lan_ip" "$port" 2>/dev/null; then echo "FALHA $lan_ip:$port acessivel pela LAN"; fail=1
    else echo "OK    $lan_ip:$port recusado"; fi
  done
done
[ -n "$lan_ips" ] || echo "AVISO sem IPv4 nao-loopback; teste nc ignorado (ss ja prova o bind)"
exit "$fail"
