#!/usr/bin/env bash
# Instala e confere o Contexto (memoria local dos agentes de IA) neste checkout.
# Idempotente: pode ser executado de novo sem efeitos colaterais.
# Nao usa sudo, nao instala Node/Git, nao troca de branch e nao altera arquivos versionados.
# Aplica scripts/contexto-projeto.json (include, exclude e workflow) em .contexto/project.json.
#
# Uso: bash scripts/instalar-contexto.sh [--codex]
#   --codex  registra tambem o servidor MCP na configuracao global do Codex
# Variavel opcional: CONTEXTO_DIR (padrao: pasta "contexto" ao lado do repositorio)
set -euo pipefail

REPO_URL="https://github.com/ViniciusBernucci/contexto.git"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
TOOL_DIR="${CONTEXTO_DIR:-$(dirname "$ROOT")/contexto}"
WITH_CODEX=false
for arg in "$@"; do
  case "$arg" in
    --codex) WITH_CODEX=true ;;
    *) echo "Opcao desconhecida: $arg" >&2; exit 2 ;;
  esac
done

ok() { echo "[ok] $*"; }
warn() { echo "[aviso] $*"; }
fail() { echo "[erro] $*" >&2; exit 1; }
contexto() { node "$TOOL_DIR/contexto.mjs" "$@" --project "$ROOT" 2>/dev/null; }
# expect PADRAO MENSAGEM COMANDO...: guarda a saida do comando e falha se o padrao nao aparecer.
expect() {
  local pattern="$1" message="$2" output
  shift 2
  output="$("$@" || true)"
  grep -q -- "$pattern" <<<"$output" || fail "$message"
}
mcp_initialize() {
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}' | contexto mcp
}

cd "$ROOT"
echo "Repositorio: $ROOT"
echo "Ferramenta:  $TOOL_DIR"

# 1. Pre-requisitos
command -v node >/dev/null || fail "Node nao encontrado. Instale o Node v22.13 ou maior."
command -v git >/dev/null || fail "Git nao encontrado. Instale o Git 2.36 ou maior."
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)' \
  || fail "Node $(node --version) e antigo. Precisa ser v22.13 ou maior (veja o passo 1 do README)."
git --version | node -e 'const [a, b] = require("fs").readFileSync(0, "utf8").match(/(\d+)\.(\d+)/).slice(1).map(Number); process.exit(a > 2 || (a === 2 && b >= 36) ? 0 : 1)' \
  || fail "$(git --version) e antigo. Precisa ser 2.36 ou maior (veja o passo 1 do README)."
ok "Node $(node --version) e $(git --version)"

# 2. Ferramenta ao lado do repositorio
if [ -f "$TOOL_DIR/contexto.mjs" ]; then
  ok "Contexto ja presente em $TOOL_DIR"
else
  [ -e "$TOOL_DIR" ] && fail "$TOOL_DIR existe, mas nao contem contexto.mjs. Revise a pasta antes de continuar."
  git clone --quiet "$REPO_URL" "$TOOL_DIR"
  ok "Contexto clonado em $TOOL_DIR"
fi

# 3. Registro do repositorio (hook local do Git)
expect '"registered":true' "setup falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" setup --project \"$ROOT\"" contexto setup
ok "Repositorio registrado"

# 4. Branch de trabalho
BRANCH="$(git symbolic-ref --quiet --short HEAD || true)"
case "$BRANCH" in
  main|master|"") fail "Voce esta em '${BRANCH:-HEAD destacado}'. O Contexto nao prepara main/master. Rode 'git switch developer' e execute este script de novo." ;;
esac
expect '"prepared":true' "ensure falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" ensure --project \"$ROOT\"" contexto ensure
expect '"ok":true' "doctor falhou. Rode: node \"$TOOL_DIR/contexto.mjs\" doctor --project \"$ROOT\"" contexto doctor
ok "Branch '$BRANCH' preparada (.contexto/ criada e indexada)"

# 4.1 Configuracao versionada do projeto (fontes indexadas e workflow das skills)
CONFIG_STATUS="$(node -e '
const fs = require("fs");
const [file, versioned] = process.argv.slice(1);
const config = JSON.parse(fs.readFileSync(file, "utf8"));
const project = JSON.parse(fs.readFileSync(versioned, "utf8"));
const keys = ["include", "exclude", "workflow"];
if (keys.every(key => JSON.stringify(config[key]) === JSON.stringify(project[key]))) { console.log("igual"); process.exit(0); }
for (const key of keys) config[key] = project[key];
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
console.log("atualizada");
' "$ROOT/.contexto/project.json" "$ROOT/scripts/contexto-projeto.json")"
if [ "$CONFIG_STATUS" = "atualizada" ]; then
  expect '"registered":true' "setup --config-from falhou." contexto setup --config-from "$ROOT"
  expect '"sources"' "index falhou." contexto index
  ok "Configuracao de scripts/contexto-projeto.json aplicada e indice refeito"
else
  ok "Configuracao de scripts/contexto-projeto.json ja aplicada"
fi

# 5. Teste de busca e do servidor MCP
expect '"source"' "A busca de teste nao retornou resultados." contexto search --query "lessons" --limit 1
expect '"contexto-local"' "O servidor MCP nao respondeu." mcp_initialize
ok "Busca e servidor MCP funcionando"

# 6. Integracao com os clientes de IA
if [ -f .mcp.json ] && grep -q '"contexto"' .mcp.json; then
  ok ".mcp.json do Claude Code presente"
else
  warn ".mcp.json sem o servidor 'contexto'. Siga os passos 6 a 8 do README (uma vez no repositorio)."
fi
if command -v claude >/dev/null; then
  if grep -q '^contexto:.*Connected' <<<"$(claude mcp list 2>/dev/null || true)"; then
    ok "Claude Code conectado ao Contexto"
  else
    warn "Claude Code nao mostrou 'contexto ... Connected'. Rode 'claude mcp list' dentro de $ROOT."
  fi
fi
if [ "$WITH_CODEX" = true ]; then
  command -v codex >/dev/null || fail "--codex informado, mas o Codex nao esta instalado."
  NAME="contexto-$(basename "$ROOT")"
  if codex mcp get "$NAME" >/dev/null 2>&1; then
    ok "Codex ja tem o servidor '$NAME'"
  else
    codex mcp add "$NAME" -- "$(command -v node)" "$TOOL_DIR/contexto.mjs" mcp --project "$ROOT" >/dev/null
    ok "Servidor '$NAME' registrado no Codex"
  fi
fi

echo "Instalacao concluida."
