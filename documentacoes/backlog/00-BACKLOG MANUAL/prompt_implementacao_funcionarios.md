# PROMPT DE IMPLEMENTAÇÃO — NÚCLEOS ENTERPRISE
## Módulo de Funcionários Virtuais, Catálogo de Tarefas e Agendamentos

### 1. Contexto do projeto

Estamos desenvolvendo o **NÚCLEOS Enterprise**, uma plataforma de gestão empresarial que utiliza automações determinísticas e agentes de inteligência artificial para executar atividades dentro dos departamentos de uma empresa.

A stack atual do projeto utiliza React no frontend, NestJS no backend e workers Node.js/TypeScript, com banco de dados relacional. Antes de implementar, inspecione o repositório e confirme as tecnologias, bibliotecas e padrões efetivamente utilizados.

O sistema será validado inicialmente na Academia do Produtor Musical, empresa que comercializa cursos online utilizando a Hotmart como checkout e plataforma de consumo dos cursos.

Precisamos implementar um conceito denominado **Funcionários Virtuais**.

Um funcionário virtual representa um responsável operacional dentro de um departamento. Ele pode ser:

- **Determinístico:** executa rotinas implementadas em código, workers, serviços ou integrações.
- **Agente de IA:** utiliza um modelo de linguagem, ferramentas e instruções para investigar, planejar ou executar atividades autorizadas.
- **Híbrido:** combina operações determinísticas e etapas de IA.

Todo funcionário deve estar vinculado a um setor empresarial e possuir tarefas que possam ser configuradas, executadas, agendadas e monitoradas por meio de uma interface administrativa.

**Importante:** não transforme todas as tarefas em chamadas de IA. O sistema deve preservar a execução determinística quando ela for suficiente.

### 2. Objetivo da implementação

Criar um módulo completo de administração de funcionários virtuais e suas tarefas.

O administrador deverá conseguir:

1. Visualizar todos os setores da empresa.
2. Visualizar os funcionários pertencentes a cada setor.
3. Cadastrar, editar, ativar, desativar e consultar funcionários.
4. Visualizar e administrar o catálogo de tarefas disponíveis para cada setor.
5. Atribuir tarefas a funcionários.
6. Configurar os parâmetros de cada tarefa atribuída.
7. Definir se a tarefa será manual, agendada uma única vez, recorrente ou disparada por eventos.
8. Configurar horários, intervalos, fuso horário e regras de execução.
9. Executar tarefas manualmente quando permitido.
10. Consultar o histórico de execuções, resultados e falhas.
11. Alterar configurações pelo painel e fazer com que essas alterações sejam refletidas no mecanismo real de execução.
12. Visualizar funcionários determinísticos e funcionários de IA utilizando uma interface administrativa unificada.

Não basta criar telas ou registros de agendamento no banco. **Os agendamentos configurados precisam controlar o executor real do sistema.**

### 3. Antes de implementar: auditoria obrigatória

Inspecione a estrutura atual do projeto e identifique:

- Entidades e tabelas existentes relacionadas a departamentos, usuários, agentes, automações e tarefas.
- Estrutura atual de autenticação e permissões.
- Workers, filas, cron jobs e outros mecanismos de agendamento existentes.
- Serviços que executam tarefas financeiras.
- Integrações com Hotmart e serviços financeiros existentes.
- Estrutura atual do menu e do sistema de navegação.
- Componentes reutilizáveis de formulários, tabelas, modais e dashboards.
- Sistema de logs, auditoria e observabilidade.
- Padrão de migrations e seeds do projeto.
- Gateway e ferramentas de IA já implementados, caso existam.

**Não crie estruturas paralelas quando já existir uma solução reutilizável.**

Especialmente, localize a rotina financeira que atualmente realiza ou deveria realizar atualizações a cada 30 minutos.

Essa rotina deverá ser incorporada ao novo conceito de funcionário virtual, preservando sua implementação existente.

Não crie um segundo agendador concorrente para a mesma tarefa.

Se a rotina não existir no código, não simule sua execução. Cadastre a tarefa como pendente de implementação e documente o bloqueio.

