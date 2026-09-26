# Nucleos — Especificação mestra de produto e engenharia

Versão: 1.0  
Data de consolidação: 2026-09-22  
Responsável pelo produto: Vinícius  
Finalidade: entrada autossuficiente para um agente elaborar épicos, funcionalidades, histórias, tarefas, dependências, sprints, validação e publicação do software.

> Este documento especifica trabalho a realizar. Não afirma que funcionalidades, integrações, testes ou infraestrutura já estejam implementados. O planejamento deve cobrir o produto completo; as etapas são marcos internos de construção, não uma redução para MVP.

## 1. Como usar e interpretar este documento

1. Leia integralmente antes de gerar o backlog.
2. Preserve as decisões confirmadas e os limites de escopo.
3. Decomponha todos os requisitos identificados, inclusive os transversais, em trabalho rastreável.
4. Não escolha silenciosamente fornecedores, regras fiscais, autorizações de agentes ou bibliotecas pendentes.
5. Transforme uma incerteza técnica em uma investigação com pergunta, resultado esperado, limite de esforço e decisão registrada.
6. Produza critérios de aceite verificáveis, dependências, cenários de falha e documentação por entrega.
7. Separe estimativas de compromisso de prazo. Desenvolvimento assistido por IA não elimina validação e trabalho humano.

### 1.1 Status das definições

- **Confirmado:** pedido ou limite explícito do proprietário, ou stack recuperada da conversa tecnológica do projeto.
- **Base proposta:** especificação funcional/técnica derivada das conversas para tornar o planejamento executável; pode ser refinada sem contradizer decisões confirmadas.
- **Pendente:** precisa de descoberta, evidência externa ou decisão do proprietário antes da tarefa dependente.
- Os requisitos RF, RNF e fluxos abaixo compõem a base proposta consolidada, subordinada às decisões D e exclusões X.
- Aprovar este documento como entrada de planejamento não autoriza gastos, publicações reais, movimentações financeiras ou acesso a contas externas.

## 2. Visão, objetivos e contexto

Nucleos é uma plataforma web de gestão empresarial com múltiplos workspaces, módulos configuráveis, identidade white label e equipes de agentes de IA. Deve permitir que um proprietário com equipe pequena acompanhe e opere empresas de infoprodutos e, posteriormente, outros negócios.

A experiência desejada é abrir o painel, identificar a situação da empresa, entender prioridades, conversar com agentes, revisar entregas e resolver exceções. Dados e processos determinísticos sustentam a operação; IA interpreta, sugere e produz dentro de permissões explícitas.

Objetivos:

- Consolidar vendas, recebimentos, despesas, resultado e informações fiscais.
- Organizar contatos, leads, clientes e relacionamento.
- Automatizar produção, reaproveitamento, revisão e distribuição de conteúdo.
- Coordenar agentes como uma equipe com responsabilidades, ferramentas, custos e entregas observáveis.
- Manter isolamento entre empresas, marcas e clientes da plataforma.
- Permitir operação manual e retomada segura quando automações falharem.
- Preparar comercialização white label sem exigir infraestrutura de grande escala no primeiro ano.

### 2.1 Decisões confirmadas

| ID | Decisão |
| --- | --- |
| D-001 | Nome do produto: Nucleos. Disponibilidade de marca/domínio não foi verificada. |
| D-002 | Produto completo, construído e validado por etapas internas. Não reduzir o planejamento a um MVP. |
| D-003 | Primeiro ano no próprio ecossistema: até 5 workspaces e aproximadamente 5 usuários. Não confundir usuários administrativos com volume de contatos/vendas. |
| D-004 | Checkout, pagamentos da compra e consumo das aulas continuam na Hotmart. |
| D-005 | Integrar Hotmart via APIs e webhooks disponíveis para alimentar vendas e contatos. |
| D-006 | Recuperação de vendas permanece na Hotmart; não construir recuperador próprio neste escopo. |
| D-007 | Cada workspace tem módulos, dados, credenciais, agentes e permissões próprios. |
| D-008 | Prever organizações, multiempresa e white label para futura comercialização. |
| D-009 | Incluir financeiro, emissão fiscal por integração, CRM, marketing, conteúdo estático, cortes de vídeo, agentes e automações. |
| D-010 | Stack-base: C# / ASP.NET Core / .NET 10, React / TypeScript, PostgreSQL, EF Core / Npgsql e Hangfire com persistência PostgreSQL. |
| D-011 | Arquitetura modular, API e worker separados em Docker, implantação inicial em VPS Linux Hostinger; referência discutida de 8 GB RAM, sujeita a medição de carga. |
| D-012 | Modelos de IA consumidos por APIs externas; Redis não obrigatório inicialmente. |
| D-013 | Toda entrega deve atualizar documentacoes por domínio e lessons com trilha didática e exemplos. |

### 2.2 Fora do escopo

| ID | Exclusão |
| --- | --- |
| X-001 | Checkout próprio, processamento próprio de pagamentos de cursos e substituição da área de membros Hotmart. |
| X-002 | Recuperação própria de carrinho/venda abandonada, incluindo fluxos equivalentes por agentes. |
| X-003 | Hospedagem e distribuição das aulas aos alunos pelo Nucleos. Arquivos de produção de conteúdo são permitidos. |
| X-004 | Transferências bancárias automáticas, contratação autônoma de serviços e autonomia financeira irrestrita. |
| X-005 | Treinar ou hospedar grandes modelos de IA na VPS inicial. |
| X-006 | Aplicativo móvel nativo, infraestrutura de microserviços distribuídos e Kubernetes como requisitos iniciais. Interface web responsiva permanece no escopo. |
| X-007 | Construção de um editor de vídeo profissional genérico; o editor deve atender cortes, composições, legendas e revisão definidos aqui. |

## 3. Hierarquia, isolamento e personas

| Entidade | Definição |
| --- | --- |
| Plataforma | Instância global do produto, catálogo de módulos e administração operacional. |
| Organização | Cliente/assinante do produto, identidade white label, membros e workspaces. |
| Workspace / empresa | Unidade operacional isolada; não pressupõe automaticamente um CNPJ diferente. |
| Marca | Identidade editorial/comercial dentro de um workspace. |
| Projeto | Iniciativa dentro do workspace: lançamento, campanha ou produção. |
| Usuário | Identidade humana com vínculos e papéis por escopo. |
| Agente | Identidade de execução com configuração, conhecimento e permissões delimitadas. |

