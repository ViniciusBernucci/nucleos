// Verificacoes puras de staging/producao (FND-006): usadas por verificar-deploy.mjs (make lint)
// e pelo teste efemero (tests/ambientes.test.mjs). Sem dependencias externas.

const SECRET_TOKENS = new Set([
  "PASS", "PASSWORD", "PASSWD", "PWD", "SECRET", "TOKEN", "KEY", "APIKEY", "CREDENTIAL", "CREDENTIALS", "DSN",
]);
const SECRET_SUFFIXES = ["PASSWORD", "PASSWD", "SECRET", "TOKEN", "APIKEY", "PRIVATEKEY", "CREDENTIAL", "CREDENTIALS"];

/**
 * Nome de variavel que indica segredo literal (ADR-020 item 1): algum token separado por `_`
 * (PASS, SECRET, TOKEN, KEY, DSN, ...) ou sufixo colado (DBPASSWORD). Nomes terminados em
 * `_FILE`/`_PATH` (caminho) sao o formato permitido. Mesma regra de packages/config e config-py.
 */
// Sem excecao para PWD/OLDPWD aqui: em Compose/inspect qualquer PWD e literal declarado (REV-002). A isencao
// vale so no carregador do processo (packages/config e config-py), que le o ambiente do shell.
export function isSecretName(name) {
  const up = name.toUpperCase().replace(/[.-]/g, "_");
  if (/_(FILE|PATH)$/.test(up)) return false;
  if (up.split("_").some((t) => SECRET_TOKENS.has(t))) return true;
  const compact = up.replaceAll("_", "");
  return SECRET_SUFFIXES.some((suf) => compact.endsWith(suf));
}

const SECRET_VALUE_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "chave privada PEM"],
  [/[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i, "URL com senha embutida"],
  [/\bAKIA[0-9A-Z]{16}\b/, "chave de acesso AWS"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "token GitHub"],
  [/^[A-Za-z0-9+/=_-]{32,}$/, "valor opaco longo (possivel segredo)"],
];

/** Lista achados de segredo em um mapa de variaveis de ambiente (nomes e padroes, nunca valores). */
export function secretFindingsInEnv(env) {
  const findings = [];
  for (const [name, value] of Object.entries(env)) {
    const v = value ?? "";
    if (v !== "" && isSecretName(name)) findings.push(`${name}: nome de segredo no ambiente`);
    for (const [re, label] of SECRET_VALUE_PATTERNS) {
      if (re.test(v)) findings.push(`${name}: ${label}`);
    }
  }
  return findings;
}

/** Converte `Config.Env` do docker inspect (["K=V"]) em objeto. */
export function envListToObject(list) {
  return Object.fromEntries((list ?? []).map((kv) => {
    const i = kv.indexOf("=");
    return i < 0 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)];
  }));
}

/** Padroes de segredo literal em TEXTO de arquivo (compose, scripts): `chave: valor-literal`. */
export function secretFindingsInText(text) {
  const out = [];
  text.split("\n").forEach((line, i) => {
    const code = line.replace(/\s+#.*$/, "");
    const m = /^\s*([A-Za-z0-9_.-]+)\s*[:=]\s*(.+)$/.exec(code);
    if (m?.[1] !== undefined && m[2] !== undefined && isSecretName(m[1])) {
      const key = m[1];
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      const ok = key === "secrets" || val === "" || val.startsWith("$") || val.startsWith("/run/secrets/") || /^(\[\]|\{\})$/.test(val);
      if (!ok) out.push(`linha ${i + 1}: valor literal para "${key}"`);
    }
    for (const [re, label] of SECRET_VALUE_PATTERNS.slice(0, 4)) {
      if (re.test(code)) out.push(`linha ${i + 1}: ${label}`);
    }
  });
  return out;
}

/** `cap_add` permitido por servico (excecoes documentadas; ISO-002 reavalia). */
const CAP_ADD_ALLOW = { postgres: ["CHOWN", "DAC_OVERRIDE", "FOWNER", "SETGID", "SETUID"] };

const DIGEST = /@sha256:[0-9a-f]{64}$/;
const LOOPBACK = "127.0.0.1";

/** Valida a configuracao renderizada (`docker compose config --format json`). Devolve violacoes. */
export function verifyRendered(cfg, label) {
  const v = [];
  const add = (svc, msg) => v.push(`${label}/${svc}: ${msg}`);
  for (const [name, s] of Object.entries(cfg.services ?? {})) {
    if (!DIGEST.test(s.image ?? "")) add(name, "imagem sem digest @sha256");
    if (s.restart !== "unless-stopped") add(name, "restart deve ser unless-stopped");
    if (s.privileged) add(name, "privileged proibido");
    if (s.network_mode === "host" || s.pid === "host" || s.ipc === "host") add(name, "namespace do host proibido");
    if (!(s.cap_drop ?? []).includes("ALL")) add(name, "cap_drop deve conter ALL");
    if (!(s.security_opt ?? []).includes("no-new-privileges:true")) add(name, "falta no-new-privileges");
    if (s.read_only !== true) add(name, "read_only obrigatorio");
    if (!s.mem_limit || !s.cpus || !s.pids_limit) add(name, "limites de memoria, CPU e PIDs obrigatorios");
    if (s.user === undefined && name === "api") add(name, "usuario nao-root obrigatorio");
    if (/^(0|root)(:|$)/.test(s.user ?? "")) add(name, "usuario root proibido");
    const allow = CAP_ADD_ALLOW[name] ?? [];
    for (const cap of s.cap_add ?? []) {
      if (!allow.includes(cap)) add(name, `cap_add ${cap} fora da allowlist`);
    }
    for (const opt of s.security_opt ?? []) {
      if (/unconfined/i.test(opt)) add(name, `security_opt ${opt} proibido`);
    }
    for (const t of s.tmpfs ?? []) {
      if (!/\bnoexec\b/.test(t) || !/\bnosuid\b/.test(t)) add(name, "tmpfs deve ter noexec e nosuid");
    }
    if (name === "postgres" && JSON.stringify(Object.keys(s.networks ?? {})) !== '["interna"]') {
      add(name, "postgres deve estar somente na rede interna");
    }
    for (const p of s.ports ?? []) {
      if (p.host_ip !== LOOPBACK) add(name, "porta publicada fora de 127.0.0.1");
    }
    for (const vol of s.volumes ?? []) {
      // Somente volumes nomeados; qualquer bind de caminho do host e proibido (segredos entram por `secrets`).
      if (vol.type !== "volume") add(name, `mount ${String(vol.type)} proibido (${String(vol.source)})`);
    }
    for (const f of secretFindingsInEnv(s.environment ?? {})) {
      // *_FILE contem so o caminho em /run/secrets: o valor nao e segredo.
      if (/^[A-Z0-9_]+_FILE: /.test(f)) continue;
      add(name, `ambiente: ${f}`);
    }
    for (const arg of [...(s.command ?? []), ...(s.entrypoint ?? [])]) {
      for (const f of secretFindingsInText(String(arg))) add(name, `command: ${f}`);
    }
  }
  if (cfg.networks?.interna?.internal !== true) add("rede", "interna deve ter internal: true");
  for (const [n, sec] of Object.entries(cfg.secrets ?? {})) {
    if (sec.environment !== undefined || sec.content !== undefined) add(n, "secret deve ser file:, nunca environment/content");
  }
  return v;
}
