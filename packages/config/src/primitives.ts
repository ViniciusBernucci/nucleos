import { z } from "zod";

const SECRET_QUERY = new Set(["password", "sslpassword", "passfile", "pass", "passwd", "pwd", "token", "apikey", "api_key", "secret", "credential", "credentials"]);

/** Parametro de query que carrega (ou aponta para) credencial: recusado em DATABASE_URL e similares. */
function isSecretQueryParam(name: string): boolean {
  return SECRET_QUERY.has(name.toLowerCase());
}

/** Porta TCP valida (1-65535), a partir de texto de variavel de ambiente. */
export const portSchema = z
  .string()
  .regex(/^\d{1,5}$/, "porta invalida")
  .transform(Number)
  .pipe(z.number().int().min(1).max(65535));

const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 } as const;

/** Duracao `<n>(ms|s|m|h)` convertida para milissegundos, entre `minMs` e `maxMs`. */
export function durationMs(minMs: number, maxMs: number): z.ZodType<number, string> {
  return z
    .string()
    .regex(/^\d{1,9}(ms|s|m|h)$/, "duracao invalida (use 500ms, 30s, 5m, 1h)")
    .transform((v) => {
      const m = /^(\d+)(ms|s|m|h)$/.exec(v);
      return Number(m?.[1]) * UNIT_MS[m?.[2] as keyof typeof UNIT_MS];
    })
    .pipe(z.number().int().min(minMs).max(maxMs));
}

/** Tamanho `<n>(b|kb|mb)` convertido para bytes, entre `minBytes` e `maxBytes`. */
export function sizeBytes(minBytes: number, maxBytes: number): z.ZodType<number, string> {
  const mult = { b: 1, kb: 1024, mb: 1024 * 1024 } as const;
  return z
    .string()
    .regex(/^\d{1,9}(b|kb|mb)$/, "tamanho invalido (use 512kb, 1mb)")
    .transform((v) => {
      const m = /^(\d+)(b|kb|mb)$/.exec(v);
      return Number(m?.[1]) * mult[m?.[2] as keyof typeof mult];
    })
    .pipe(z.number().int().min(minBytes).max(maxBytes));
}

/**
 * URL de servico (postgres://, redis://, http(s)://) SEM credenciais embutidas: usuario e permitido,
 * senha nao (a senha vem de um arquivo de segredo). Devolve a URL normalizada.
 */
export function serviceUrl(protocols: readonly string[]): z.ZodType<string, string> {
  return z
    .string()
    .max(2048)
    .superRefine((v, ctx) => {
      // Uma unica passada com retorno antecipado: refinamentos encadeados continuariam rodando
      // com URL invalida e `new URL` lancaria uma excecao que nao e ZodError.
      if (!URL.canParse(v)) {
        ctx.addIssue({ code: "custom", message: "url invalida" });
        return;
      }
      const u = new URL(v);
      if (!protocols.includes(u.protocol.replace(/:$/, ""))) {
        ctx.addIssue({ code: "custom", message: "protocolo nao permitido" });
        return;
      }
      if (u.password !== "") {
        ctx.addIssue({ code: "custom", message: "senha embutida na url e proibida (use *_FILE)" });
        return;
      }
      if ([...u.searchParams.keys()].some(isSecretQueryParam)) {
        ctx.addIssue({ code: "custom", message: "credencial na query da url e proibida (use *_FILE)" });
        return;
      }
    });
}

/** Caminho absoluto de arquivo (sem NUL nem `..`), para variaveis `*_FILE`. */
export const absolutePathSchema = z
  .string()
  .max(4096)
  .refine((v) => v.startsWith("/"), "caminho deve ser absoluto")
  .refine((v) => !v.includes("\0") && !v.split("/").includes(".."), "caminho invalido");