Usar `Workspace` consistentemente no domínio técnico. A interface pode apresentar “Empresa”. Resolver explicitamente empresas jurídicas, estabelecimentos e emissores fiscais antes da modelagem fiscal final.

Personas: proprietário; administrador da organização; operador de conteúdo; responsável financeiro/contabilidade; atendimento; administrador da plataforma; agente automatizado. Uma pessoa pode acumular papéis, mas permissões continuam separadas.

Não compartilhar automaticamente contatos, documentos ou conhecimento entre workspaces, mesmo quando pertencentes à mesma pessoa. Uma visão consolidada exige autorização em cada workspace e regras de agregação, moeda e datas.

## 4. Stack e arquitetura

### 4.1 Stack recuperada da conversa tecnológica

| Camada | Definição de referência | Observações |
| --- | --- | --- |
| Backend | C# e ASP.NET Core em .NET 10 | Fixar patch compatível e suportado no início da implementação. |
| Frontend | React e TypeScript | Ferramenta de build, roteamento, estado e kit visual ainda pendentes. |
| Persistência | PostgreSQL | Versão exata pendente; uma instância/banco compartilhado com isolamento lógico. |
| Acesso a dados | EF Core e Npgsql | Verificar compatibilidade de versões e migrations. |
| Jobs | Hangfire com storage PostgreSQL | Verificar provider, manutenção, licenças e recursos antes de assumir capacidades. |
| Execução | API e worker em containers separados | Mesmo produto modular e contratos compartilhados. |
| Web/edge | Kestrel atrás de Nginx | HTTPS, encaminhamento de cabeçalhos e limites de upload. |
| Implantação | Docker em VPS Linux Hostinger | Referência inicial de 8 GB; custo contratado não pesquisado neste documento. |
| IA | APIs externas, por adaptadores | Modelos, preços e limites ainda pendentes. |
| Cache | Sem Redis obrigatório | Acrescentar apenas com evidência técnica e decisão registrada. |

A stack acima é registro de planejamento prévio, não uma auditoria atual de compatibilidade ou suporte. O agente deve consultar documentação oficial durante a preparação técnica e registrar versões, licenças e justificativas.

### 4.2 Organização arquitetural proposta

Monólito modular com frontend independente, API e processos worker. Separar domínios por limites explícitos e evitar acesso arbitrário às tabelas de outros módulos. Reutilizar contratos e serviços de aplicação sem transformar cada módulo em um serviço de rede.

Componentes lógicos:

- Frontend web: navegação contextual por workspace, dashboards, editores e aprovações.
- API: autenticação, autorização, casos de uso e endpoints de integração.
- Worker: sincronização, rotinas, IA, renderização e distribuição, com filas diferenciadas.
- PostgreSQL: dados operacionais e persistência de jobs, com separação lógica adequada.
- Armazenamento de objetos/arquivos: mídia, documentos e derivados; fornecedor pendente.
- Adaptadores: Hotmart, fiscal, redes sociais, e-mail, anúncios e IA.
- Observabilidade: logs estruturados, métricas, alertas e rastreamento por execução.

Renderização pesada não pode disputar recursos sem limite com API e banco. Definir limites de CPU/memória, concorrência e duração; medir e permitir separar o worker de mídia em outro host no futuro. Não supor que cinco usuários implicam poucos jobs ou vídeos pequenos.

### 4.3 Regras técnicas transversais

- Identificar organização/workspace a partir de contexto autenticado ou conexão externa validada. Nunca confiar apenas no ID enviado pelo cliente.
- Autorizar operações no backend, incluindo downloads, buscas, exports e jobs.
- Em filas, transportar identificadores mínimos, carregar contexto e revalidar autorização/políticas na execução.
- Persistir recebimento de eventos antes de processá-los; confirmar entrega externa conforme o contrato do provedor.
- Projetar inbox/idempotência e outbox quando necessárias para consistência entre transação e agendamento.
- Calcular valores financeiros com precisão decimal e moeda explícita; nunca com ponto flutuante binário ou texto gerado por IA.
- Registrar instantes em UTC, exibindo timezone configurado; distinguir vencimento por data de instante de execução.
- Versionar contratos públicos e tratar migrações com rollout e recuperação planejados.
- Segredos fora do código, prompts e logs; permissões mínimas, rotação e proteção em repouso.
- Tratar conteúdo recebido por agentes como dados não confiáveis, sem poder alterar permissões ou instruções superiores.
- Não prometer execução externa “exatamente uma vez”: usar idempotência quando suportada, reconciliação e tratamento explícito de resultado desconhecido.

## 5. Catálogo de requisitos funcionais

Cada ID deve aparecer na matriz de cobertura do backlog. Os critérios abaixo são mínimos, não substituem cenários detalhados por história.

### M01 — Plataforma, organizações, workspaces e white label

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-001 | Criar, editar, arquivar e selecionar organizações/workspaces. | Workspace arquivado bloqueia novas execuções e preserva histórico conforme política. |
| RF-002 | Habilitar módulos por workspace e controlar disponibilidade por organização. | Módulo indisponível não pode ser ativado por interface ou API; dependências são informadas. |
| RF-003 | Modelos iniciais de workspace: infoprodutos, conteúdo, serviços e personalizado. | Modelo aplica configuração editável sem duplicar dados nem implicar módulos ainda não implementados. |
| RF-004 | Identidade white label: nome, logo, cores, login, notificações e documentos. | Identidade não vaza entre organizações; prévia e validação de legibilidade disponíveis. |
| RF-005 | Domínio personalizado com verificação de propriedade e HTTPS. | Domínio não verificado não pode representar a organização; remoção revoga associação. |
| RF-006 | Administração global de módulos, organizações, limites e saúde da plataforma. | Acesso de suporte a dados operacionais é restrito, temporário quando aplicável e auditável. |
| RF-007 | Visão consolidada das empresas autorizadas. | Total permite identificar empresas e critérios incluídos; não mistura moedas sem regra explícita. |
| RF-008 | Preparação comercial: planos, direitos de uso, consumo e estados de assinatura. | Plano limita direitos sem apagar dados; cobrança automatizada depende de decisão P-009. |

