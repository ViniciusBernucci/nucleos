// Sobe web (3000) e API (3001) para desenvolvimento local: `npm run dev` na raiz.
// API: tsc --watch recompila e node --watch reinicia. Somente 127.0.0.1.
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsc = join(raiz, "node_modules", "typescript", "bin", "tsc");
const tsconfigApi = join(raiz, "apps", "api", "tsconfig.json");
const env = { ...process.env, HOST: "127.0.0.1", PORT: "3001" };

// Falha cedo e com mensagem clara se alguma porta ja estiver em uso.
function portaLivre(porta) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.listen(porta, "127.0.0.1", () => srv.close(() => resolve(true)));
  });
}
for (const [nome, porta] of [
  ["web", 3000],
  ["api", 3001],
]) {
  if (!(await portaLivre(porta))) {
    console.error(
      `[dev] porta ${porta} (${nome}) ja esta em uso; encerre o processo que a ocupa e rode de novo.`,
    );
    process.exit(1);
  }
}

// Build inicial: o node --watch precisa de dist/main.js ja existente.
const build = spawnSync(process.execPath, [tsc, "-p", tsconfigApi], {
  cwd: raiz,
  stdio: "inherit",
});
if (build.status !== 0) {
  console.error("[dev] build inicial da API falhou; corrija os erros acima.");
  process.exit(build.status ?? 1);
}

const filhos = [
  spawn(process.execPath, [tsc, "-p", tsconfigApi, "--watch", "--preserveWatchOutput"], {
    cwd: raiz,
    stdio: "inherit",
  }),
  spawn(process.execPath, ["--watch", join("apps", "api", "dist", "main.js")], {
    cwd: raiz,
    env,
    stdio: "inherit",
  }),
  spawn("npm --prefix apps/web run dev", { cwd: raiz, stdio: "inherit", shell: true }),
];

let encerrando = false;
function encerrar(codigo) {
  if (encerrando) return;
  encerrando = true;
  for (const f of filhos) f.kill();
  process.exit(codigo);
}
for (const f of filhos) f.on("exit", (codigo) => encerrar(codigo ?? 0));
process.on("SIGINT", () => encerrar(0));
process.on("SIGTERM", () => encerrar(0));
