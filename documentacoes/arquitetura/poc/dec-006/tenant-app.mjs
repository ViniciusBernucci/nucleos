// Tenant sintetico: observa /run/secrets e loga somente a VERSAO (nunca o valor).
import fs from "node:fs";
import crypto from "node:crypto";
const dir = "/run/secrets";
const read = (f) => { try { return fs.readFileSync(`${dir}/${f}`, "utf8"); } catch { return null; } };
const mode = process.argv[2];
if (mode === "hmac") {
  // uso via docker exec: prova que o valor entregue esta correto sem imprimi-lo
  const out = {};
  for (const f of ["current", "previous"]) { const v = read(f); out[f] = v === null ? null : crypto.createHmac("sha256", v).update("challenge").digest("hex"); }
  console.log(JSON.stringify(out));
} else {
  let last = "";
  setInterval(() => {
    const m = read("meta.json");
    if (m !== last) { last = m; console.log(`tenant secret meta changed: ${m === null ? "absent" : m}`); }
  }, 100);
}