### M02 — Identidade, acesso e auditoria

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-009 | Login, logout, recuperação, convites e revogação de acesso. | Revogação invalida acesso ao escopo e impede tarefas futuras não autorizadas. |
| RF-010 | Papéis e permissões por organização/workspace, módulo, ação e escopo. | Negação por padrão; consulta, edição, execução, aprovação e administração são separáveis. |
| RF-011 | Autenticação reforçada para contas privilegiadas e operações sensíveis. | Política de MFA e recuperação definida e testada; segredos não aparecem em logs. |
| RF-012 | Trilha de auditoria de ações humanas e automatizadas. | Evento identifica ator, workspace, ação, alvo, horário, correlação e resultado, com dados sensíveis minimizados. |
| RF-013 | Exportação, retenção, anonimização/exclusão e preferências de dados. | Política distingue dados elimináveis de registros que precisam ser preservados; ação respeita autorizações. |

### M03 — Integrações e Hotmart

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-014 | Central de conexões por workspace, suportando múltiplas contas quando necessário. | Conexão possui dono, escopo, status, última sincronização e procedimento de revogação. |
| RF-015 | Receber eventos Hotmart com validação e persistência. | Evento inválido é rejeitado; evento válido é associado à conexão correta antes de enfileirar. |
| RF-016 | Processar eventos com idempotência, ordenação lógica e reconciliação. | Reenvio não duplica venda/contato; evento antigo não regride estado indevidamente. |
| RF-017 | Importação histórica e sincronização pelos meios oficialmente disponíveis. | Prévia, período, progresso, resumo e divergências visíveis; limitações do provedor documentadas. |
| RF-018 | Mapear produtos, compradores, compras e dados de acesso quando disponíveis. | Compra e matrícula/acesso não são tratados como sinônimos; campos ausentes não são inventados. |
| RF-019 | Central de falhas e reprocessamento de integração. | Retry conserva vínculo com evento original e apresenta tentativas, causa e resolução. |

A investigação Hotmart deve produzir matriz com evento/endpoint, campos, autenticação, limites, paginação, histórico, assinatura/verificação, sandbox e reconciliação. Não assumir que tudo visível no painel existe na API. Não implementar recuperação de vendas.

### M04 — Produtos, ofertas e vendas

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-020 | Catálogo de cursos/produtos, marcas, materiais e referências externas. | Produto local vincula identificador e conexão de origem, com histórico das mudanças relevantes. |
| RF-021 | Ofertas, preços, combos, bônus, cupons e order bumps como registros gerenciais. | Registro distingue informação importada, cadastro interno e operação realmente suportada no provedor. |
| RF-022 | Histórico de vendas, parcelas, taxas, comissões, reembolsos e chargebacks. | Linha do tempo preserva estados e permite rastrear valores até a origem. |
| RF-023 | Indicadores e filtros por período, produto, oferta, marca e origem disponível. | Receita bruta, líquida estimada, recebimento e resultado não aparecem como a mesma métrica. |

### M05 — Financeiro gerencial

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-024 | Contas financeiras, saldos iniciais, categorias e centros de custo. | Ajuste de saldo fica identificado e auditado; moeda definida. |
| RF-025 | Contas a pagar/receber, recorrência, vencimentos e baixas parciais. | Baixa e cancelamento mantêm histórico; geração recorrente é idempotente. |
| RF-026 | Importar Excel/CSV e cadastrar registros manualmente. | Prévia de mapeamento, validação, erros por linha e prevenção de importação duplicada. |
| RF-027 | Conciliação entre vendas, recebíveis e recebimentos efetivos. | Divergências ficam explícitas; liquidação não é inferida apenas de venda aprovada. |
| RF-028 | Fluxo de caixa, resultado gerencial, orçamento e resultado por produto. | Cálculo tem critérios e período visíveis, com acesso aos lançamentos de origem. |
| RF-029 | Projeções e simulador de preço, conversão, custos, taxas e reembolsos. | Premissas editáveis e identificadas; projeção não é exibida como resultado realizado. |
| RF-030 | Assistência IA para classificação, explicação e detecção de anomalias. | Sugestão tem justificativa e fonte; não altera lançamento protegido sem política aplicável. |
| RF-031 | Comprovantes, anexos, exportações e acesso delimitado da contabilidade. | Anexo/export respeita workspace e permissão; trilha mantém autor da alteração. |

Definir regime gerencial de caixa/competência, rateio de custos, saldos de abertura, moedas e fórmula de margem na descoberta. Não reutilizar automaticamente percentuais históricos de taxas/impostos como configuração vigente.

### M06 — Fiscal

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-032 | Perfil do emissor e regras fiscais parametrizadas por empresa/estabelecimento. | Configuração validada com responsável contábil antes de habilitar produção. |
| RF-033 | Integração com provedor fiscal para emissão e acompanhamento. | Documento externo, estado, arquivo e vínculo comercial registrados; timeout não dispara emissão duplicada. |
| RF-034 | Rejeições, cancelamentos e outras operações suportadas pelo provedor. | Fluxo explicita motivo, prazo/regra configurada, permissão e retorno externo. |
| RF-035 | Fila fiscal, consulta, filtros e exportação para contabilidade. | Pendência e falha são distinguíveis de emissão concluída; documentos permanecem rastreáveis. |

Tipo de documento, município, regime, momento de emissão, certificado e provedor são pendências. IA não define tributação nem substitui regras validadas. Reembolso comercial não implica cancelamento fiscal automático.

### M07 — CRM, leads e relacionamento

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-036 | Base unificada de contatos por workspace com nome, e-mail e campos disponíveis. | Contato pode ter várias compras e classificações; não é compartilhado entre empresas. |
| RF-037 | Deduplicação, identidade externa e mesclagem controlada. | Mesclagem preserva histórico; correspondência ambígua não junta pessoas silenciosamente. |
| RF-038 | Origem, tags, interesses, segmentos e linha do tempo. | Cliente pode ser interessado em outro produto sem perder histórico comercial. |
| RF-039 | Entrada manual, importação e formulários de captura. | Origem e preferências registradas; proteção contra abuso e validação do formulário. |
| RF-040 | Preferências, permissões de comunicação e descadastro por canal. | Contato comercial não fica automaticamente elegível a toda campanha; supressão vale também em jobs agendados. |
| RF-041 | Comunicação segmentada e integração de e-mail/canais definidos. | Prévia de destinatários e exclusões; envio rastreável e limites respeitados. Não incluir recuperação de vendas. |