### 4. Modelagem conceitual

O modelo de domínio deve seguir esta estrutura:

**Setor → Funcionário → Atribuição de Tarefa → Agendamento → Execuções**

Com as seguintes definições:

**Setor:** departamento da empresa responsável por um conjunto de atividades.

**Funcionário:** identidade operacional que possui nome, tipo, status, setor, descrição, competências e configurações.

**Definição de Tarefa:** atividade reutilizável disponível no catálogo de determinado setor.

**Atribuição:** associação entre um funcionário e uma tarefa do catálogo, contendo as configurações específicas daquele funcionário.

**Agendamento:** política que define quando e sob quais condições uma tarefa atribuída deve ser iniciada.

**Execução:** registro individual de uma tentativa de realizar uma tarefa, com status, resultados, duração, erros e rastreabilidade.

A mesma definição de tarefa poderá ser reutilizada em diferentes atribuições. Entretanto, o sistema deve impedir execuções duplicadas acidentais do mesmo processo operacional.

Não associe diretamente o intervalo de execução ao cadastro do funcionário. Um funcionário poderá possuir várias tarefas com agendamentos distintos.

### 5. Modelagem de banco de dados

Crie ou adapte as seguintes entidades, respeitando as convenções existentes no repositório.

#### 5.1. `departments`

Campos conceituais:

- `id`: identificador.
- `code`: código estável e único.
- `name`: nome do setor.
- `description`: descrição.
- `is_active`: setor habilitado ou não.
- `display_order`: ordem no menu.
- `created_at`, `updated_at`.

Se já existir uma entidade equivalente, reutilize-a.

#### 5.2. `virtual_employees`

Campos:

- `id`
- `department_id`
- `name`
- `slug`
- `description`
- `employee_type`: `DETERMINISTIC`, `AI_AGENT` ou `HYBRID`.
- `status`: `DRAFT`, `ACTIVE`, `PAUSED` ou `DISABLED`.
- `ai_profile_id`: referência opcional à configuração de IA existente.
- `avatar_key`: identificador visual opcional.
- `created_by`
- `created_at`
- `updated_at`

O nome deverá ser único dentro do setor quando isso fizer sentido para a regra de negócio.

Um funcionário não deve executar tarefas simplesmente por estar cadastrado. Ele precisa possuir atribuições habilitadas e um mecanismo de disparo válido.

#### 5.3. `task_definitions`

Catálogo reutilizável de tarefas.

Campos:

- `id`
- `department_id`
- `code`: identificador técnico estável e único.
- `name`
- `description`
- `execution_type`: `DETERMINISTIC`, `AI_TASK`, `AI_AGENT` ou `HYBRID`.
- `handler_key`: referência a um executor registrado no backend.
- `config_schema`: JSON Schema ou estrutura equivalente para validar parâmetros.
- `default_config`: configurações padrão.
- `supported_triggers`: tipos de disparo permitidos.
- `required_permissions`: permissões necessárias.
- `risk_level`: classificação de risco conforme política do projeto.
- `implementation_status`: `AVAILABLE`, `PLANNED` ou `UNAVAILABLE`.
- `is_active`
- `created_at`
- `updated_at`

**Regra essencial:** criar uma tarefa pelo painel não significa permitir que o administrador injete código executável.

O campo `handler_key` deve apontar exclusivamente para executores previamente registrados e autorizados pelo backend.

Tarefas personalizadas sem executor implementado poderão existir como rascunhos, mas não poderão ser agendadas como executáveis.

#### 5.4. `employee_task_assignments`

Relaciona funcionários às tarefas disponíveis.

Campos:

- `id`
- `employee_id`
- `task_definition_id`
- `name_override` opcional.
- `config`: configurações específicas da atribuição, validadas pelo schema.
- `is_enabled`
- `priority`
- `created_at`
- `updated_at`

Evite duplicações involuntárias da mesma atribuição.

Por padrão, um funcionário poderá receber tarefas do seu próprio setor. Colaborações entre departamentos deverão ocorrer por workflows e ferramentas autorizadas.

#### 5.5. `task_schedules`

