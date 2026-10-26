import { z } from "zod";
import { ConfigError, loadSecret, parseConfig } from "./load.js";
import type { Secret } from "./secret.js";
import { absolutePathSchema, durationMs, portSchema, serviceUrl, sizeBytes } from "./primitives.js";

export const APP_ENVS = ["local", "ci", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

/** Ambientes que exigem banco e segredo (nao ha valor padrao inseguro em staging/producao). */
const STRICT_ENVS: readonly AppEnv[] = ["staging", "production"];

const apiEnvSchema = z
  .object({
    APP_ENV: z.enum(APP_ENVS).default("local"),
    APP_VERSION: z
      .string()
      .regex(/^[0-9A-Za-z.+_-]{1,64}$/, "versao invalida")
      .default("0.0.0"),
    HOST: z.string().min(1).max(255).default("127.0.0.1"),
    PORT: portSchema.default(3001),
    REQUEST_TIMEOUT: durationMs(100, 300_000).default(30_000),
    SHUTDOWN_TIMEOUT: durationMs(100, 120_000).default(10_000),
    MAX_BODY_SIZE: sizeBytes(1, 10 * 1024 * 1024).default(1024 * 1024),
    DATABASE_URL: serviceUrl(["postgres", "postgresql"]).optional(),
    DATABASE_PASSWORD_FILE: absolutePathSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (!STRICT_ENVS.includes(v.APP_ENV)) return;
    for (const key of ["DATABASE_URL", "DATABASE_PASSWORD_FILE"] as const) {
      if (v[key] === undefined) {
        ctx.addIssue({ code: "custom", path: [key], message: `obrigatoria em ${v.APP_ENV}` });
      }
    }
  });

export interface ApiConfig {
  readonly appEnv: AppEnv;
  readonly appVersion: string;
  readonly host: string;
  readonly port: number;
  readonly requestTimeoutMs: number;
  readonly shutdownTimeoutMs: number;
  readonly maxBodyBytes: number;
  readonly databaseUrl: string | undefined;
  /** Senha do banco lida de arquivo; `undefined` apenas em local/ci. */
  readonly databasePassword: Secret | undefined;
}

/**
 * Carrega e valida a configuracao do `apps/api`. Lanca `ConfigError` (sem valores) se ausente ou
 * invalida; segredos so por arquivo (`DATABASE_PASSWORD_FILE`), com checagem de permissoes.
 */
export function loadApiConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ApiConfig {
  const e = parseConfig(apiEnvSchema, env);
  const databasePassword =
    e.DATABASE_PASSWORD_FILE === undefined
      ? undefined
      : loadSecret("DATABASE_PASSWORD_FILE", e.DATABASE_PASSWORD_FILE);
  return {
    appEnv: e.APP_ENV,
    appVersion: e.APP_VERSION,
    host: e.HOST,
    port: e.PORT,
    requestTimeoutMs: e.REQUEST_TIMEOUT,
    shutdownTimeoutMs: e.SHUTDOWN_TIMEOUT,
    maxBodyBytes: e.MAX_BODY_SIZE,
    databaseUrl: e.DATABASE_URL,
    databasePassword,
  };
}

export { ConfigError };