### M08 — Marcas, estratégia, campanhas e anúncios

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-042 | Brand kit: audiência, tom, fontes, cores, logos, exemplos e restrições. | Materiais usam versão identificada da marca; alteração não modifica publicações antigas. |
| RF-043 | Campanhas com objetivos, oferta, orçamento, canais e cronograma. | Custos, materiais, tarefas e indicadores vinculados ao mesmo projeto/campanha. |
| RF-044 | Funis, páginas e e-mails como ativos de campanha. | Especificar se página será referência externa ou edição/publicação própria antes da implementação P-010. |
| RF-045 | Integração de anúncios para métricas e alterações autorizadas. | Conta correta, limites de gasto, disponibilidade da API e aprovação são verificados antes de alterar. |
| RF-046 | Experimentos e atribuição de resultados. | Hipótese, versões, período e resultado registrados; atribuição declara cobertura e incerteza, sem apresentar correlação como causalidade. |

### M09 — Biblioteca e estúdio de vídeo

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-047 | Biblioteca de mídias, documentos e materiais de origem. | Upload validado, tamanho/duração configuráveis, metadados e vínculo com workspace/projeto. |
| RF-048 | Transcrição com timestamps e correção manual. | Trecho de texto localiza momento correspondente; versão editada é preservada. |
| RF-049 | Sugestão de cortes por objetivo, assunto e contexto. | Sugestão inclui início/fim, título e justificativa; pode haver menos cortes que o solicitado. |
| RF-050 | Revisão de cortes antes da renderização final. | Usuário ajusta limites, descarta e pré-visualiza sem reprocessar todo o material. |
| RF-051 | Reenquadramento e composições rosto/tela/ambos. | Ajuste manual de área focal; controles relevantes de aulas de software podem permanecer visíveis. |
| RF-052 | Legendas, identidade visual, capa e elementos aprovados. | Texto editável, sincronização verificável, prévia e limites de áreas seguras por formato. |
| RF-053 | Renderização assíncrona, exportação e versões. | Estado, progresso quando disponível, erros e resultado acessíveis; consumo limitado por worker. |
| RF-054 | Cancelamento e regeneração parcial. | Cancelar impede novas etapas quando possível; custo já incorrido e limites do provedor ficam visíveis. |

Não garantir detecção perfeita de rostos, seleção viral ou preservação automática de contexto. O agente editorial deve apoiar revisão humana e vínculo ao original. Ferramenta de processamento/renderização e fornecedores de transcrição são pendentes.

### M10 — Conteúdo estático e reaproveitamento

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-055 | Criar a partir de ideia, briefing, calendário ou material existente. | Conteúdo conserva objetivo, marca, público e referência de origem. |
| RF-056 | Posts únicos, carrosséis, Stories estáticos, capas e peças promocionais. | Dimensões e regras por formato configuráveis; exportação de todos os slides na ordem correta. |
| RF-057 | Gerar imagens, fundos e ilustrações por IA. | Provedor, solicitação, versão e custo associados à tarefa; direitos dos materiais considerados. |
| RF-058 | Editor por camadas: textos, preços, logos, imagens, cores e posições. | Corrigir texto não exige gerar novamente o fundo; elementos continuam editáveis no projeto. |
| RF-059 | Modelos visuais e variantes por marca/campanha. | Reutilização preserva identidade e não altera peças já aprovadas. |
| RF-060 | Pacotes derivados de vídeo/aula/documento. | Cortes, carrossel, post e Stories apontam para a mesma fonte, com revisão independente. |
| RF-061 | Revisão, comentários, histórico e regeneração de um elemento. | Versão aprovada é imutável; alteração relevante exige nova aprovação quando configurada. |

Exemplo de pacote: uma aula de equalização gera propostas de cortes, carrossel educativo, dica estática, Stories e legendas. Quantidades são configuráveis e limitadas pela qualidade do material.

### M11 — Calendário, publicação e resultados de conteúdo

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-062 | Banco de ideias e calendário por marca/canal/projeto. | Conteúdo tem objetivo, formato, responsável, prazo e estado. |
| RF-063 | Agendamento com timezone e versão aprovada. | Horário e conta de destino claros; mudanças após aprovação são tratadas antes do envio. |
| RF-064 | Publicar nos canais suportados e exportar para publicação manual. | Conta, formato e permissões validados; limitações da API não são disfarçadas como sucesso. |
| RF-065 | Confirmação, URL/ID externo, falhas e reconciliação de publicação. | Timeout com resultado desconhecido requer consulta antes de repetir ação. |
| RF-066 | Métricas por peça, assunto, formato, campanha e canal. | Fonte, período e atualização visíveis; ausência de dados não é mostrada como zero. |

Canais prioritários: Instagram e YouTube. Formatos, permissões, revisão do aplicativo e agendamento externo precisam de validação oficial; não presumir suporte a todo formato/conta.

### M12 — Atendimento e produto educacional

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-067 | Registro/entrada de atendimentos e vínculo com contato/produto. | Canal de origem, responsável, status e histórico visíveis. |
| RF-068 | Respostas assistidas com base nas políticas e materiais autorizados. | Agente indica fonte, evita inventar acesso/preço e encaminha caso fora de escopo. |
| RF-069 | Escalonamento, prioridades e prazos internos. | Caso bloqueado entra na central de exceções com motivo e próximo responsável. |
| RF-070 | Identificar dúvidas recorrentes e oportunidades de melhoria dos cursos. | Sugestão referencia evidências e não presume dados acadêmicos indisponíveis na integração. |

### M13 — Agentes e conhecimento

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-071 | Catálogo de modelos e instâncias de agentes por workspace. | Alterar modelo não muda silenciosamente instâncias já configuradas. |
| RF-072 | Organograma visual e ficha de função. | Objetivo, responsabilidades, ferramentas, conhecimento, limites e encaminhamentos configuráveis. |
| RF-073 | Chat individual com tarefas e entregas vinculadas. | Instrução de chat não vira regra permanente sem ação explícita autorizada. |
| RF-074 | Memória/base de conhecimento com fontes, versões e validade. | Documento revogado deixa de ser recuperável conforme política; resultados não cruzam workspaces. |
| RF-075 | Autonomia por ação: consultar, recomendar, preparar, aprovar e executar sob limites. | Servidor e ferramentas aplicam política; prompt sozinho nunca é controle de segurança. |
| RF-076 | Coordenação entre agentes e entrega de trabalho. | Delegação conserva escopo, orçamento, limite de profundidade e critérios de conclusão. |
| RF-077 | Monitor de trabalho: disponível, executando, aguardando aprovação, bloqueado, concluído, falhou. | Mostra ações, fontes e resultados reais; não simula atividade ou expõe raciocínio interno. |
| RF-078 | Orçamento e consumo de IA por agente/workspace/tarefa/campanha. | Limites checados antes de novas chamadas; custos desconhecidos são sinalizados, nunca apresentados como exatos. |
| RF-079 | Avaliação de qualidade, versões de instruções/modelos e retorno controlado. | Casos de avaliação e comparação registrados antes de ampliar autonomia. |

