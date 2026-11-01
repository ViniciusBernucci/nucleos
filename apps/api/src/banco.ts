import type { PoolConfig } from "pg";

/**
 * Opcoes do pool a partir da `DATABASE_URL` (sem senha) e da senha lida separadamente.
 * Monta por componentes: no `pg`, `connectionString` junto de `password` deixa a URL sobrescrever
 * a senha informada (e a URL nao tem senha), o que quebraria a autenticacao SCRAM.
 */
export function opcoesPool(url: string, senha: string | undefined, max: number): PoolConfig {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode");
  const comTls = sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full";
  return {
    host: u.hostname,
    port: u.port === "" ? 5432 : Number(u.port),
    user: decodeURIComponent(u.username),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    ...(senha === undefined ? {} : { password: senha }),
    ...(comTls ? { ssl: true } : {}),
    max,
  };
}
