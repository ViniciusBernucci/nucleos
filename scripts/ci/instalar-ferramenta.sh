#!/usr/bin/env bash
# Instala binarios de scanners com versao e SHA-256 fixos (nada de "latest", nada de curl | sh).
# Consulta das versoes/digests: 2026-10-26 (API de releases do GitHub, campo digest do asset).
# Uso: scripts/ci/instalar-ferramenta.sh <gitleaks|osv-scanner|trivy|hadolint|actionlint>...
# Destino: ${FERRAMENTAS_BIN:-$HOME/.local/bin}; no CI e adicionado ao GITHUB_PATH.
set -euo pipefail
destino="${FERRAMENTAS_BIN:-$HOME/.local/bin}"
mkdir -p "$destino"
base="https://github.com"

instalar() { # nome versao url sha256 tipo(bin|tgz) caminho_no_tgz
  local nome="$1" versao="$2" url="$3" sha="$4" tipo="$5" interno="${6:-$1}"
  if [ -x "$destino/$nome" ] && "$destino/$nome" --version 2>&1 | grep -q "$versao"; then
    echo "OK: $nome $versao ja instalado"
    return 0
  fi
  local tmp
  tmp="$(mktemp -d)"
  curl -fsSL --retry 3 -o "$tmp/artefato" "$url"
  echo "$sha  $tmp/artefato" | sha256sum -c - >/dev/null || {
    echo "ERRO: SHA-256 de $nome $versao difere do esperado" >&2
    rm -rf "$tmp"
    exit 1
  }
  if [ "$tipo" = "tgz" ]; then
    tar -xzf "$tmp/artefato" -C "$tmp" "$interno"
    install -m 0755 "$tmp/$interno" "$destino/$nome"
  else
    install -m 0755 "$tmp/artefato" "$destino/$nome"
  fi
  rm -rf "$tmp"
  echo "OK: $nome $versao instalado em $destino (SHA-256 conferido)"
}

for alvo in "$@"; do
  case "$alvo" in
    gitleaks) instalar gitleaks 8.30.1 "$base/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz" 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb tgz ;;
    osv-scanner) instalar osv-scanner 2.7.0 "$base/google/osv-scanner/releases/download/v2.7.0/osv-scanner_linux_amd64" 160c6253e2922e9e0a6a9771c5c4c40a4b3c6090b34a3cdd5e80c96cc2e4218b bin ;;
    trivy) instalar trivy 0.76.1 "$base/aquasecurity/trivy/releases/download/v0.76.1/trivy_0.76.1_Linux-64bit.tar.gz" c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0 tgz ;;
    hadolint) instalar hadolint 2.15.1 "$base/hadolint/hadolint/releases/download/v2.15.1/hadolint-linux-x86_64" c7187db94eeeeca956519a6af171adc31453941a1e777961f6e680f697c8c507 bin ;;
    actionlint) instalar actionlint 1.7.12 "$base/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_linux_amd64.tar.gz" 8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 tgz ;;
    *) echo "ERRO: ferramenta desconhecida: $alvo" >&2; exit 2 ;;
  esac
done
if [ -n "${GITHUB_PATH:-}" ]; then echo "$destino" >> "$GITHUB_PATH"; fi
