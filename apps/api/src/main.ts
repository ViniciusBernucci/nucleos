import "reflect-metadata";
import { MarketingModule } from "./marketing/marketing.module.js";
import { ConfigError, loadApiConfig, loadVendasConfig, loadMarketingConfig } from "@nucleos/config";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { AppModule } from "./app.module.js";
import { opcoesPool } from "./banco.js";
import { createApiObservability, observabilityMiddleware } from "./observability.js";
import { FluxoCaixaModule } from "./fluxo-caixa/fluxo-caixa.module.js";
import { RepositorioFluxoCaixaPg } from "./fluxo-caixa/repositorio-pg.js";
import { VendasModule } from "./vendas/vendas.module.js";
import { RegistroHandlers } from "./funcionarios/handlers.js";
import { MotorFuncionarios } from "./funcionarios/motor.js";
import { FuncionariosModule } from "./funcionarios/funcionarios.module.js";

// Falha rapida (FND-006): configuracao ausente/invalida impede a subida; a mensagem so lista
// nomes de variaveis e motivos, nunca valores.
let config;
let vendasConfig;
let marketingConfig;
try {
  config = loadApiConfig();
  vendasConfig = loadVendasConfig();
  marketingConfig = loadMarketingConfig();
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
const app = await NestFactory.create(
  AppModule.comModulos(
    pool === undefined || motor === undefined
      ? []
      : [
          MarketingModule.registrar({
            config: marketingConfig,
            motor,
            apiKey: vendasConfig.apiKey,
            log,
          }),
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
            repositorio: new RepositorioFluxoCaixaPg(pool),
          }),
        ],
  ),
);
app.enableShutdownHooks();
app.use(observabilityMiddleware(createApiObservability(config)));
await app.listen(config.port, config.host);
console.log(`api em http://${config.host}:${String(config.port)} (${config.appEnv})`);
