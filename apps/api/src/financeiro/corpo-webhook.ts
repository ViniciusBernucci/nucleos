import { PayloadTooLargeException } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";

export function verificarCorpoHotmart(
  req: IncomingMessage,
  _res: ServerResponse,
  buf: Buffer,
): void {
  if (/^\/v1\/webhooks\/hotmart\/?$/i.test(req.url?.split("?")[0] ?? "") && buf.byteLength > 65536)
    throw new PayloadTooLargeException("corpo excede 64 KB");
}
