/** Contratos administrativos locais. IDs bigint são strings no transporte. */
export type ObjetoConfig = Record<string, unknown>;
export type TipoFuncionario = "DETERMINISTICO" | "AGENTE_IA" | "HIBRIDO";
export type StatusFuncionario = "RASCUNHO" | "ATIVO" | "PAUSADO" | "DESATIVADO";
export type Gatilho = "MANUAL" | "UNICO" | "INTERVALO" | "CRON" | "EVENTO";
export type EstadoExecucao =
  "AGUARDANDO" | "EXECUTANDO" | "SUCESSO" | "FALHA" | "CANCELADA" | "IGNORADA";
export interface Setor {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
}
export interface Funcionario {
  id: string;
  setor_id: string;
  nome: string;
  slug: string;
  descricao: string;
  tipo: TipoFuncionario;
  status: StatusFuncionario;
  perfil_ia: string | null;
  avatar: string | null;
  tarefas: number;
  ultima_em: string | null;
  proxima_em: string | null;
  falhas: number;
}
export interface DefinicaoTarefa {
  id: string;
  setor_id: string;
  codigo: string;
  nome: string;
  descricao: string;
  tipo: string;
  handler_key: string | null;
  config_schema: ObjetoConfig;
  config_padrao: ObjetoConfig;
  gatilhos_suportados: Gatilho[];
  permissoes_requeridas: string[];
  nivel_risco: string;
  status_implementacao: "DISPONIVEL" | "PLANEJADA" | "INDISPONIVEL";
  ativo: boolean;
  atribuicoes?: number;
  habilitadas?: number;
}
export interface Atribuicao {
  id: string;
  funcionario_id: string;
  definicao_id: string;
  setor_id: string;
  config: ObjetoConfig;
  habilitada: boolean;
  prioridade: number;
  nome_override: string | null;
  definicao: DefinicaoTarefa;
  agendamentos: Agendamento[];
}
export interface Agendamento {
  id: string;
  atribuicao_id: string;
  gatilho: Gatilho;
  intervalo_min: number | null;
  cron: string | null;
  tipo_evento: string | null;
  filtro_evento: ObjetoConfig;
  fuso: string;
  inicio_em: string;
  fim_em: string | null;
  proxima_em: string | null;
  ultima_em: string | null;
  habilitado: boolean;
  politica_sobreposicao: "PULAR" | "ENFILEIRAR" | "CANCELAR_ANTERIOR";
  politica_retentativa: { maxTentativas: number; backoffSegundos: number };
  versao: number;
}
export interface ExecucaoFuncionario {
  id: string;
  atribuicao_id: string;
  agendamento_id: string | null;
  origem: string;
  status: EstadoExecucao;
  programada_em: string;
  iniciada_em: string | null;
  finalizada_em: string | null;
  tentativa: number;
  correlacao: string;
  config_snapshot: ObjetoConfig;
  resumo: unknown;
  erro_codigo: string | null;
  criado_em: string;
  funcionario_nome?: string;
  tarefa_nome?: string;
}
export interface ListaExecucoes {
  itens: ExecucaoFuncionario[];
  total: number;
  limite: number;
  deslocamento: number;
}
export interface DetalheFuncionario {
  funcionario: Funcionario;
  atribuicoes: Atribuicao[];
}
export interface EstadoFuncionarios {
  setores: (Setor & {
    funcionarios: (Funcionario & { atividade: ExecucaoFuncionario | null })[];
  })[];
}