Modelos de funções: coordenador executivo; assistente executivo; analista financeiro/CFO; estrategista de marketing; gestor de conteúdo; redator; designer/produtor audiovisual; analista de tráfego; atendimento; analista educacional; responsável técnico/CTO. Cargo visual não concede autorização. O CTO não recebe acesso irrestrito a infraestrutura nem deploy autônomo por esse título.

### M14 — Processos, projetos, aprovações e exceções

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-080 | Projetos, metas, tarefas, responsáveis, prazos e dependências. | Tarefa mostra origem, entregas e bloqueios; responsável pode ser humano ou agente. |
| RF-081 | Editor visual de fluxos com gatilhos, condições, etapas, aprovações e ações. | Fluxo inválido não é ativado; versão publicada preservada para execuções iniciadas. |
| RF-082 | Execução durável, retries limitados, timeout, cancelamento e retomada. | Reinício do worker não perde estado; efeitos externos não se repetem silenciosamente. |
| RF-083 | Caixa única de aprovações. | Exibe ação exata, workspace, destino, conteúdo/configuração, custo e validade da autorização. |
| RF-084 | Central de exceções e pausa de automações por escopo. | Pausa impede novas ações e sinaliza operações externas já em andamento. |
| RF-085 | Simulação de fluxos sem efeitos reais. | Ferramentas externas de escrita ficam bloqueadas, com resultados simulados identificados. |

### M15 — Painel executivo, inteligência e notificações

| ID | Requisito | Aceite mínimo |
| --- | --- | --- |
| RF-086 | Dashboard de negócio, operação, equipe IA e decisões pendentes. | Cada indicador permite rastrear origem e horário de atualização. |
| RF-087 | Resumo diário e perguntas sobre a operação. | Resposta distingue fato, hipótese, projeção e ausência de informação, citando registros acessíveis. |
| RF-088 | Alertas de falhas, divergências, vencimentos e oportunidades. | Alertas têm severidade, ação sugerida e deduplicação; usuário controla canais habilitados. |
| RF-089 | Relatórios e exportações por empresa e consolidados. | Agregação respeita escopo e filtros; arquivos têm validade e acesso controlados. |

## 6. Fluxos de ponta a ponta obrigatórios

### F-01 — Preparar uma empresa

Administrador cria workspace → escolhe módulos → define marca e permissões → conecta conta Hotmart → configura dados financeiros → importa histórico disponível → resolve divergências → ativa rotinas. Conexão não validada bloqueia apenas os fluxos que dela dependem, com estado explícito.

### F-02 — Venda e atualização comercial

Evento validado → inbox durável → deduplicação → resolução de produto/contato → atualização transacional da compra → recebível conforme dados disponíveis → atualização de indicadores → ações internas elegíveis → confirmação de processamento. Eventos de reembolso/chargeback atualizam o histórico e disparam análise fiscal configurada; nunca apagam a venda.

### F-03 — Fechamento financeiro

Importar/cadastrar despesas e recebimentos → conciliar → revisar divergências → calcular resultado com regras vigentes → gerar resumo e exportação. Reabertura/ajuste de período conserva trilha e motivo.

### F-04 — Emissão fiscal

Compra elegível + perfil validado → montar solicitação determinística → aprovação se exigida → submissão idempotente quando suportada → consulta de retorno → arquivo e estado → tratamento de rejeição. Resultado desconhecido exige reconciliação antes de repetir.

### F-05 — Vídeo para pacote de conteúdo

Upload → validação e metadados → transcrição → propostas de cortes e peças → revisão editorial → ajustes de enquadramento/legendas/artes → renderização → aprovação por versão → calendário → publicação ou exportação manual → métricas. Falha numa peça não apaga o restante do pacote.

### F-06 — Campanha assistida

Briefing + objetivo + limite financeiro → estratégia proposta → cenário financeiro → aprovação → produção de ativos → revisão → configuração de canais → execução autorizada → avaliação de resultados. Toda mudança de orçamento respeita limite e política; recuperação de vendas não entra neste fluxo.

### F-07 — Agente recebe tarefa

Usuário autorizado → contexto e conhecimento do workspace → plano de trabalho verificável → chamadas permitidas dentro do orçamento → aprovação quando exigida → execução → entrega com fontes/custos → avaliação. Delegação não amplia privilégios. Limites de passos, tempo e gastos interrompem ciclos.

### F-08 — Desativação e recuperação

Pausar conexão/módulo/workspace → impedir novos efeitos → classificar jobs em curso → preservar histórico → corrigir motivo → simular/reconciliar → retomar seletivamente. Retomada não republica nem refatura automaticamente ações já concluídas.

## 7. Modelo de domínio inicial

Esta lista orienta modelagem; não obriga uma tabela por termo.

| Domínio | Entidades candidatas |
| --- | --- |
| Estrutura | Organization, Workspace, Brand, Module, ModuleEntitlement, WorkspaceModule, WhiteLabelConfiguration, CustomDomain |
| Acesso | User, Membership, Role, Permission, RoleAssignment, Session, AuditEvent |
| Integrações | IntegrationConnection, ExternalIdentity, WebhookReceipt, SyncRun, InboxEvent, OutboxEvent |
| Comercial | Product, Offer, Purchase, PurchaseItem, PurchaseStatusHistory, Fee, Commission, Refund |
| Financeiro | FinancialAccount, Category, CostCenter, Payable, Receivable, Settlement, Reconciliation, Budget, Scenario |
| Fiscal | FiscalProfile, FiscalDocument, FiscalAttempt, FiscalEvent |
| CRM | Contact, ContactIdentity, Tag, Segment, CommunicationPreference, ContactEvent |
| Marketing | Campaign, Experiment, ChannelAccount, AttributionRecord, MetricSnapshot |
| Conteúdo | MediaAsset, Transcript, ClipProposal, Composition, ContentItem, ContentVersion, Template, RenderJob, Publication |
| Atendimento | Ticket, Conversation, Message, Assignment, Escalation |
| IA | AgentTemplate, AgentInstance, ToolGrant, KnowledgeSource, KnowledgeVersion, AgentRun, ToolInvocation, UsageRecord |
| Operação | Project, Task, WorkflowDefinition, WorkflowVersion, WorkflowRun, StepRun, ApprovalRequest, ExceptionCase |

Invariantes:

