import { type DynamicModule, Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

@Module({ controllers: [HealthController] })
export class AppModule {
  /** Compoe o modulo raiz com os modulos opcionais habilitados pela configuracao. */
  static comModulos(modulos: readonly DynamicModule[]): DynamicModule {
    return { module: AppModule, imports: [...modulos] };
  }
}