Configuração dos disparos das tarefas.

Campos:

- `id`
- `assignment_id`
- `trigger_type`: `MANUAL`, `ONE_TIME`, `INTERVAL`, `CRON` ou `EVENT`.
- `interval_minutes`: quando aplicável.
- `cron_expression`: quando aplicável.
- `event_type`: quando aplicável.
- `event_filter`: filtros permitidos para eventos.
- `timezone`
- `start_at`
- `end_at`
- `next_run_at`
- `last_run_at`
- `is_enabled`
- `overlap_policy`: comportamento quando uma execução anterior ainda estiver ativa.
- `retry_policy`: regras de tentativas e backoff.
- `version`: revisão da configuração para evitar uso de agendamentos desatualizados.
- `created_at`
- `updated_at`

O fuso horário inicial sugerido é `America/Sao_Paulo`, mas deve ser configurável.

Não use um intervalo de tempo fictício como substituto para agendamentos baseados em eventos.

#### 5.6. `task_runs`

Histórico de execuções.

Campos:

- `id`
- `assignment_id`
- `schedule_id`, opcional.
- `employee_id`
- `task_definition_id`
- `trigger_source`: manual, agendamento, evento ou workflow.
- `status`: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `SKIPPED` ou estado equivalente.
- `scheduled_for`
- `started_at`
- `finished_at`
- `attempt_number`
- `idempotency_key`
- `correlation_id`
- `triggered_by`
- `config_snapshot`
- `result_summary`
- `error_code`
- `error_summary`
- `created_at`

Se o projeto já possuir um modelo adequado de jobs e histórico, integre-o, em vez de duplicá-lo.

Não armazene senhas, tokens, credenciais ou dados pessoais desnecessários nos registros de execução.

Utilize o sistema de auditoria existente para registrar alterações administrativas.

### 6. Funcionários iniciais e departamentos

Cadastre os seguintes setores, reutilizando os registros existentes quando disponíveis:

1. Diretoria.
2. Financeiro e Fiscal.
3. Comercial e CRM.
4. Marketing.
5. Operações e Atendimento.
6. Tecnologia e Inteligência.

O primeiro funcionário operacional que deverá aparecer é:

**Setor:** Financeiro e Fiscal  
**Nome sugerido:** Analista de Atualizações Financeiras  
**Tipo:** Determinístico  
**Tarefa principal:** Atualizar dados financeiros  
**Recorrência:** Sim  
**Intervalo:** 30 minutos  
**Estado inicial:** conforme a disponibilidade real do executor existente.

Se esse funcionário ou tarefa já existir no projeto sob outro nome, preserve sua identidade e vincule os registros existentes, evitando duplicações.

Crie também registros iniciais, em estado de rascunho quando ainda não houver executores disponíveis, para os seguintes papéis:

- Diretoria: Assistente Executivo, CFO, COO, CMO, Diretor Comercial e Diretor de Tecnologia.
- Financeiro: Analista de Atualizações Financeiras e Assistente Fiscal.
- Comercial: Analista Comercial.
- Marketing: Planejador de Marketing, Criador de Conteúdo e Gestor de Tráfego.
- Operações: Assistente de Operações.
- Tecnologia: Monitor de Integrações.

Esses papéis devem ser editáveis. Funcionários de IA não devem aparecer como ativos e operacionais se suas ferramentas ou perfis ainda não estiverem configurados.

### 7. Popular o catálogo de tarefas do MVP

Crie seeds idempotentes para o catálogo abaixo.

Cada tarefa deverá possuir um código técnico estável, um setor responsável, um nome, uma descrição funcional, um tipo de execução e os disparos suportados.

Os códigos podem seguir o padrão `departamento.atividade`.

**Importante:** os registros de catálogo devem ser criados mesmo que parte dos executores ainda não esteja implementada. Nesse caso, marque-os como `PLANNED` ou `UNAVAILABLE`, sem criar execuções fictícias.

#### Diretoria