- Registros operacionais incluem workspace; referências entre entidades não podem apontar para outro workspace por acidente.
- Unicidade externa deve incluir conexão/provedor e identificador externo, não apenas e-mail ou ID genérico.
- Contato e compra são entidades diferentes; relação aluno/produto só existe conforme evidência disponível.
- Aprovação referencia versão/parametrização exata da ação e possui validade/estado; não é autorização genérica permanente.
- Documento fiscal e publicação têm identidade local e externa, com tentativas separadas do objeto principal.
- Jobs, arquivos e índices de busca herdam o isolamento dos dados de origem.
- Eventos de auditoria têm acesso e retenção próprios; não armazenar indiscriminadamente prompts ou payloads com dados pessoais.

## 8. Estados e contratos

Estados de conteúdo propostos: ideia → briefing → produção → revisão → aprovado → agendado → publicação em andamento → publicado; desvios: rejeitado para ajuste, cancelado, falha e resultado desconhecido.

Estados de execução propostos: pendente, executando, aguardando aprovação, bloqueado, concluído, falhou, cancelado. “Progresso” só deve mostrar porcentagem quando houver uma medida confiável.

Estados comerciais/fiscais devem ser mapeados a partir dos provedores em tabelas explícitas; não inventar equivalências universais.

Contratos internos/externos a detalhar no projeto:

- Identificador de correlação, workspace, ator, versão e timestamp nos eventos relevantes.
- Validação de payload, limites, paginação, filtros e erros consistentes nas APIs.
- Chave de idempotência e política de retenção para operações elegíveis.
- Contratos de ferramentas de agentes com entrada/saída estruturadas, escopo, custo e categoria de risco.
- Contratos de adaptadores que declarem capacidades; um provedor sem cancelamento não pode aparentar suportá-lo.
- URLs de download temporárias e autorização antes da emissão, sem bucket público por conveniência.

## 9. Requisitos não funcionais e operação

Os valores de desempenho abaixo são metas propostas para orientar medição; fechar orçamento e carga antes de tratá-los como SLA contratual.

| ID | Requisito e evidência de aceite |
| --- | --- |
| RNF-001 | Isolamento: testes negativos entre organizações/workspaces em API, jobs, arquivos, busca, agentes e exportações. Nenhuma exposição cruzada aceita. |
| RNF-002 | Autorização: testes de escalada horizontal/vertical e revogação antes de executar ações agendadas. |
| RNF-003 | Performance: alvo inicial p95 de até 1 s para consultas operacionais comuns no servidor, sob carga de referência documentada, excluindo chamadas externas e processamento pesado; paginação obrigatória. |
| RNF-004 | Responsividade: vídeo/IA/importação não bloqueiam request longo; usuário recebe ID de execução e acompanha estado. |
| RNF-005 | Capacidade: medir contatos, vendas históricas, eventos/dia, tamanho de arquivos, minutos de vídeo e jobs simultâneos; cinco usuários não é a única dimensão. |
| RNF-006 | Resiliência: retries com limites, backoff e distinção entre falha temporária, permanente e resultado desconhecido. |
| RNF-007 | Observabilidade: logs estruturados e correlação entre webhook, job, ação externa e usuário; alertas para falhas persistentes e saturação. |
| RNF-008 | Backup: banco, arquivos e configuração necessária com cópia fora da VPS; ensaio real de restauração. RPO/RTO finais pendentes. |
| RNF-009 | Segurança: TLS, proteção de sessões, validação de uploads, limites de requisição, gestão de segredos e proteção de endpoints administrativos. |
| RNF-010 | Privacidade: minimizar envio a provedores de IA, definir retenção e acesso, oferecer controles previstos em RF-013/RF-040. Revisão jurídica necessária antes de comercialização. |
| RNF-011 | Custos: painel e limites para IA, armazenamento e jobs; estimativas identificadas; não pressupor infraestrutura/API com custo zero. |
| RNF-012 | Usabilidade: web responsiva, navegação por teclado, contraste, mensagens de erro acionáveis e indicação persistente do workspace. |
| RNF-013 | Evolução: migrations versionadas, contratos verificáveis, módulos com fronteiras claras, release e rollback documentados. |
| RNF-014 | IA: avaliações de fidelidade às fontes, prompt injection, isolamento, uso de ferramentas, limites de passos e custo antes de autonomia ampliada. |
| RNF-015 | Continuidade: falha de IA não impede consulta de vendas/financeiro nem operação manual autorizada. |

### 9.1 Ambientes e implantação

Prever desenvolvimento local, ambiente de validação e produção com credenciais separadas. Se compartilharem host por custo, documentar isolamento e impacto de recursos; não reutilizar dados reais sem proteção.

Pipeline deve compilar frontend/backend, executar verificações relevantes, construir imagens versionadas, aplicar migrations controladas, publicar, verificar saúde e permitir recuperação. Migração destrutiva não é automaticamente revertida por trocar a imagem.

Entregar configuração de containers, rede, volumes, Nginx, HTTPS, health checks, reinício, logs, backup, alertas de disco e procedimentos de restauração. Fixar versões e reduzir permissões dos containers. Restringir painel do Hangfire a administradores autorizados.

Não concentrar arquivos de mídia ilimitados no mesmo disco do banco. Seleção de storage, política de expiração de derivados e custo de tráfego devem anteceder produção audiovisual real.

## 10. Mapa de telas

| Área | Telas mínimas |
| --- | --- |
| Entrada | Login, recuperação, convite, seleção de organização/workspace |
| Executivo | Dashboard, resumo, indicadores detalhados, decisões e alertas |
| Administração | Organizações, empresas, módulos, identidade, domínios, membros e permissões |
| Integrações | Conexões, configuração, sincronizações, eventos e falhas |
| Comercial | Produtos, ofertas, vendas e detalhes da compra |
| Financeiro | Contas, lançamentos, recorrências, conciliação, orçamento, projeções e relatórios |
| Fiscal | Configuração, documentos, detalhes e fila de pendências |
| CRM | Contatos, detalhes, segmentos, importações, captura e preferências |
| Marketing | Marcas, campanhas, ativos, experimentos e anúncios |
| Conteúdo | Ideias, calendário, biblioteca, upload, transcrição, cortes, editor visual, versões e publicação |
| Atendimento | Fila, conversa/ticket, encaminhamento e conhecimento |
| Agentes | Organograma, catálogo, ficha/configuração, chat, tarefas, execuções e consumo |
| Operação | Projetos, tarefas, editor de fluxos, aprovações, exceções e simulação |
| Plataforma | Organizações clientes, direitos de uso, limites, consumo e saúde global |

