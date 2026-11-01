import { z } from "zod";
import { ConfigError, loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
import type { Secret } from "./secret.js";
import { absolutePathSchema, durationMs } from "./primitives.js";

export const HOTMART_ENVS = ["production", "sandbox"] as const;
export type HotmartEnv = (typeof HOTMART_ENVS)[number];

const vendasEnvSchema = z
  .object({
    HOTMART_ENV: z.enum(HOTMART_ENVS).default("production"),
    HOTMART_CLIENT_ID: z.string().optional(),
    HOTMART_CLIENT_SECRET: z.string().optional(),
    HOTMART_CLIENT_TOKEN: z.string().optional(),
    HOTMART_CLIENT_TOKEN_FILE: absolutePathSchema.optional(),
    HOTMART_CLIENT_ID_FILE: absolutePathSchema.optional(),
    HOTMART_CLIENT_SECRET_FILE: absolutePathSchema.optional(),
    /** Intervalo entre sincronizacoes; padrao de 30 minutos. */
    HOTMART_SYNC_INTERVAL: durationMs(60_000, 24 * 3_600_000).default(30 * 60_000),
    /** Janela do primeiro carregamento (dias para tras). */
    HOTMART_BACKFILL_DAYS: z
      .string()
      .regex(/^\d{1,4}$/, "dias invalidos")
      .transform(Number)
      .pipe(z.number().int().min(1).max(1825))
      .default(90),
    /** Chave de servico exigida em `/v1/vendas/*`. */
    VENDAS_API_KEY: z.string().optional(),
    VENDAS_API_KEY_FILE: absolutePathSchema.optional(),
  })
  .superRefine((v, ctx) => {
    const par = [
      v.HOTMART_CLIENT_ID ?? v.HOTMART_CLIENT_ID_FILE,
      v.HOTMART_CLIENT_SECRET ?? v.HOTMART_CLIENT_SECRET_FILE,
    ];
    if (
      (v.HOTMART_CLIENT_TOKEN ?? v.HOTMART_CLIENT_TOKEN_FILE) !== undefined &&
      par.every((p) => p === undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["HOTMART_CLIENT_ID"],
        message: "o Client Token exige Client ID e Client Secret",
      });
    }
    if (par.some((p) => p === undefined) && par.some((p) => p !== undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["HOTMART_CLIENT_SECRET"],
        message: "informe HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET juntos (valor ou *_FILE)",
      });
    }
  });

export interface HotmartCredentials {
  readonly clientId: Secret;
  readonly clientSecret: Secret;
  /** Token Basic fornecido pela Hotmart; ausente preserva a derivacao ID:Secret. */
  readonly clientToken?: Secret;
}

export interface VendasConfig {
  readonly hotmartEnv: HotmartEnv;
  /** `undefined` desativa a sincronizacao (a API segue servindo o que ja foi baixado). */
  readonly hotmart: HotmartCredentials | undefined;
  readonly syncIntervalMs: number;
  readonly backfillDays: number;
  /** `undefined` => rotas de vendas respondem 503 (fail closed), nunca abertas. */
  readonly apiKey: Secret | undefined;
}

/** Configuracao do modulo de vendas (integracao Hotmart + chave de servico). Sem valores nos erros. */
export function loadVendasConfig(
  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
): VendasConfig {
  const e = parseConfig(vendasEnvSchema, env);
  const clientId = loadOptionalSecret(
    "HOTMART_CLIENT_ID",
    e.HOTMART_CLIENT_ID,
    e.HOTMART_CLIENT_ID_FILE,
  );
  const clientSecret = loadOptionalSecret(
    "HOTMART_CLIENT_SECRET",
    e.HOTMART_CLIENT_SECRET,
    e.HOTMART_CLIENT_SECRET_FILE,
  );
  const clientToken = loadOptionalSecret(
    "HOTMART_CLIENT_TOKEN",
    e.HOTMART_CLIENT_TOKEN,
    e.HOTMART_CLIENT_TOKEN_FILE,
  );
  if (clientToken !== undefined) {
    const raw = clientToken
      .reveal()
      .trim()
      .replace(/^Basic\s+/i, "");
    if (raw === "" || /\s/.test(raw)) {
      throw new ConfigError([{ key: "HOTMART_CLIENT_TOKEN", message: "token Basic invalido" }]);
    }
  }
  const hotmart =
    clientId !== undefined && clientSecret !== undefined
      ? { clientId, clientSecret, ...(clientToken === undefined ? {} : { clientToken }) }
      : undefined;
  return {
    hotmartEnv: e.HOTMART_ENV,
    hotmart,
    syncIntervalMs: e.HOTMART_SYNC_INTERVAL,
    backfillDays: e.HOTMART_BACKFILL_DAYS,
    apiKey: loadOptionalSecret("VENDAS_API_KEY", e.VENDAS_API_KEY, e.VENDAS_API_KEY_FILE),
  };
}