| Código | Tarefa | Tipo |
|---|---|---|
| `diretoria.monitorar_metas` | Monitorar metas empresariais | D |
| `diretoria.resumo_executivo` | Gerar resumo executivo da empresa | I |
| `diretoria.analisar_desempenho` | Investigar desempenho empresarial | A |
| `diretoria.planejar_acoes` | Elaborar planos de ação estratégicos | A |
| `diretoria.coordenar_agentes` | Coordenar tarefas entre departamentos | A |
| `diretoria.analisar_financas` | Realizar análise consultiva do CFO | A |

#### Financeiro e Fiscal

| Código | Tarefa | Tipo |
|---|---|---|
| `financeiro.atualizar_dados` | Atualizar dados financeiros | D |
| `financeiro.conciliar_vendas` | Conciliar registros de vendas e eventos financeiros | D |
| `financeiro.atualizar_indicadores` | Atualizar indicadores financeiros | D |
| `financeiro.calcular_dre` | Calcular DRE gerencial | D |
| `financeiro.monitorar_caixa` | Monitorar saldos e projeções de caixa | D |
| `financeiro.detectar_anomalias` | Identificar desvios por regras financeiras | D |
| `fiscal.validar_emissao` | Verificar condições de emissão fiscal | D |
| `fiscal.emitir_nota` | Emitir notas fiscais autorizadas | D |

A primeira tarefa deverá ser configurada com intervalo de 30 minutos e vinculada ao funcionário financeiro existente.

#### Comercial e CRM

| Código | Tarefa | Tipo |
|---|---|---|
| `comercial.sincronizar_vendas` | Sincronizar vendas da Hotmart | D |
| `comercial.atualizar_clientes` | Atualizar cadastro e histórico de clientes | D |
| `comercial.atualizar_leads` | Registrar e atualizar leads | D |
| `comercial.sincronizar_produtos` | Sincronizar produtos e ofertas | D |
| `comercial.calcular_conversao` | Atualizar indicadores de conversão | D |
| `comercial.planejar_experimento` | Planejar experimento A/B | A |
| `comercial.avaliar_experimento` | Avaliar resultados de experimentos | D |

Não criar tarefas de recuperação automatizada de carrinhos ou nutrição de leads, pois estão fora do MVP aprovado.

#### Marketing

| Código | Tarefa | Tipo |
|---|---|---|
| `marketing.importar_meta_ads` | Importar métricas do Meta Ads | D |
| `marketing.importar_google_ads` | Importar métricas do Google Ads | D |
| `marketing.analisar_campanhas` | Analisar desempenho de campanhas | A |
| `marketing.planejar_conteudo` | Planejar calendário de conteúdo | A |
| `marketing.gerar_post` | Gerar post estático | I |
| `marketing.analisar_video` | Identificar trechos relevantes de vídeos | I |
| `marketing.processar_cortes` | Processar e exportar cortes de vídeos | D |
| `marketing.agendar_publicacao` | Agendar publicações | D |
| `marketing.publicar_conteudo` | Publicar conteúdo autorizado | D |
| `marketing.propor_otimizacao` | Propor otimizações de campanhas | A |
| `marketing.aplicar_otimizacao` | Aplicar mudança publicitária autorizada | D |

A aplicação de otimizações deve respeitar os limites, permissões e aprovações definidos para o Gestor de Tráfego.

#### Operações e Atendimento

| Código | Tarefa | Tipo |
|---|---|---|
| `operacoes.verificar_pos_venda` | Verificar consistência das operações de pós-venda | D |
| `operacoes.verificar_acessos` | Verificar situações de acesso de alunos | D |
| `operacoes.enviar_notificacoes` | Enviar notificações operacionais | D |
| `atendimento.registrar_ticket` | Registrar chamados de atendimento | D |
| `atendimento.distribuir_tickets` | Distribuir chamados conforme regras | D |
| `atendimento.monitorar_sla` | Monitorar prazos de atendimento | D |
| `atendimento.atualizar_status` | Atualizar status dos chamados | D |

Não incluir atendimento automatizado por IA nesta etapa.

#### Tecnologia e Inteligência

