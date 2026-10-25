import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { createApiObservability, observabilityMiddleware } from "./observability.js";

const host = process.env["HOST"] ?? "127.0.0.1";
const port = Number(process.env["PORT"] ?? 3001);
const app = await NestFactory.create(AppModule);
app.use(observabilityMiddleware(createApiObservability()));
await app.listen(port, host);
console.log(`api em http://${host}:${port}`);
