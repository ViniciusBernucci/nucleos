import { z } from "zod";
import { ConfigError, loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
import { absolutePathSchema } from "./primitives.js";
import type { Secret } from "./secret.js";
export interface FinanceiroConfig {
  webhookHottok: Secret | undefined;
  anexos: { endpoint: string; bucket: string; accessKey: Secret; secretKey: Secret } | undefined;
}
export function loadFinanceiroConfig(
  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
): FinanceiroConfig {
  const e = parseConfig(
    z.object({
      HOTMART_WEBHOOK_HOTTOK: z.string().optional(),
      HOTMART_WEBHOOK_HOTTOK_FILE: absolutePathSchema.optional(),
      MINIO_ENDPOINT: z.url().optional(),
      MINIO_FINANCEIRO_BUCKET: z
        .string()
        .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
        .default("nucleos-financeiro"),
      MINIO_ACCESS_KEY: z.string().optional(),
      MINIO_ACCESS_KEY_FILE: absolutePathSchema.optional(),
      MINIO_SECRET_KEY: z.string().optional(),
      MINIO_SECRET_KEY_FILE: absolutePathSchema.optional(),
    }),
    env,
  );
  const accessKey = loadOptionalSecret(
    "MINIO_ACCESS_KEY",
    e.MINIO_ACCESS_KEY,
    e.MINIO_ACCESS_KEY_FILE,
  );
  const secretKey = loadOptionalSecret(
    "MINIO_SECRET_KEY",
    e.MINIO_SECRET_KEY,
    e.MINIO_SECRET_KEY_FILE,
  );
  if (
    [e.MINIO_ENDPOINT, accessKey, secretKey].some((v) => v !== undefined) &&
    [e.MINIO_ENDPOINT, accessKey, secretKey].some((v) => v === undefined)
  )
    throw new ConfigError([
      { key: "MINIO_ENDPOINT", message: "configure endpoint e duas credenciais juntos" },
    ]);
  return {
    webhookHottok: loadOptionalSecret(
      "HOTMART_WEBHOOK_HOTTOK",
      e.HOTMART_WEBHOOK_HOTTOK,
      e.HOTMART_WEBHOOK_HOTTOK_FILE,
    ),
    anexos:
      e.MINIO_ENDPOINT && accessKey && secretKey
        ? { endpoint: e.MINIO_ENDPOINT, bucket: e.MINIO_FINANCEIRO_BUCKET, accessKey, secretKey }
        : undefined,
  };
}