| Código | Tarefa | Tipo |
|---|---|---|
| `tecnologia.monitorar_integracoes` | Monitorar saúde das integrações | D |
| `tecnologia.verificar_jobs` | Verificar execuções de tarefas | D |
| `tecnologia.reprocessar_eventos` | Reprocessar eventos elegíveis após falhas | D |
| `tecnologia.monitorar_ia` | Monitorar custos e falhas de IA | D |
| `tecnologia.registrar_atividades` | Consolidar estados operacionais para o painel | D |

Essa última tarefa deverá permitir que outras interfaces, incluindo futuramente o prédio empresarial 3D, consumam os estados dos funcionários e suas atividades.

**Não implementar agora o prédio 3D nem funcionalidades não relacionadas a este módulo.** Apenas disponibilizar dados estruturados necessários para sua integração futura.

### 8. Implementar o motor de execução

Utilize ou estenda a infraestrutura de workers, filas e agendamentos já presente no projeto.

O sistema deverá suportar:

**Execução manual:** iniciada no painel, mediante permissões e confirmação quando necessária.

**Execução única:** disparada uma vez na data e horário definidos.

**Execução recorrente por intervalo:** por exemplo, a cada 30 minutos.

**Execução por cron:** permite horários e dias específicos.

**Execução por evento:** iniciada por um evento interno ou externo previamente registrado e autorizado.

Requisitos obrigatórios:

- Os agendamentos devem persistir no banco.
- O sistema deve recuperar os agendamentos após reinicialização.
- Alterações realizadas no painel devem modificar o comportamento real do agendador.
- Desativar uma tarefa deve impedir novos disparos, sem interromper arbitrariamente execuções já iniciadas.
- O mesmo evento não pode gerar processamento duplicado indevido.
- Múltiplas instâncias da aplicação não devem iniciar a mesma ocorrência simultaneamente.
- Deve existir uma política explícita para execuções sobrepostas.
- Falhas devem seguir regras configuradas de retry e backoff.
- Cada execução precisa gerar histórico e logs.
- A interface deve apresentar a última e a próxima execução quando aplicável.
- Cada handler deve validar as entradas e aplicar permissões antes de realizar ações.
- Mudanças de horário, recorrência ou habilitação devem invalidar configurações antigas que ainda não foram executadas.
- Não executar scripts arbitrários fornecidos pelo frontend.

O banco de dados deve ser a fonte de verdade para as configurações. O mecanismo de agendamento pode utilizar filas, scheduler ou outra solução já existente, mas deve respeitar o estado persistido.

### 9. Interface administrativa — Menu Funcionários

Adicionar ao menu principal a opção:

**Funcionários**

Dentro dessa opção, implementar navegação para:

- Visão Geral.
- Diretoria.
- Financeiro e Fiscal.
- Comercial e CRM.
- Marketing.
- Operações e Atendimento.
- Tecnologia e Inteligência.
- Catálogo de Tarefas.
- Histórico de Execuções.

Os links de departamentos devem ser gerados a partir dos setores cadastrados, respeitando permissões, ativação e ordenação. O menu não deve depender permanentemente de uma lista fixa no frontend.

Ao entrar em **Funcionários → Financeiro e Fiscal**, o usuário deve encontrar o funcionário responsável pelas atualizações financeiras a cada 30 minutos.

#### Tela de listagem dos funcionários

Exibir:

- Nome do funcionário.
- Departamento.
- Tipo: determinístico, IA ou híbrido.
- Status.
- Quantidade de tarefas atribuídas.
- Última execução, quando houver.
- Próxima execução, quando aplicável.
- Indicador de falhas recentes.

Permitir busca, filtros e navegação para detalhes.

#### Cadastro ou edição de funcionário

Campos iniciais:

1. Nome.
2. Setor.
3. Descrição e função.
4. Tipo de funcionário.
5. Status.
6. Perfil de IA, apenas quando aplicável.
7. Tarefas atribuídas.

Ao selecionar o setor, o formulário deve carregar as tarefas existentes naquele departamento.

Um funcionário poderá possuir mais de uma tarefa, mas não deve ser obrigado a ter várias.

#### Tela de detalhes do funcionário

