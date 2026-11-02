import {
  Inject,
  Injectable,
  Module,
  type DynamicModule,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import type { Secret } from "@nucleos/config";
import { CHAVE_SERVICO, ChaveServicoGuard } from "../vendas/chave-servico.guard.js";
import { FuncionariosController } from "./funcionarios.controller.js";
import { MotorFuncionarios } from "./motor.js";
import { SERVICO_FUNCIONARIOS, ServicoFuncionarios } from "./servico.js";

export const MOTOR_FUNCIONARIOS = Symbol("MOTOR_FUNCIONARIOS");
const INTERVALO_INICIAL = Symbol("INTERVALO_INICIAL");
@Injectable()
class CicloMotor implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    @Inject(MOTOR_FUNCIONARIOS) private readonly motor: MotorFuncionarios,
    @Inject(INTERVALO_INICIAL) private readonly intervaloInicial: number,
  ) {}
  async onApplicationBootstrap(): Promise<void> {
    const chaves = this.motor.registro.chaves();
    // O catálogo jamais anuncia um handler ausente. Não altera tarefas PLANEJADAS de código futuro.
    await this.motor.pool.query(
      "UPDATE funcionarios.definicoes_tarefa SET status_implementacao='INDISPONIVEL' WHERE status_implementacao='DISPONIVEL' AND NOT(handler_key=ANY($1::text[]))",
      [chaves],
    );
    // O ambiente inicializa somente o seed intocado; edições do painel sempre prevalecem.
    await this.motor.pool.query(
      `UPDATE funcionarios.agendamentos s SET intervalo_min=$1,versao=versao+1
      FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
      WHERE s.atribuicao_id=a.id AND d.codigo='financeiro.atualizar_dados'
      AND s.versao=1 AND s.ultima_em IS NULL AND s.gatilho='INTERVALO'`,
      [this.intervaloInicial],
    );
    await this.motor.pool.query(
      "UPDATE funcionarios.definicoes_tarefa SET status_implementacao='DISPONIVEL' WHERE handler_key=ANY($1::text[]) AND status_implementacao='INDISPONIVEL'",
      [chaves],
    );
    await this.motor.pool
      .query(`UPDATE funcionarios.funcionarios f SET status='RASCUNHO',atualizado_em=now()
      WHERE f.slug='analista-atualizacoes-financeiras' AND f.status='ATIVO'
      AND NOT EXISTS(SELECT 1 FROM funcionarios.atribuicoes a JOIN funcionarios.definicoes_tarefa d ON d.id=a.definicao_id
        WHERE a.funcionario_id=f.id AND a.habilitada AND d.ativo AND d.status_implementacao='DISPONIVEL')`);
    this.motor.iniciar();
  }
  onApplicationShutdown(): void {
    this.motor.parar();
  }
}
@Module({})
export class FuncionariosModule {
  static registrar(
    motor: MotorFuncionarios,
    apiKey: Secret | undefined,
    rodar = true,
    intervaloInicial = 30,
  ): DynamicModule {
    return {
      module: FuncionariosModule,
      controllers: [FuncionariosController],
      providers: [
        ChaveServicoGuard,
        { provide: CHAVE_SERVICO, useValue: apiKey },
        { provide: MOTOR_FUNCIONARIOS, useValue: motor },
        { provide: INTERVALO_INICIAL, useValue: intervaloInicial },
        { provide: SERVICO_FUNCIONARIOS, useValue: new ServicoFuncionarios(motor.pool, motor) },
        ...(rodar ? [CicloMotor] : []),
      ],
    };
  }
}
