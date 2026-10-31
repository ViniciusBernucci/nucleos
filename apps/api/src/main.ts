import "reflect-metadata";
import { ConfigError, loadApiConfig } from "@nucleos/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { createApiObservability, observabilityMiddleware } from "./observability.js";

// Falha rapida (FND-006): configuracao ausente/invalida impede a subida; a mensagem so lista
// nomes de variaveis e motivos, nunca valores.
let config;
try {
  config = loadApiConfig();
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(`api: ${e.message}`);
    process.exit(1);
  }
  throw e;
}

const app = await NestFactory.create(AppModule);
app.use(observabilityMiddleware(createApiObservability(config)));
await app.listen(config.port, config.host);
console.log(`api em http://${config.host}:${String(config.port)} (${config.appEnv})`);
