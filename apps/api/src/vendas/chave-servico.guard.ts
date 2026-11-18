import { createHash, timingSafeEqual } from "node:crypto";
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Secret } from "@nucleos/config";

export const CHAVE_SERVICO = Symbol("CHAVE_SERVICO");

const sha256 = (v: string): Buffer => createHash("sha256").update(v).digest();

/**
 * Exige `Authorization: Bearer <chave de servico>` (lida de arquivo). Sem chave configurada a rota
 * responde 503 (falha fechada). Comparacao em tempo constante sobre os digests SHA-256.
 * Provisorio: sera substituido pelo login real e pela autorizacao por papel (IAM).
 */
@Injectable()
export class ChaveServicoGuard implements CanActivate {
  constructor(@Inject(CHAVE_SERVICO) private readonly chave: Secret | undefined) {}

  canActivate(contexto: ExecutionContext): boolean {
    if (this.chave === undefined) throw new ServiceUnavailableException();
    const req = contexto
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const cabecalho = req.headers["authorization"] ?? "";
    const m = /^Bearer (.+)$/.exec(cabecalho);
    const enviado = m?.[1];
    if (enviado === undefined || !timingSafeEqual(sha256(enviado), sha256(this.chave.reveal()))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