Criar seções ou abas para:

- **Visão geral:** identificação e estado operacional.
- **Tarefas:** atividades atribuídas, configuração e ativação.
- **Agendamentos:** recorrências e próximos disparos.
- **Execuções:** histórico de atividades e erros.
- **Configurações:** propriedades gerais e parâmetros de execução.

Disponibilizar botões operacionais adequados, como:

- Editar.
- Pausar ou ativar.
- Atribuir tarefa.
- Configurar tarefa.
- Executar agora.
- Visualizar histórico.

As ações devem refletir permissões e estados reais, sem botões meramente ilustrativos.

### 10. Painel de configuração das tarefas

Implementar um formulário reutilizável para configuração de tarefas.

O formulário deve ser construído a partir do schema da definição de tarefa sempre que possível.

#### Configuração geral

- Tarefa selecionada.
- Funcionário responsável.
- Descrição.
- Status de habilitação.
- Configurações específicas da tarefa.

#### Configuração de execução

Permitir escolher:

- Manual.
- Uma única vez.
- Recorrente por intervalo.
- Recorrente por cron.
- Disparado por evento, quando suportado.

Quando a tarefa for recorrente:

- Intervalo numérico e unidade de tempo.
- Data ou horário inicial, se aplicável.
- Fuso horário.
- Data de encerramento opcional.
- Tratamento de execuções sobrepostas.
- Política de retry.

Para cron, disponibilizar validação de expressão e pré-visualização das próximas ocorrências.

Para eventos, permitir selecionar somente eventos registrados e filtros suportados.

#### Configurações específicas

Exemplos:

**Tarefa financeira:**
- Intervalo de sincronização.
- Período de dados a consultar, se suportado.
- Política de processamento de registros antigos.
- Regras de alerta disponíveis.

**Tarefa de marketing:**
- Conta ou integração autorizada.
- Campanhas ou canais permitidos.
- Regras de execução.
- Limites de orçamento e permissões.

**Agente de IA:**
- Perfil/modelo permitido.
- Instruções de função.
- Ferramentas autorizadas.
- Limites de uso.
- Critérios de aprovação.
- Parâmetros específicos.

Não armazenar chaves de API diretamente nesses formulários ou nos JSONs de configuração. Utilizar as referências seguras às credenciais existentes.

### 11. Catálogo de tarefas

Criar uma página própria para consultar o catálogo.

Deve ser possível:

- Filtrar tarefas por departamento.
- Buscar por nome ou código.
- Identificar o tipo de execução.
- Verificar se o executor está disponível.
- Consultar a descrição e os parâmetros configuráveis.
- Criar definições de tarefas em rascunho.
- Editar metadados permitidos.
- Atribuir uma tarefa a um funcionário compatível.

O sistema deve diferenciar claramente:

**Tarefa cadastrada** — existe no catálogo.

**Tarefa implementada** — possui executor válido no backend.

**Tarefa atribuída** — pertence a um funcionário.

**Tarefa habilitada** — pode ser disparada conforme configuração e política.

Esses estados não são equivalentes.

Não permitir ativar um agendamento de tarefa cujo executor não esteja implementado.

### 12. Integração com funcionários de IA

Reutilizar o gateway e as capacidades de IA do projeto.

Um funcionário de IA deve receber o contexto mínimo necessário para sua tarefa e acessar informações exclusivamente por ferramentas autorizadas.

O mecanismo de execução deve reconhecer o tipo da tarefa:

- `DETERMINISTIC`: chama um handler de código.
- `AI_TASK`: realiza uma operação pontual de IA.
- `AI_AGENT`: inicia uma execução orientada a objetivos, com ferramentas e limites.
- `HYBRID`: executa um workflow com etapas determinísticas e etapas de IA.

Os agentes não podem alterar os próprios limites de autonomia.

A escolha de modelo ou provedor deve respeitar a configuração do sistema, sem exigir uma implementação completamente nova para cada funcionário.

Um mesmo runtime de IA pode atender vários funcionários, desde que mantenha o isolamento de contexto, permissões e registros de execução.

### 13. APIs e serviços

