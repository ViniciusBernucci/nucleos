import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ConfigError, loadApiConfig } from "@nucleos/config";
import { Pool } from "pg";
import { opcoesPool } from "./banco.js";

const ARQUIVO_RE = /^(\d{4})_[a-z0-9_]+\.up\.sql$/;
/** Comandos de transacao/concorrencia proibidos: o runner ja controla a transacao (ADR-017). */
const PROIBIDO_RE =
  /\b(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|START\s+TRANSACTION|CONCURRENTLY|VACUUM)\b/i;
const LOCK_MIGRACOES = "nucleos:api:schema_migrations";

export interface Migracao {
  versao: string;
  nome: string;
  sql: string;
  checksum: string;
}

export async function lerMigracoes(dir: URL): Promise<Migracao[]> {
  const nomes = (await readdir(dir)).filter((n) => ARQUIVO_RE.test(n)).sort();
  const saida: Migracao[] = [];
  for (const nome of nomes) {
    const sql = await readFile(new URL(nome, dir), "utf8");
    if (PROIBIDO_RE.test(sql.replace(/--.*$/gm, ""))) {
      throw new Error(`migration ${nome} controla transacao ou usa comando proibido`);
    }
    saida.push({
      versao: nome.slice(0, 4),
      nome,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    });
  }
  return saida;
}

/**
 * Aplica migrations pendentes: advisory lock, checksum das ja aplicadas e uma transacao por
 * arquivo (SQL + registro). Forward-only: nao existe reversao, so nova migration.
 */
export async function migrar(pool: Pool, migracoes: readonly Migracao[]): Promise<string[]> {
  const conexao = await pool.connect();
  const aplicadas: string[] = [];
  try {
    await conexao.query("SELECT pg_advisory_lock(hashtext($1))", [LOCK_MIGRACOES]);
    try {
      await conexao.query(`CREATE TABLE IF NOT EXISTS public.api_schema_migrations (
        versao char(4) PRIMARY KEY, nome text NOT NULL, checksum char(64) NOT NULL,
        aplicada_em timestamptz NOT NULL DEFAULT now())`);
      const { rows } = await conexao.query(
        "SELECT versao, checksum FROM public.api_schema_migrations",
      );
      const feitas = new Map(
        (rows as { versao: string; checksum: string }[]).map((r) => [r.versao, r.checksum]),
      );
      for (const m of migracoes) {
        const checksum = feitas.get(m.versao);
        if (checksum !== undefined) {
          if (checksum !== m.checksum)
            throw new Error(`migration ${m.nome} foi alterada apos aplicada`);
          continue;
        }
        await conexao.query("BEGIN");
        try {
          await conexao.query(m.sql);
          await conexao.query(
            "INSERT INTO public.api_schema_migrations (versao, nome, checksum) VALUES ($1, $2, $3)",
            [m.versao, m.nome, m.checksum],
          );
          await conexao.query("COMMIT");
        } catch (e) {
          await conexao.query("ROLLBACK");
          throw e;
        }
        aplicadas.push(m.nome);
      }
    } finally {
      await conexao.query("SELECT pg_advisory_unlock(hashtext($1))", [LOCK_MIGRACOES]);
    }
  } finally {
    conexao.release();
  }
  return aplicadas;
}

async function lerStdin(): Promise<string> {
  const partes: Buffer[] = [];
  for await (const parte of process.stdin) partes.push(parte as Buffer);
  return Buffer.concat(partes).toString("utf8");
}

// Execucao como comando (`pnpm --filter @nucleos/api migrar`); importar este arquivo nao executa nada.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    // `--senha-stdin`: a senha vem da entrada padrao (nunca de env, argumento ou historico), para
    // uso do operador em dev. Sem a flag, vale a regra do servico: DATABASE_PASSWORD ou DATABASE_PASSWORD_FILE.
    const porStdin = process.argv.includes("--senha-stdin");
    let url: string | undefined;
    let senha: string | undefined;
    if (porStdin) {
      url = process.env["DATABASE_URL"];
      if (url === undefined || !URL.canParse(url) || new URL(url).password !== "") {
        throw new Error("DATABASE_URL ausente ou com senha embutida");
      }
      senha = (await lerStdin()).trim();
      if (senha === "") throw new Error("senha vazia na entrada padrao");
    } else {
      const config = loadApiConfig();
      url = config.databaseUrl;
      senha = config.databasePassword?.reveal();
    }
    if (url === undefined) throw new Error("DATABASE_URL ausente");
    const pool = new Pool(opcoesPool(url, senha, 1));
    try {
      const aplicadas = await migrar(
        pool,
        await lerMigracoes(new URL("../migrations/", import.meta.url)),
      );
      console.log(
        aplicadas.length === 0
          ? "migrations: nada a aplicar"
          : `migrations aplicadas: ${aplicadas.join(", ")}`,
      );
    } finally {
      await pool.end();
    }
  } catch (e) {
    console.error(
      `migrar: ${e instanceof ConfigError ? e.message : e instanceof Error ? e.message : "falha"}`,
    );
    process.exitCode = 1;
  }
}
