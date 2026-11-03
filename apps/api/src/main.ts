import "reflect-metadata";
import {
  ConfigError,
  loadApiConfig,
  loadFinanceiroConfig,
  loadVendasConfig,
} from "@nucleos/config";
import { NestFactory } from "@nestjs/core";
import { PayloadTooLargeException } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Pool } from "pg";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AppModule } from "./app.module.js";
import { opcoesPool } from "./banco.js";
import { createApiObservability, observabilityMiddleware } from "./observability.js";
import { FluxoCaixaModule } from "./fluxo-caixa/fluxo-caixa.module.js";
import { RepositorioFluxoCaixaPg } from "./fluxo-caixa/repositorio-pg.js";
import { VendasModule } from "./vendas/vendas.module.js";
import { RegistroHandlers } from "./funcionarios/handlers.js";
import { MotorFuncionarios } from "./funcionarios/motor.js";
import { FuncionariosModule } from "./funcionarios/funcionarios.module.js";
import { FinanceiroModule } from "./financeiro/financeiro.module.js";

// Falha rapida (FND-006): configuracao ausente/invalida impede a subida; a mensagem so lista
// nomes de variaveis e motivos, nunca valores.
let config;
let vendasConfig;
let financeiroConfig;
try {
  config = loadApiConfig();
  vendasConfig = loadVendasConfig();
  financeiroConfig = loadFinanceiroConfig();
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`api: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

const log = (mensagem: string): void => {
  console.log(mensagem);
};

// O painel de vendas depende do banco; sem DATABASE_URL (local/ci) o modulo fica desligado.
const pool =
  config.databaseUrl === undefined
    ? undefined
    : new Pool(opcoesPool(config.databaseUrl, config.databasePassword?.reveal(), 5));
pool?.on("error", () => {
  log("api: erro em conexao ociosa do banco");
});
if (pool === undefined)
  log("api: DATABASE_URL ausente; painel de vendas e fluxo de caixa desativados");

const motor =
  pool === undefined
    ? undefined
    : new MotorFuncionarios(pool, new RegistroHandlers(), undefined, { log });
const app = await NestFactory.create<NestExpressApplication>(
  AppModule.comModulos(
    pool === undefined || motor === undefined
      ? []
      : [
          FinanceiroModule.registrar(motor, vendasConfig.apiKey, financeiroConfig, vendasConfig),
          VendasModule.registrar({
            config: vendasConfig,
            pool,
            log,
            motor,
          }),
          FuncionariosModule.registrar(
            motor,
            vendasConfig.apiKey,
            true,
            Math.round(vendasConfig.syncIntervalMs / 60000),
          ),
          FluxoCaixaModule.registrar({
            apiKey: vendasConfig.apiKey,
            repositorio: new RepositorioFluxoCaixaPg(pool, motor),
          }),
        ],
  ),
  { bodyParser: false },
);
app.useBodyParser("json", {
  limit: "2mb",
  verify: (req: IncomingMessage, _res: ServerResponse, buf: Buffer) => {
    if (req.url?.split("?")[0] === "/v1/webhooks/hotmart" && buf.byteLength > 65536)
      throw new PayloadTooLargeException("corpo excede 64 KB");
  },
});
app.enableShutdownHooks();
app.use(observabilityMiddleware(createApiObservability(config)));
await app.listen(config.port, config.host);
console.log(`api em http://${config.host}:${String(config.port)} (${config.appEnv})`);