Implementar ou adaptar endpoints REST seguindo as convenções existentes.

Cobrir os recursos:

- Departamentos: listagem e consulta.
- Funcionários: listagem, criação, edição, detalhes, ativação e desativação.
- Catálogo: listagem, consulta, criação de rascunhos e administração de metadados.
- Atribuições: vincular, configurar, ativar, remover.
- Agendamentos: criar, editar, suspender, consultar próximas ocorrências.
- Execuções: iniciar manualmente, consultar histórico e detalhes.

Não expor manipulações diretas de código de execução pelo frontend.

Aplicar validação de entrada, autenticação, autorização e controle de acesso em todos os endpoints.

Respeitar o isolamento de empresas ou workspaces já existente. Caso a aplicação esteja operando em uma única instância dedicada, não implementar agora o SaaS completo; apenas preservar os limites de domínio atuais e evitar dependências globais indevidas.

### 14. Migrations e seeds

Criar migrations seguras e reversíveis conforme as convenções do projeto.

Criar seeds idempotentes para:

1. Os seis departamentos.
2. O catálogo de tarefas definido neste documento.
3. O funcionário financeiro já existente, com seu agendamento de 30 minutos.
4. Os demais funcionários iniciais, como rascunhos quando ainda não implementados.
5. As atribuições iniciais que possuam correspondência real com executores disponíveis.

Executar o seed mais de uma vez não pode produzir registros duplicados.

Não excluir dados existentes para recriar a estrutura.

Não registrar como disponíveis tarefas que ainda não possuem implementação funcional.

Não iniciar automaticamente todos os funcionários apenas por terem sido criados no seed.

### 15. Testes obrigatórios

Criar testes automatizados compatíveis com a infraestrutura do projeto.

#### Banco de dados

- Migrations aplicadas corretamente.
- Relacionamentos e integridade referencial.
- Unicidade dos códigos.
- Seeds idempotentes.
- Atualização sem perda de dados existentes.

#### Funcionários e tarefas

- Criar funcionário.
- Editar funcionário.
- Associar ao setor.
- Atribuir tarefa compatível.
- Impedir atribuições inválidas.
- Desativar funcionário e tarefa.
- Validar configurações pelo schema.

#### Agendamento

- Criar tarefa recorrente de 30 minutos.
- Calcular corretamente as próximas execuções.
- Alterar o intervalo para 60 minutos e verificar a atualização efetiva.
- Desativar a tarefa e impedir novos disparos.
- Reiniciar a aplicação e recuperar o agendamento.
- Garantir que instâncias concorrentes não executem duplicadamente a mesma ocorrência.
- Tratar falhas, tentativas e execuções sobrepostas.
- Reprocessar eventos de forma idempotente.
- Verificar configurações que mudam enquanto existem jobs pendentes.

#### Integração financeira existente

- Confirmar que a rotina original continua funcionando.
- Confirmar que existe um único mecanismo ativo para dispará-la.
- Confirmar que o painel controla a recorrência real.
- Confirmar que o resultado aparece no histórico.

Não é necessário aguardar 30 minutos reais para os testes. Utilize relógio controlado ou mecanismos equivalentes para validar os agendamentos.

#### Segurança

- Usuário não autorizado não pode alterar funcionários ou tarefas.
- Um funcionário não pode utilizar ferramentas fora de suas permissões.
- Credenciais não aparecem nos registros.
- Ações sensíveis respeitam políticas de aprovação.

### 16. Critérios de aceite

Considerar a funcionalidade concluída somente quando:

1. A opção **Funcionários** existir no menu principal.
2. Os seis setores estiverem cadastrados e acessíveis.
3. O catálogo de tarefas estiver populado e consultável.
4. O setor Financeiro apresentar o funcionário responsável pela atualização de 30 minutos.
5. Esse funcionário estiver vinculado à rotina financeira real, se ela estiver disponível no repositório.
6. O administrador conseguir editar sua frequência pelo painel.
7. A alteração refletir no mecanismo real de agendamento.
8. A tarefa puder ser pausada e reativada sem editar código.
9. O histórico de execuções apresentar resultados verdadeiros e erros reais.
10. Novos funcionários puderem ser cadastrados e vinculados a tarefas disponíveis.
11. Tarefas não implementadas estiverem claramente identificadas e impedidas de executar.
12. Agendamentos continuarem funcionando corretamente após reinicializações.
13. Os testes críticos estiverem aprovados.
14. Nenhuma funcionalidade existente tiver sido quebrada.