Estados vazios, carregamento, falta de permissão, erro, desconexão e ausência de integração fazem parte de cada tela relevante.

## 11. Pendências para descoberta

| ID | Decisão/pergunta | Bloqueia |
| --- | --- | --- |
| P-001 | Contas Hotmart, permissões, eventos e histórico efetivamente disponíveis. | Contratos e importação comercial finais. |
| P-002 | CNPJ/estabelecimentos, regime, município, documento fiscal e fornecedor. | Emissão fiscal em produção. |
| P-003 | Provedores/modelos de texto, imagem e transcrição; retenção, custos e capacidades. | Adaptadores de IA e orçamento real. |
| P-004 | Storage e mecanismo de renderização/editor; tamanho e duração dos vídeos. | Dimensionamento e processamento audiovisual. |
| P-005 | Contas Instagram/YouTube, anúncios, permissões e revisão de aplicativo. | Publicação e alterações reais nas plataformas. |
| P-006 | Provedor de e-mail e canais de atendimento; envio próprio ou via integração. | Comunicação externa. |
| P-007 | Regime gerencial, fórmulas, rateio, moedas, importação de planilhas e saldos. | Relatórios financeiros finais. |
| P-008 | Bibliotecas frontend, versões de banco/pacotes, autenticação/MFA e formato de contratos. | Fundação técnica final. |
| P-009 | Ativação de cobrança SaaS: no primeiro ano gestão manual de direitos ou cobrança integrada? | Cobrança comercial, não a arquitetura multiempresa. |
| P-010 | Páginas/funis: referências a ferramentas externas ou construtor/publicador próprio? | Funcionalidades de páginas além do cadastro de ativos. |
| P-011 | RPO/RTO, retenção, orçamento mensal e carga real. | Plano de operação e metas verificáveis. |
| P-012 | Organização jurídica dos workspaces e compartilhamentos explicitamente permitidos. | Regras fiscais e consolidações específicas. |

Um item pendente não bloqueia todo o backlog. Criar dependência somente nas tarefas afetadas. Novas ideias devem entrar em controle de mudança, com impacto de escopo/prazo/custo, sem reabrir silenciosamente a definição de pronto.

## 12. Estratégia de construção e validação

Marcos internos sugeridos, ainda não sprints fechadas:

1. **Fundação verificável:** decisões técnicas, repositório, ambiente, autenticação, workspace, permissões, módulos, CI e observabilidade mínima.
2. **Dados comerciais e financeiros:** conexões, Hotmart, catálogo, CRM básico, importação, lançamentos e conciliação.
3. **Execução assistida:** conhecimento, agentes, ferramentas, custo, aprovações, fluxos e exceções.
4. **Operação completa:** fiscal, relacionamento, atendimento, campanhas e inteligência executiva.
5. **Estúdio e distribuição:** biblioteca, transcrição, cortes, artes, revisão, calendário e integrações de publicação.
6. **Produto e operação final:** white label completo, administração comercial definida, testes ponta a ponta, segurança, desempenho, restauração, documentação e entrada em produção.

As dependências podem permitir construir trilhas em paralelo; estes marcos não exigem esperar um módulo inteiro para iniciar outro. Não deixar isolamento, auditoria e controles de custo para o fim.

### 12.1 Cenários críticos de aceite integrado

- Criar dois workspaces com dados semelhantes e provar que usuários/agentes não cruzam dados.
- Receber o mesmo evento Hotmart várias vezes sem duplicar efeitos.
- Receber atualização comercial fora de ordem e manter estado consistente.
- Importar histórico sobreposto aos webhooks sem duplicar compras.
- Conciliar venda parcelada, taxa, reembolso e recebimento parcial com cálculos reproduzíveis.
- Simular timeout fiscal após envio e reconciliar antes de nova solicitação.
- Revogar acesso ou conexão após agendar e antes da execução; ação deve ser bloqueada.
- Alterar peça aprovada e exigir revisão da nova versão antes de publicação.
- Publicação com resposta perdida não deve gerar duplicata por retry cego.
- Agente recebe instrução maliciosa num documento e não obtém privilégios extras.
- Atingir orçamento de IA interrompe novas chamadas sem corromper a tarefa.
- Reiniciar worker durante processamento e recuperar estado sem efeitos duplicados.
- Processar vídeo com limite de recursos sem tornar API indisponível.
- Restaurar backup em ambiente isolado e verificar banco, arquivos e vínculos.
- Operador resolve uma exceção e conclui fluxo manualmente com auditoria.

## 13. Definição de pronto

### 13.1 Por tarefa/entrega

- Critérios de aceite demonstrados e requisito de origem identificado.
- Permissões, workspace, validações e estados de erro implementados onde aplicáveis.
- Testes proporcionais ao risco: cálculos, acesso, integrações e efeitos externos exigem cobertura significativa; evitar testes que apenas repitam implementação.
- Migrations, configurações e variáveis novas documentadas.
- Logs/alertas úteis e ausência de segredos nos artefatos.
- Código revisado e build/verificações aplicáveis aprovados.
- Documentação da entrega e lessons atualizadas conforme seção 14.
- Limitações reais e dependências abertas declaradas, sem marcar simulação como integração em produção.

### 13.2 Para entrada em operação

Todos os requisitos em escopo devem estar implementados e aceitos, ou ter alteração de escopo explicitamente registrada pelo proprietário. Pendências não podem ser removidas por silêncio.

Exigir fluxos F-01 a F-08 demonstrados, integrações necessárias validadas, importação inicial conferida, política fiscal aprovada, orçamento configurado, restauração testada, acesso revisado e procedimentos de incidentes disponíveis. Incluir um checklist concreto de publicação e autorização para ações reais quando necessária.

## 14. Documentação obrigatória e trilha de aprendizado

Estas regras devem aparecer em todas as tarefas de entrega, independentemente de implementação por Claude, Codex ou Antigravity. Este documento não substitui os arquivos de instruções próprios dessas ferramentas.

### 14.1 Pasta documentacoes

Na raiz do repositório: `documentacoes/<dominio>/AAAA-MM-DD-ID-titulo-breve.md`. Criar domínio se não existir. Manter índice navegável.

Cada documento deve conter:

