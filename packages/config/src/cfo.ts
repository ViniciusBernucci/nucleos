import { z } from "zod";
import { loadEnvironment, loadOptionalSecret, parseConfig, ConfigError } from "./load.js";
import { absolutePathSchema } from "./primitives.js";
import type { Secret } from "./secret.js";
export interface CfoConfig {
  leitura: Secret | undefined;
  gateway: { url: string; chave: Secret } | undefined;
}
export function loadCfoConfig(
  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
): CfoConfig {
  const e = parseConfig(
    z.object({
      AI_GATEWAY_URL: z.url().default("http://127.0.0.1:8002"),
      AI_GATEWAY_API_KEY: z.string().optional(),
      AI_GATEWAY_API_KEY_FILE: absolutePathSchema.optional(),
      CFO_LEITURA_API_KEY: z.string().optional(),
      CFO_LEITURA_API_KEY_FILE: absolutePathSchema.optional(),
    }),
    env,
  );
  const leitura = loadOptionalSecret(
      "CFO_LEITURA_API_KEY",
      e.CFO_LEITURA_API_KEY,
      e.CFO_LEITURA_API_KEY_FILE,
    ),
    chave = loadOptionalSecret(
      "AI_GATEWAY_API_KEY",
      e.AI_GATEWAY_API_KEY,
      e.AI_GATEWAY_API_KEY_FILE,
    );
  const u = new URL(e.AI_GATEWAY_URL);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    u.pathname !== "/" ||
    !["https:", "http:"].includes(u.protocol) ||
    (u.protocol === "http:" && !["127.0.0.1", "localhost", "ai-gateway"].includes(u.hostname))
  )
    throw new ConfigError([{ key: "AI_GATEWAY_URL", message: "URL interna invalida" }]);
  if (chave && leitura && chave.reveal() === leitura.reveal())
    throw new ConfigError([
      { key: "CFO_LEITURA_API_KEY", message: "use chave separada do gateway" },
    ]);
  if (leitura || chave) {
    const admin = loadOptionalSecret(
      "VENDAS_API_KEY",
      env["VENDAS_API_KEY"],
      env["VENDAS_API_KEY_FILE"],
    );
    if (admin && (leitura?.reveal() === admin.reveal() || chave?.reveal() === admin.reveal()))
      throw new ConfigError([
        {
          key: "CFO_LEITURA_API_KEY",
          message: "chaves internas devem ser distintas da chave administrativa",
        },
      ]);
  }
  return { leitura, gateway: chave && leitura ? { url: u.origin, chave } : undefined };
}