### 17. Interface e experiência visual

Utilizar o design system atual do NÚCLEOS.

A aparência deve ser empresarial, moderna, objetiva e sóbria.

Priorizar:

- Navegação clara entre setores.
- Visualização imediata do estado dos funcionários.
- Formulários simples.
- Configuração de agendamentos compreensível.
- Identificação de tarefas determinísticas e de IA.
- Histórico e erros facilmente acessíveis.
- Confirmação visual das alterações realizadas.

Não criar uma interface excessivamente futurista apenas por se tratar de funcionários virtuais.

A integração com o edifício 3D será uma etapa posterior; o módulo deve fornecer dados estruturados para que ele represente funcionários, setores, atividades e estados sem duplicar a lógica de negócio.

### 18. Documentação obrigatória

Seguir todas as diretrizes já presentes nos arquivos de instrução do projeto, incluindo as convenções aplicáveis ao Codex, Claude e demais agentes.

Criar documentação no domínio correspondente dentro da pasta `documentacoes` da raiz.

Documentar:

- Objetivo do módulo.
- Modelo de domínio.
- Estrutura das tabelas e relacionamentos.
- Migrations e seeds.
- Fluxo de criação de funcionários.
- Fluxo de atribuição e configuração de tarefas.
- Funcionamento do agendador.
- Registro e recuperação de execuções.
- Integração com a rotina financeira existente.
- APIs implementadas.
- Políticas de segurança e autorização.
- Testes executados.
- Arquivos alterados e diferenças relevantes.
- Limitações e pendências.

Também registrar na pasta `lessons` os conceitos técnicos utilizados, com exemplos reais do código e explicações sobre os mecanismos de execução, idempotência, concorrência e agendamento.

### 19. Forma de execução do trabalho

Siga esta sequência:

1. Auditar o código existente.
2. Identificar componentes reutilizáveis e a rotina financeira de 30 minutos.
3. Definir o modelo de dados alinhado ao projeto.
4. Implementar migrations e seeds.
5. Integrar o modelo ao mecanismo real de execução.
6. Implementar APIs e validações.
7. Implementar o menu Funcionários.
8. Implementar listagem, cadastro, detalhes e painel de configuração.
9. Conectar a rotina financeira existente.
10. Implementar histórico, estados e controles operacionais.
11. Criar e executar testes.
12. Atualizar documentação e lessons.
13. Apresentar relatório final das alterações.

Preservar mudanças locais do repositório. Não excluir ou sobrescrever arquivos existentes sem necessidade. Seguir as políticas de branches, commits e aprovação já definidas no projeto.

**Não implementar novas funcionalidades comerciais do MVP apenas porque suas tarefas estão cadastradas no catálogo.** Este trabalho é especificamente sobre a infraestrutura de funcionários, tarefas e agendamentos.

### 20. Resultado esperado

Ao final, quero conseguir acessar o NÚCLEOS e realizar o seguinte fluxo:

**Funcionários → Financeiro e Fiscal → Analista de Atualizações Financeiras → Tarefas → Atualizar Dados Financeiros → Configurar Agendamento.**

Nesse painel, devo visualizar a recorrência atual de 30 minutos, alterar as configurações permitidas, salvar, consultar a próxima execução e acompanhar seu histórico.

Também devo conseguir criar novos funcionários, vinculá-los a setores e atribuir tarefas do catálogo.

A mesma infraestrutura deverá servir tanto para um funcionário determinístico quanto para um funcionário de IA, sem duplicar a arquitetura.

O resultado deve ser uma funcionalidade real, persistente, configurável e integrada ao projeto existente — não apenas telas demonstrativas ou registros de banco sem execução correspondente.