1. Data de implementação, título, ID da tarefa e requisitos atendidos.
2. Problema, comportamento anterior quando houver e resultado da entrega.
3. Arquivos afetados e decisões técnicas.
4. Branch, commit-base e commits da tarefa, usando hashes reais quando disponíveis.
5. Diffs relevantes dos códigos/configurações da tarefa; se extensos, arquivo complementar vinculado dentro do domínio com indicação completa do intervalo.
6. Migrations, variáveis, procedimentos de implantação e recuperação.
7. Testes executados, resultados e evidências.
8. Limitações, riscos reais e próximos passos.
9. Links para as lessons relacionadas.

Nunca inventar hashes ou diffs. Se ainda não houver commit, identificar como diff de trabalho não commitado. Capturar apenas mudanças da tarefa, preservando trabalho alheio e excluindo segredos. Atualizar referências quando os commits existirem, sem ciclo infinito de documentar o próprio commit documental.

### 14.2 Pasta lessons

Na raiz: `lessons/README.md` como índice com links e arquivos numerados em ordem didática. Cada implementação deve ensinar os conceitos usados, com exemplos do próprio projeto, código, configurações, testes e motivos das escolhas.

Estrutura de cada lesson: objetivo → pré-requisitos → conceito → aplicação no Nucleos → exemplo explicado → como executar/verificar → erros comuns → links para entregas e leituras oficiais pertinentes.

Reorganizar/renumerar quando melhorar a sequência e corrigir todos os links afetados. Não duplicar artificialmente conceitos: atualizar a lesson existente e vincular a nova aplicação. Cobrir C#/.NET, React/TypeScript, PostgreSQL, EF Core, jobs, integração, segurança, IA, mídia e operação conforme forem utilizados.

## 15. Instrução executável para o agente planejador

Use o texto abaixo como solicitação juntamente com este arquivo:

> Você é o agente de planejamento do Nucleos. Leia integralmente esta especificação e as instruções vigentes do repositório. Produza um plano completo de implementação do produto, cobrindo todos os requisitos RF, RNF, fluxos e obrigações documentais. Preserve a stack C#/ASP.NET Core/.NET 10, React/TypeScript, PostgreSQL, EF Core/Npgsql, Hangfire/PostgreSQL, Docker, Nginx e VPS Linux Hostinger, com IA externa. Não substitua a stack ou reduza o projeto a MVP. Diferencie decisões confirmadas, base proposta e pendências. Crie investigações para pendências e valide APIs/versões em fontes oficiais antes de afirmar suporte. Estruture épicos, features, histórias, tarefas e subtarefas com IDs estáveis, dependências, critérios de aceite, esforço estimado e evidências de conclusão. Organize sprints por capacidade explicitada, não por datas inventadas. Inclua frontend, backend, banco, jobs, segurança, testes, observabilidade, documentação, lessons e deploy. Não execute gastos, publicações ou ações externas como parte do planejamento. Entregue matriz de rastreabilidade e relatório de lacunas; nenhum requisito pode desaparecer silenciosamente.

### 15.1 Entregáveis do planejamento

- Visão de arquitetura e ADRs para decisões relevantes.
- Backlog completo organizado por domínio e requisito de origem.
- Mapa de dependências, caminho crítico e investigações bloqueadoras.
- Sprints propostas com objetivo, capacidade assumida e incremento verificável.
- Especificação suficiente das tarefas próximas e cobertura de todos os módulos futuros.
- Contratos de integração/API, modelo de dados e mapa de telas a detalhar por domínio.
- Plano de validação, operação, migração/importação inicial e entrada em produção.
- Matriz RF/RNF/F → épico → tarefas → testes/evidências.
- Arquivo estruturado importável, como CSV, além da versão legível. Ajustar campos ao aplicativo de destino quando escolhido.

### 15.2 Modelo de tarefa

```yaml
id: NUC-FIN-001
tipo: historia
titulo: Conciliar um recebimento com um recebivel
dominio: financeiro
epico: NUC-EP-FIN
requisitos: [RF-027, RNF-001, RNF-002]
objetivo: Explicar o beneficio observavel para o operador
descricao: Detalhar comportamento, entradas e resultado
inclui: []
exclui: []
dependencias: []
pendencias: [P-007]
atores: [responsavel_financeiro]
permissoes: []
regras_negocio: []
criterios_aceite:
  - Dado um contexto, quando ocorrer uma acao, entao observar um resultado
cenarios_falha: []
frontend: []
backend: []
dados_migrations: []
jobs_integracoes: []
seguranca_isolamento: []
observabilidade: []
testes_evidencias: []
documentacoes: documentacoes/financeiro/AAAA-MM-DD-ID-titulo.md
lessons: []
estimativa:
  unidade: pontos_ou_horas
  intervalo: a_estimar
  confianca: a_definir
sprint: a_planejar
definicao_pronto: aplicar_secao_13
```

Não preencher todos os campos com generalidades copiadas. Cada tarefa deve ter detalhes específicos suficientes para execução e revisão. Tarefas grandes devem ser divididas por comportamento verificável, mantendo dependências explícitas.

### 15.3 Regras de priorização e estimativa

- Ordenar por dependência e redução de risco, mantendo o escopo completo.
- Não tratar “tudo urgente” como ausência de ordem técnica.
- Declarar capacidade semanal do desenvolvedor como premissa pendente; não assumir dedicação integral.
- Separar esforço de implementação de espera por aprovação de API, fornecedor ou contabilidade.
- Usar faixas e confiança; não prometer aceleração fixa por usar IA.
- Contabilizar documentação, revisão, lessons, integração e estabilização.
- Encerrar o planejamento com lista explícita de lacunas, decisões e critérios para considerar o produto pronto.

## 16. Proveniência e controle de mudanças

Base: conversas de definição funcional do Nucleos nesta sessão e recuperação contextual da conversa “Planejar stack tecnológica” e das regras de “Criar diretrizes e documentação”, no projeto Planejamento software gestão, em 2026-09-22.

A recuperação da conversa tecnológica indicou C#/.NET 10, React/TypeScript, PostgreSQL, EF Core/Npgsql, Hangfire/PostgreSQL e VPS Hostinger como stack revisada. Itens não explicitados — versões de pacotes, fornecedores de IA, storage, fiscal e bibliotecas frontend — permanecem pendentes.

Esta versão não inclui pesquisa atual das APIs de terceiros e não garante suas capacidades. A validação integra o trabalho de descoberta. Não incorporar decisões de outros projetos, como VERSE.

Para alterar o escopo: registrar data, requisito afetado, motivo, decisão, dependências e impacto no backlog. Preservar IDs; requisitos removidos devem ser marcados como substituídos ou excluídos com justificativa, nunca simplesmente apagados.
