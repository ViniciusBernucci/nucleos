import { z } from "zod";
import { ConfigError, loadEnvironment, loadOptionalSecret, parseConfig } from "./load.js";
import { absolutePathSchema } from "./primitives.js";
import type { Secret } from "./secret.js";

export interface MarketingConfig {
  readonly meta: { readonly token: Secret; readonly contaId: string } | undefined;
}
export function loadMarketingConfig(
  env: Readonly<Record<string, string | undefined>> = loadEnvironment(),
): MarketingConfig {
  const e = parseConfig(
    z.object({
      META_ADS_ACCESS_TOKEN: z.string().optional(),
      META_ADS_ACCESS_TOKEN_FILE: absolutePathSchema.optional(),
      META_ADS_ACCOUNT_ID: z
        .string()
        .regex(/^(act_)?\d{1,30}$/)
        .optional(),
    }),
    env,
  );
  const token = loadOptionalSecret(
    "META_ADS_ACCESS_TOKEN",
    e.META_ADS_ACCESS_TOKEN,
    e.META_ADS_ACCESS_TOKEN_FILE,
  );
  if (token !== undefined && !/^[A-Za-z0-9_.|-]+$/.test(token.reveal()))
    throw new ConfigError([{ key: "META_ADS_ACCESS_TOKEN", message: "token invalido" }]);
  return {
    meta:
      token === undefined || e.META_ADS_ACCOUNT_ID === undefined
        ? undefined
        : {
            token,
            contaId: e.META_ADS_ACCOUNT_ID.replace(/^act_/, ""),
          },
  };
}
