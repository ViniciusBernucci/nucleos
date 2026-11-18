import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { validarConfigTarefa, type ObjetoConfig } from "@nucleos/contracts";
import { dadosSeguros } from "./agenda.js";

export interface ContextoHandler {
  execucaoId: string;
  chaveIdempotencia: string;
  tentativa: number;
  config: ObjetoConfig;
  signal: AbortSignal; /** Verificar imediatamente antes de efeitos não idempotentes. */
  verificarLease: () => Promise<boolean>;
}
export interface HandlerFuncionario {
  chave: string;
  validarConfig: (config: ObjetoConfig) => boolean;
  executar: (ctx: ContextoHandler) => Promise<unknown>;
}
export class RegistroHandlers {
  readonly #handlers = new Map<string, HandlerFuncionario>();
  registrar(h: HandlerFuncionario): void {
    if (this.#handlers.has(h.chave)) throw new Error("handler duplicado");
    this.#handlers.set(h.chave, h);
  }
  obter(chave: string | null): HandlerFuncionario {
    const h = chave === null ? undefined : this.#handlers.get(chave);
    if (h === undefined) throw new ServiceUnavailableException("executor indisponivel");
    return h;
  }
  possui(chave: string | null): boolean {
    return chave !== null && this.#handlers.has(chave);
  }
  chaves(): string[] {
    return [...this.#handlers.keys()];
  }
}
/** Admin único local. A identidade é fornecida pelo guard, nunca pelo corpo da requisição. */
export class AutorizadorFuncionarios {
  permitir(permissoes: readonly string[], identidade = "admin-local"): void {
    if (identidade !== "admin-local" || permissoes.some((p) => !/^\w+[.\w]*$/.test(p)))
      throw new ForbiddenException();
  }
}
export function validarConfiguracao(
  schema: ObjetoConfig,
  config: ObjetoConfig,
  handler: HandlerFuncionario,
): void {
  if (
    !dadosSeguros(config) ||
    JSON.stringify(config).length > 32000 ||
    !validarConfigTarefa(schema, config) ||
    !handler.validarConfig(config)
  )
    throw new BadRequestException("configuracao invalida");
}
