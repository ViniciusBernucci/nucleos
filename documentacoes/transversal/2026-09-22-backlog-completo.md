# Nucleos — backlog completo de épicos e sprints

Data do planejamento: 2026-09-22  
Domínio: transversal  
Solicitação: decompor a Especificação Mestra v1.0 em um plano integral e executável  
Fonte: [Nucleos-Especificacao-Mestra.md](../../Nucleos-Especificacao-Mestra.md)  
Estado: proposta de planejamento; nenhum item deste documento afirma implementação  
Autores conhecidos: Vinícius (produto e especificação), Codex (decomposição)  
Branch, commit-base e commits: não aplicável — a raiz ainda não é um repositório Git  

> **Nota de substituição (2026-10-25) — status: Substituída em parte.** A **stack tecnológica** descrita neste backlog (.NET 10) foi substituída pelas decisões do [ADR de arquitetura de 2026-10-25](2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md) (NestJS/TypeScript, Python, React/Next.js; ver [ADR-004..006](../arquitetura/adr/README.md)). O restante (visão de produto, domínio, requisitos funcionais e regras de negócio) permanece como insumo, sujeito à consolidação da segunda parte do planejamento. Nenhum conteúdo original foi apagado. Origem: tarefa FND-008; questões Q-01 e Q-07 do [README do backlog](../backlog/README.md).

> Este backlog cobre o produto completo. “Release” e “sprint” são marcos de construção e validação, não autorização para gastos, publicação, acesso a contas externas ou redução silenciosa de escopo.

## 1. Resumo executivo

O plano preserva o monólito modular em .NET 10, frontend React/TypeScript, PostgreSQL, EF Core/Npgsql, Hangfire/PostgreSQL, API e worker separados em containers, Nginx e VPS Linux. Integrações, IA e processamento de mídia entram por adaptadores e capacidades verificadas. Isolamento por workspace, autorização no servidor, idempotência, auditoria, operação manual e observabilidade são requisitos de todas as fatias, não tarefas deixadas para o final.

### Indicadores do plano

| Item | Quantidade |
| --- | ---: |
| Requisitos funcionais cobertos | 89 de 89 |
| Requisitos não funcionais cobertos | 15 de 15 |
| Fluxos ponta a ponta cobertos | 8 de 8 |
| Pendências convertidas em spikes | 12 de 12 |
| Épicos | 21 |
| Tickets | 116 (12 spikes e 104 tickets de arquitetura, produto, qualidade e operação) |
| Sprints propostas | 18 (SPRINT-00 a SPRINT-17) |

### Premissas de planejamento

- **ASSUMPTION A-001:** sprints têm cadência fixa a definir; este documento não converte complexidade em prazo.
- **ASSUMPTION A-002:** capacidade semanal, dedicação e tamanho da equipe estão pendentes; não se assume dedicação integral. No kickoff, limitar WIP a um ticket por implementador e selecionar da fila da sprint somente o volume sustentado por dados reais, recalibrando após duas cadências.
- **ASSUMPTION A-003:** XS/S/M/L medem complexidade relativa, incluindo testes, documentação e lessons; não representam horas. Ticket XL deve ser dividido antes de entrar em sprint.
- **ASSUMPTION A-004:** os ambientes serão local, validação e produção. Isolamento adicional no mesmo host depende do resultado de DISC-011.
- **ASSUMPTION A-005:** autenticação, bibliotecas frontend, fornecedores e versões exatas permanecem propostas até os spikes correspondentes e seus ADRs.
- **ASSUMPTION A-006:** toda escrita em serviço externo exige credencial válida, política de autorização e aprovação explícita quando classificada como sensível.

### Escopo e estratégia de releases

| Release | Sprints | Resultado |
| --- | --- | --- |
| R0 — Fundação verificável | 00–02 | Decisões, solução executável, tenancy, identidade, segurança e observabilidade mínima. |
| R1 — Operação interna de dados | 03–06 | Hotmart, comercial, CRM, financeiro e fiscal em validação controlada. |
| R2 — Automação e produção assistida | 07–13 | Agentes, conhecimento, workflows, campanhas, atendimento, mídia, conteúdo e publicação. |
| R3 — Produto completo em produção | 14–17 | Painel executivo, white label/comercial, hardening, restauração, go-live e pós-lançamento. |

Não há “MVP reduzido”. A primeira entrada em produção corresponde ao escopo completo aprovado ou a uma alteração formal de escopo com IDs preservados.

## 2. Arquitetura e decisões a produzir

### Visão de componentes

~~~mermaid
flowchart LR
    UI[React/TypeScript] --> API[ASP.NET Core API]
    API --> DB[(PostgreSQL)]
    API --> JOBS[Hangfire/PostgreSQL]
    WORKER[.NET Worker] --> JOBS
    WORKER --> DB
    API --> STORE[Object storage]
    WORKER --> STORE
    API --> ADAPTERS[Adaptadores externos]
    WORKER --> ADAPTERS
    ADAPTERS --> HOTMART[Hotmart]
    ADAPTERS --> FISCAL[Provedor fiscal]
    ADAPTERS --> AI[APIs de IA]
    ADAPTERS --> CHANNELS[Email / anúncios / redes]
    OBS[Logs, métricas e alertas] --- API
    OBS --- WORKER
~~~

### ADRs obrigatórios antes da implementação dependente

| ADR | Decisão | Ticket de origem |
| --- | --- | --- |
| ADR-001 | Limites do monólito modular, dependências e propriedade de dados | NUC-ARC-001 |
| ADR-002 | Contexto de organização/workspace e isolamento no EF Core/PostgreSQL | NUC-ARC-002 |
| ADR-003 | Autenticação, sessão, MFA e recuperação | NUC-DISC-008 / NUC-IAM-001 |
| ADR-004 | Contratos HTTP, erros, paginação, idempotência e correlação | NUC-ARC-003 |
| ADR-005 | Inbox/outbox, Hangfire, retries e resultado desconhecido | NUC-JOB-001 |
| ADR-006 | Storage, upload, URLs temporárias e retenção | NUC-DISC-004 |
| ADR-007 | Adaptadores e capacidades de provedores | NUC-INT-001 |
| ADR-008 | Renderização e isolamento de recursos de mídia | NUC-DISC-004 / NUC-MED-005 |
| ADR-009 | Provedores de IA, privacidade, orçamento e fallback | NUC-DISC-003 / NUC-AI-005 |
| ADR-010 | Implantação, migrations expand/contract e rollback | NUC-INF-002 |

## 3. Regras globais dos tickets

### Definition of Ready

Um ticket só entra em execução quando objetivo, escopo, aceite, dependências, contrato de dados/API, implicações de segurança e pendências bloqueadoras estiverem resolvidos ou explicitamente assumidos. Spikes encerram com evidência e decisão; “pesquisar” não é resultado suficiente.

### Definition of Done

Aplica-se a todos os tickets, além do aceite específico:

- implementação e cenários de erro atendem aos requisitos referenciados;
- isolamento, autorização, auditoria e proteção de dados são testados quando aplicáveis;
- testes relevantes passam; análise estática, formatação e build passam;
- migrations são seguras, versionadas e avaliadas para compatibilidade e recuperação;
- logs, métricas e alertas úteis existem sem segredos ou dados pessoais indevidos;
- contratos/API, operação e rollback são atualizados;
- é criado ou atualizado documento em documentacoes/<dominio>/AAAA-MM-DD-ID-titulo.md com branch/base, commits/diffs reais e verificações;
- lessons aplicáveis são criadas/atualizadas e lessons/README.md permanece íntegro; quando não houver conceito didático, a justificativa consta no documento da entrega;
- nenhum refactor alheio é misturado e nenhuma simulação é apresentada como integração real.

### Convenções de ticket

- Prioridade: Crítica, Alta, Média ou Baixa.
- Risco: BAIXO, MÉDIO, ALTO ou CRÍTICO.
- Testes abreviados: U (unitário/domínio), I (integração), API, C (componente), E2E, SEC, PERF, A11Y e OPS.
- Paralelização informa somente execução técnica; pendências externas continuam separadas.
- O prompt de execução sempre implica: ler AGENTS.md, este ticket, ADRs e contratos relacionados; implementar somente o escopo; validar e documentar.

## 4. Catálogo de épicos

### NUC-EP-DISC — Descoberta e decisões

**Objetivo:** fechar incertezas que alteram contratos, segurança, custo ou capacidade. **Valor:** evita implementar capacidades inexistentes ou regras não autorizadas. **Escopo:** P-001 a P-012 e ADRs resultantes. **Fora:** contratar/publicar/alterar contas reais. **Dependências:** acesso humano a dados e documentação oficial. **RF/RNF:** habilita todos; especialmente RNF-005, RNF-008, RNF-011 e RNF-014. **Riscos:** espera externa e decisões sem evidência. **Conclusão:** 12 decisões registradas, com alternativa, trade-off e bloqueios liberados. **Features:** integrações, finanças/fiscal, stack, mídia/IA, comercial e operação.

### NUC-EP-ARC — Arquitetura e fundação de engenharia

**Objetivo:** entregar solução reproduzível e limites modulares verificáveis. **Valor:** base segura para fatias verticais. **Escopo:** repositório, solução, contratos, persistência, frontend shell e padrões. **Fora:** funcionalidades de negócio completas. **Dependências:** DISC-008. **RF/RNF:** RNF-001, 003, 004, 006, 009, 012, 013. **Riscos:** acoplamento precoce. **Conclusão:** API, worker e web sobem localmente; pipeline e testes de arquitetura passam. **Features:** scaffolding, modularidade, UX foundation.

### NUC-EP-IAM — Identidade, acesso, auditoria e privacidade

**Objetivo:** controlar identidades humanas e ações privilegiadas. **Valor:** acesso seguro e rastreável. **Escopo:** RF-009–013. **Fora:** cobrança e identidade de agentes. **Dependências:** ARC, DISC-008/011. **RF/RNF:** RF-009–013; RNF-001, 002, 009, 010. **Riscos:** escalada de privilégio e retenção incompatível. **Conclusão:** autenticação, RBAC, MFA, auditoria e direitos de dados demonstrados. **Features:** sessão, memberships, papéis, audit trail, privacidade.

### NUC-EP-PLT — Plataforma, tenancy e white label

**Objetivo:** operar organizações/workspaces isolados e configuráveis. **Valor:** base multiempresa e futura comercialização. **Escopo:** RF-001–008. **Fora:** cobrança SaaS sem P-009. **Dependências:** ARC, IAM. **RF/RNF:** RF-001–008; RNF-001, 002, 012. **Riscos:** vazamento entre tenants e domínio incorreto. **Conclusão:** administração, módulos, templates, identidade, domínio e consolidação passam em testes cruzados. **Features:** organização, módulos, branding, domínio, entitlement.

### NUC-EP-INT — Integrações e Hotmart

**Objetivo:** ingerir e reconciliar dados externos de forma durável. **Valor:** fonte comercial confiável. **Escopo:** RF-014–019. **Fora:** checkout, área de membros e recuperação de vendas próprios. **Dependências:** P-001, ARC, PLT, IAM. **RF/RNF:** RF-014–019; RNF-001, 004, 006, 007, 013. **Riscos:** contrato externo, duplicidade e ordem. **Conclusão:** webhook, sync e importação sobreposta são idempotentes e observáveis. **Features:** conexões, inbox, reconciliação, falhas.

### NUC-EP-COM — Produtos, ofertas e vendas

**Objetivo:** representar o ciclo comercial sem confundir venda, acesso e liquidação. **Valor:** rastreabilidade de receita e origem. **Escopo:** RF-020–023. **Fora:** executar checkout. **Dependências:** INT. **RF/RNF:** RF-020–023; RNF-003, 006, 007. **Riscos:** mapeamentos incompletos. **Conclusão:** catálogo, histórico e indicadores reconciliam com eventos de origem. **Features:** catálogo, ofertas, compras e métricas.

### NUC-EP-FIN — Financeiro gerencial

**Objetivo:** controlar lançamentos, conciliar e explicar resultados. **Valor:** decisão financeira reproduzível. **Escopo:** RF-024–031. **Fora:** transferência bancária e decisão tributária por IA. **Dependências:** P-007, COM, storage. **RF/RNF:** RF-024–031; RNF-003, 010, 011, 015. **Riscos:** cálculo incorreto e importação duplicada. **Conclusão:** fechamento F-03 passa com trilha e exportação. **Features:** contas, lançamentos, importação, conciliação, relatórios, projeções.

### NUC-EP-FIS — Fiscal

**Objetivo:** emitir e acompanhar documentos por provedor com decisão contábil validada. **Valor:** operação fiscal rastreável. **Escopo:** RF-032–035. **Fora:** inferência fiscal por IA. **Dependências:** P-002/P-012, COM, FIN, approvals. **RF/RNF:** RF-032–035; RNF-002, 006, 007, 009. **Riscos:** duplicidade e não conformidade. **Conclusão:** F-04, rejeição e resultado desconhecido demonstrados em sandbox/homologação. **Features:** perfil, emissão, reconciliação, fila.

### NUC-EP-CRM — CRM e relacionamento

**Objetivo:** manter contato, identidade, consentimento e comunicação por workspace. **Valor:** relacionamento segmentado e seguro. **Escopo:** RF-036–041. **Fora:** recuperação de vendas. **Dependências:** INT, P-006. **RF/RNF:** RF-036–041; RNF-001, 002, 010. **Riscos:** mesclagem indevida e comunicação sem consentimento. **Conclusão:** importação, deduplicação, segmentação, supressão e envio rastreável passam. **Features:** contatos, timeline, consentimento, canais.

### NUC-EP-MKT — Marcas, campanhas e anúncios

**Objetivo:** planejar e medir campanhas sob limites financeiros. **Valor:** execução de marketing ligada a custos e resultados. **Escopo:** RF-042–046. **Fora:** construtor de páginas antes de P-010 e alteração de anúncios sem aprovação. **Dependências:** CRM, FIN, P-005/P-010. **RF/RNF:** RF-042–046; RNF-002, 011, 012. **Riscos:** gasto externo e atribuição enganosa. **Conclusão:** F-06 demonstrado com aprovação e incerteza explícita. **Features:** brand kit, campanha, ativos, ads, experimentos.

### NUC-EP-MED — Biblioteca e estúdio de vídeo

**Objetivo:** transformar fontes audiovisuais em cortes revisáveis sem saturar a plataforma. **Valor:** produção assistida e reaproveitável. **Escopo:** RF-047–054. **Fora:** editor profissional genérico. **Dependências:** P-003/P-004, PLT, jobs, storage. **RF/RNF:** RF-047–054; RNF-004–007, 009, 011. **Riscos:** custo, upload malicioso e esgotamento de recursos. **Conclusão:** upload a versão renderizada funciona com cancelamento e isolamento. **Features:** assets, transcrição, cortes, composição, render.

### NUC-EP-CNT — Conteúdo estático e reaproveitamento

**Objetivo:** criar peças editáveis, versionadas e derivadas de fontes. **Valor:** produção consistente por marca. **Escopo:** RF-055–061. **Fora:** publicação externa. **Dependências:** MKT, MED, AI. **RF/RNF:** RF-055–061; RNF-004, 009, 011, 012, 014. **Riscos:** direitos autorais e regeneração destrutiva. **Conclusão:** pacote preserva fontes, camadas e aprovação por versão. **Features:** briefing, formatos, imagens, editor, templates, review.

### NUC-EP-PUB — Calendário, publicação e resultados

**Objetivo:** agendar, publicar/reconciliar e medir conteúdo. **Valor:** distribuição controlada. **Escopo:** RF-062–066. **Fora:** canal/formato não confirmado. **Dependências:** P-005, CNT, approvals. **RF/RNF:** RF-062–066; RNF-002, 004, 006, 007. **Riscos:** publicação duplicada e permissão expirada. **Conclusão:** F-05 conclui com publicação ou export manual e métricas rastreáveis. **Features:** calendário, scheduler, channel adapters, reconciliation, metrics.

### NUC-EP-SUP — Atendimento e produto educacional

**Objetivo:** registrar casos e assistir respostas com fontes autorizadas. **Valor:** suporte consistente e melhoria baseada em evidência. **Escopo:** RF-067–070. **Fora:** inventar dados acadêmicos ausentes. **Dependências:** CRM, COM, AI, P-006. **RF/RNF:** RF-067–070; RNF-001, 010, 014, 015. **Riscos:** resposta incorreta e exposição de dados. **Conclusão:** caso nasce, recebe sugestão citada, escala e gera insight rastreável. **Features:** inbox, assistência, SLA interno, insights.

### NUC-EP-AI — Agentes, conhecimento e governança de IA

**Objetivo:** operar agentes com conhecimento, ferramentas, orçamento e avaliações. **Valor:** automação controlada e observável. **Escopo:** RF-071–079. **Fora:** treinar/hospedar LLM e autonomia financeira irrestrita. **Dependências:** P-003, IAM, PLT, jobs. **RF/RNF:** RF-071–079; RNF-001, 002, 007, 010, 011, 014, 015. **Riscos:** prompt injection, custo e privilégio indevido. **Conclusão:** F-07 passa com limites, fontes, aprovações e fallback manual. **Features:** catálogo, funções, chat, RAG, tools, delegação, monitor, custos, evals.

### NUC-EP-WFL — Projetos, fluxos, aprovações e exceções

**Objetivo:** executar processos duráveis com intervenção humana. **Valor:** automação recuperável e auditável. **Escopo:** RF-080–085. **Fora:** exatamente uma vez em sistemas externos. **Dependências:** ARC/JOB, IAM, AI. **RF/RNF:** RF-080–085; RNF-002, 004, 006, 007, 015. **Riscos:** efeitos duplicados e versões mutáveis. **Conclusão:** F-08 e retomada após reinício passam. **Features:** projetos, designer, runtime, approvals, exceptions, simulation.

### NUC-EP-EXE — Painel executivo, inteligência e notificações

**Objetivo:** tornar situação, decisões e alertas explicáveis. **Valor:** gestão diária orientada a dados. **Escopo:** RF-086–089. **Fora:** preencher ausência com estimativa não marcada. **Dependências:** domínios de origem, AI e notificações. **RF/RNF:** RF-086–089; RNF-003, 007, 010, 012, 015. **Riscos:** métricas inconsistentes e vazamento consolidado. **Conclusão:** cada número/fato liga à origem, período e escopo autorizado. **Features:** dashboard, resumo, alertas, exports.

### NUC-EP-SEC — Segurança e qualidade transversal

**Objetivo:** provar isolamento, proteção e qualidade do produto. **Valor:** reduzir risco de dados, abuso e regressão. **Escopo:** threat model, testes, SAST/dependências, upload, carga, acessibilidade e E2E. **Fora:** certificação formal não contratada. **Dependências:** todos os épicos. **RF/RNF:** todos; foco RNF-001–015. **Riscos:** descoberta tardia de falha sistêmica. **Conclusão:** gates críticos passam sem achado bloqueador. **Features:** security, QA, performance, accessibility.

### NUC-EP-INF — Infraestrutura, CI/CD e observabilidade

**Objetivo:** construir, implantar e operar ambientes reproduzíveis. **Valor:** entrega segura e diagnóstico. **Escopo:** Docker, Nginx, CI/CD, secrets, storage, métricas e alertas. **Fora:** Kubernetes e microserviços. **Dependências:** DISC-011, ARC. **RF/RNF:** RNF-003–009, 011, 013. **Riscos:** VPS saturada, perda de dados e deploy irreversível. **Conclusão:** promoção e rollback ensaiados; health e alertas acionáveis. **Features:** environments, pipeline, observability.

### NUC-EP-REL — Produção e operações

**Objetivo:** entrar e permanecer em produção com recuperação comprovada. **Valor:** continuidade operacional. **Escopo:** backups, restore, importação inicial, readiness, go-live, runbooks e pós-lançamento. **Fora:** prometer SLA não aprovado. **Dependências:** todos os épicos e P-011. **RF/RNF:** todos; foco RNF-005–008, 013, 015 e F-01–F-08. **Riscos:** perda de dados e release sem retorno. **Conclusão:** checklist aprovado, restore e rollback ensaiados, operação acompanhada. **Features:** DR, migration rehearsal, release, hypercare.

### NUC-EP-DOC — Documentação e aprendizagem viva

**Objetivo:** manter decisões, entregas e conhecimento implementável sincronizados. **Valor:** continuidade entre pessoas/agentes. **Escopo:** documentacoes, lessons, índices, diffs e links. **Fora:** documentação fictícia. **Dependências:** transversal. **RF/RNF:** D-013, RNF-013. **Riscos:** documentação divergente. **Conclusão:** cada entrega satisfaz AGENTS.md e valida links. **Features:** templates, índices, auditoria documental.

## 5. Backlog executável

Os tickets abaixo usam a Definition of Done global. “Docs” indica o domínio mínimo; o nome final segue AGENTS.md. O campo “Prompt” é o handoff curto para outra sessão Codex.

### 5.1 Spikes de descoberta — NUC-EP-DISC

| ID | Sprint | Prioridade / Est. / Risco | Pergunta e escopo | Saída e aceite | Dependências / paralelização | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-DISC-001 | 00 | Crítica / M / ALTO | P-001: quais APIs, webhooks, autenticação, campos, limites, histórico, sandbox, assinatura e reconciliação Hotmart estão oficialmente disponíveis? Sem implementar integração. | Matriz capacidade × fonte oficial × conta real; payloads redigidos; gaps; recomendação e ADR. Aceite: cada RF-015–018 marcado suportado, parcial ou indisponível. | Acesso do proprietário; paralelo a 002–012; bloqueia INT-002–005. | integrações; “Investigue P-001 em fontes oficiais e evidência da conta; produza matriz e decisão sem usar credencial em artefatos.” |
| NUC-DISC-002 | 00 | Crítica / M / CRÍTICO | P-002: fechar entidade emissora, estabelecimentos, regime, município, documento, certificado, momento de emissão e fornecedores. | Decisão assinada pelo responsável contábil; matriz de provedores/capacidades/custos; sandbox; eventos e reconciliação. | Proprietário/contabilidade; bloqueia FIS-001–004. | fiscal; “Conduza P-002 e registre somente decisões validadas, alternativas e bloqueios fiscais.” |
| NUC-DISC-003 | 00 | Alta / M / ALTO | P-003: avaliar modelos/provedores de texto, imagem e transcrição por qualidade, privacidade, retenção, custo, limites e fallback. | Benchmarks pequenos e sem dados pessoais; tabela de preços datada; adaptadores/capability flags; ADR-009. | Paralelo; bloqueia AI-001, MED-002, CNT-003. | agentes-ia; “Avalie P-003 com casos representativos e produza recomendação versionada, sem contratar serviço.” |
| NUC-DISC-004 | 00 | Crítica / L / ALTO | P-004: escolher storage e pipeline de mídia/render, medir tamanhos/durações, CPU/RAM/disco/tráfego e isolamento. | Protótipo descartável ou benchmark; limites; lifecycle; segurança; custo; ADR-006/008 e critério para separar worker. | Requer amostras; bloqueia MED-001/005. | conteudo; “Investigue P-004 com benchmark reprodutível e dimensione storage/renderização sem publicar.” |
| NUC-DISC-005 | 00 | Alta / M / ALTO | P-005: validar Instagram/YouTube e anúncios: contas, formatos, permissões, revisão, quotas, agendamento, métricas e escrita. | Capability matrix oficial por canal; processo de autorização/revogação; formatos manuais de fallback; riscos de gasto. | Acesso humano; bloqueia MKT-004 e PUB-003–005. | publicacao; “Valide P-005 em documentação oficial e registre capacidades reais e aprovações necessárias.” |
| NUC-DISC-006 | 00 | Alta / S / MÉDIO | P-006: definir provedor de e-mail e canais de atendimento, opt-in/out, webhooks, limites e reputação. | Decisão de canal/provedor, contrato de adaptador, custos, sandbox, retenção e unsubscribe. | Bloqueia CRM-006/SUP-001. | relacionamento; “Resolva P-006 e detalhe contratos, consentimento e fallback manual.” |
| NUC-DISC-007 | 00 | Crítica / M / CRÍTICO | P-007: definir caixa/competência, moedas, saldos, rateio, margem, importações, fechamento e reabertura. | Glossário e fórmulas com exemplos aprovados; layouts; invariantes e casos de arredondamento. | Proprietário/financeiro; bloqueia FIN-001–006. | financeiro; “Feche P-007 com exemplos numéricos revisáveis; não invente regra contábil.” |
| NUC-DISC-008 | 00 | Crítica / L / ALTO | P-008: verificar .NET/PostgreSQL/EF/Npgsql/Hangfire e decidir build React, router, estado, UI, auth/MFA e padrão de contratos. | Compatibility matrix datada; ADRs; lock de versões; licença; hello-world validado. | Bloqueia ARC/IAM; pode dividir benchmark técnico sem dividir decisão. | arquitetura; “Resolva P-008 com documentação oficial e PoC mínima; registre versões e trade-offs.” |
| NUC-DISC-009 | 00 | Média / S / MÉDIO | P-009: gestão manual de direitos no primeiro ano ou cobrança SaaS integrada? | Jornada, estados de assinatura, responsabilidades, dados e decisão; se integrada, novo spike do provedor antes de implementação. | Bloqueia PLT-004 apenas na cobrança. | plataforma; “Decida P-009 e preserve entitlement independente do mecanismo de cobrança.” |
| NUC-DISC-010 | 00 | Média / S / MÉDIO | P-010: páginas/funis serão referências externas ou haverá construtor/publicador próprio? | Decisão, mapa de telas, ownership, integrações, segurança e impacto de escopo. | Bloqueia MKT-003 além do cadastro. | marketing; “Resolva P-010 e registre alteração de escopo se houver construtor próprio.” |
| NUC-DISC-011 | 00 | Crítica / M / CRÍTICO | P-011: definir carga, orçamento mensal, retenção, RPO/RTO e limites do host. | Modelo de carga/custo, SLOs internos, RPO/RTO aprovados e plano de backup/capacidade. | Bloqueia INF-002, REL-001/002. | operacoes; “Feche P-011 com premissas mensuráveis e critérios de revisão; não prometa SLA.” |
| NUC-DISC-012 | 00 | Crítica / M / ALTO | P-012: mapear pessoa jurídica, estabelecimento, workspace e compartilhamentos autorizados. | Modelo e exemplos; regras de agregação; impacto fiscal/privacidade; ADR ou decisão de domínio. | Bloqueia PLT-005 e FIS-001. | plataforma; “Resolva P-012 com cenários multiempresa e proíba compartilhamento implícito.” |

### 5.2 Fundação, arquitetura, infraestrutura e documentação

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e especificação técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-ARC-001 | Arquitetura / 00 | Crítica / M / ALTO | Definir módulos, referências permitidas, ownership de tabelas e contratos internos; produzir ADR-001 e testes de arquitetura. Fora: serviços de rede entre módulos. | DISC-008; paralelo a ARC-003; bloqueia scaffolds de domínio. | Diagrama e regras não cíclicas; teste falha para referência proibida. Testes: U/arquitetura. | arquitetura; “Implemente NUC-ARC-001: limites modulares, ADR e teste automatizado de dependências.” |
| NUC-ARC-002 | Arquitetura / 00 | Crítica / M / CRÍTICO | Definir resolução confiável de Organization/Workspace, filtros/constraints, contexto em jobs e modelo de teste de isolamento; ADR-002. | DISC-012, ARC-001; bloqueia PLT/IAM e persistência. | ID do cliente nunca define sozinho o tenant; cenários API/job/arquivo cruzados são negados. Testes: U/I/SEC. | arquitetura; “Implemente a decisão de tenancy e seu harness de isolamento conforme NUC-ARC-002.” |
| NUC-ARC-003 | Arquitetura / 00 | Alta / M / ALTO | Definir REST/versionamento, Problem Details, validação, paginação, filtros, correlation ID, idempotency key e OpenAPI; ADR-004. | DISC-008; paralelo a ARC-001/002. | Contrato de exemplo validado; erros não expõem internals; contract test no pipeline. Testes: API/contrato. | api; “Crie os padrões de contrato HTTP e testes de conformidade de NUC-ARC-003.” |
| NUC-ENG-001 | Infraestrutura / 01 | Crítica / L / MÉDIO | Criar solução .NET 10 com API, worker, módulos/shared mínimos e testes; frontend React/TS; configuração central, nullable/analyzers/formatters. | ARC-001/003, DISC-008; bloqueia desenvolvimento. | Clone limpo compila e sobe; health endpoints; zero segredo; versões fixadas. Testes: build/U/smoke. | engenharia; “Scaffolde NUC-ENG-001 respeitando ADRs, sem implementar negócio.” |
| NUC-ENG-002 | Infraestrutura / 01 | Crítica / M / ALTO | Configurar PostgreSQL, EF/Npgsql, convenções UTC/decimal/moeda, migrations por módulo e banco de teste descartável. | ENG-001, ARC-002; paralelo a FE-001. | Migration inicial aplica/reverte em banco descartável; constraints tenant e convenções verificadas. Testes: I/DB. | dados; “Implemente a fundação de persistência e testes de migrations de NUC-ENG-002.” |
| NUC-FE-001 | Feature / 01 | Alta / L / MÉDIO | Criar shell responsivo, rotas, layouts, design tokens, estados loading/empty/error/forbidden/offline e indicação persistente de workspace. | DISC-008, ENG-001; paralelo a ENG-002/JOB-001. | Navegação por teclado e contraste básicos; estados demonstráveis; nenhum dado cru em erro. Testes: C/A11Y. | frontend; “Implemente o shell e design system inicial conforme NUC-FE-001.” |
| NUC-JOB-001 | Infraestrutura / 01 | Crítica / L / CRÍTICO | Integrar Hangfire/PostgreSQL, filas por carga, envelope mínimo, revalidação de política, retries/backoff, cancelamento e inbox/outbox; restringir dashboard. | ENG-002, ARC-002; bloqueia integrações/workflows. | Reinício preserva job; revogação pré-execução bloqueia; duplicata não repete efeito de teste. Testes: I/SEC/resiliência. | jobs; “Implemente NUC-JOB-001 e ADR-005 com jobs duráveis e política revalidada.” |
| NUC-OBS-001 | Infraestrutura / 01 | Crítica / M / MÉDIO | Logs estruturados, redaction, correlation/request/run IDs, métricas base, tracing útil e health/readiness para API/worker/DB/jobs. | ENG-001; paralelo a ENG-002. | Webhook/job/request correlacionáveis; segredos/PII ausentes; alerta de falha persistente testável. Testes: I/OPS. | observabilidade; “Adicione baseline observável de NUC-OBS-001 e valide redaction.” |
| NUC-CI-001 | Infraestrutura / 01 | Crítica / M / MÉDIO | Pipeline: restore, format, lint, analyzers, U/I, frontend, build, scans, imagens versionadas e artefatos; política de PR. | ENG-001/002; paralelo a OBS-001. | Falha bloqueia merge; build reproduzível; SBOM/scan arquivado sem credenciais. Testes: execução CI. | entrega-continua; “Implemente pipeline mínimo bloqueante de NUC-CI-001.” |
| NUC-INF-001 | Infraestrutura / 01 | Alta / M / ALTO | Docker Compose local com API/worker/web/Postgres/Nginx, volumes mínimos, rede, limites e configuração de exemplo segura. | ENG/JOB/OBS; paralelo a CI-001. | Ambiente sobe por comando documentado; health passa; containers sem root quando viável. Testes: smoke/OPS. | infraestrutura; “Implemente ambiente local containerizado de NUC-INF-001.” |
| NUC-DOC-001 | Documentação / 00 | Alta / S / BAIXO | Definir índices/templates e validação de links para documentacoes e lessons, incluindo captura real de Git/diffs e justificativa sem lesson. | Nenhuma; paralelo a tudo; habilita entregas. | Template atende AGENTS.md; link checker detecta link quebrado; não inventa SHA. | transversal; “Crie a governança documental de NUC-DOC-001 sem conteúdo artificial.” |

### 5.3 Identidade, plataforma e tenancy

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-IAM-001 | Feature / 02 | Crítica / L / CRÍTICO | RF-009: login/logout, recuperação, convite, sessão/revogação e telas; aplicar ADR-003, rate limit e proteção contra enumeração. | DISC-008, ENG, PLT-001 schema; paralelo a IAM-004. | Sessão revogada falha imediatamente e job futuro não herda acesso; fluxo feliz/expirado/abuso. Testes: U/I/API/C/E2E/SEC. | identidade; “Implemente RF-009 conforme NUC-IAM-001 e ADR-003.” |
| NUC-IAM-002 | Feature / 02 | Crítica / L / CRÍTICO | RF-010: memberships, papéis e permissões por org/workspace/módulo/ação/escopo; policies backend e UI adaptativa, deny-by-default. | ARC-002, IAM-001, PLT-001; bloqueia todos os módulos. | Escalada horizontal/vertical retorna 403 e nada muda; UI oculta sem substituir backend. Testes: U/I/API/SEC. | identidade; “Implemente matriz RBAC e testes negativos de NUC-IAM-002.” |
| NUC-IAM-003 | Security / 02 | Alta / M / ALTO | RF-011: MFA para privilegiados/sensíveis, recuperação segura, step-up e gestão de fatores; tecnologia conforme ADR-003. | IAM-001; paralelo a IAM-002/004. | Admin sem MFA não conclui ação protegida; recovery invalida artefatos antigos; segredo não logado. Testes: API/E2E/SEC. | identidade; “Implemente MFA/step-up de NUC-IAM-003.” |
| NUC-IAM-004 | Feature / 02 | Crítica / M / ALTO | RF-012: audit event imutável logicamente com ator, tenant, ação, alvo, tempo, correlação, resultado e consulta autorizada; minimizar payload. | ENG-002, OBS-001; bloqueia ações sensíveis. | Ações humanas/agente/job produzem evento pesquisável; usuário não altera auditoria. Testes: U/I/API/SEC. | auditoria; “Implemente trilha auditável de NUC-IAM-004 sem armazenar segredos/prompts indiscriminados.” |
| NUC-IAM-005 | Feature / 14 | Alta / L / CRÍTICO | RF-013: políticas e fluxos de exportação, retenção, anonimização/exclusão e preferências; legal hold e registros preserváveis explícitos. | IAM-002/004, todos os domínios com dados, revisão jurídica. | Pedido autorizado gera relatório; exclusão não apaga obrigação preservada e não vaza tenant. Testes: I/API/E2E/SEC/OPS. | privacidade; “Implemente direitos e retenção de NUC-IAM-005 conforme política aprovada.” |
| NUC-PLT-001 | Feature / 02 | Crítica / L / CRÍTICO | RF-001: CRUD, seleção e arquivamento de Organization/Workspace; contexto no frontend/backend e bloqueio de novas execuções sem apagar histórico. | ARC-002, ENG-002; necessário a IAM-001/002. | Dois workspaces homônimos não cruzam dados; arquivado bloqueia escrita/job e permite histórico autorizado. Testes: U/I/API/C/E2E/SEC. | plataforma; “Implemente ciclo de organização/workspace de NUC-PLT-001.” |
| NUC-PLT-002 | Feature / 02 | Alta / M / ALTO | RF-002/003: catálogo de módulos, entitlement, dependências, ativação por workspace e templates infoproduto/conteúdo/serviço/personalizado como configuração editável idempotente. | PLT-001, IAM-002; paralelo a PLT-003. | Módulo sem direito não ativa via UI/API; reaplicar template não duplica; dependência é explicada. Testes: U/I/API/C. | plataforma; “Implemente módulos e templates conforme NUC-PLT-002.” |
| NUC-PLT-003 | Feature / 14 | Alta / L / ALTO | RF-004/005: white label versionado, preview/contraste, login/notificações/docs; domínio com challenge de propriedade, associação única, TLS e revogação. | PLT-001/002, INF-002; paralelo a PLT-004. | Branding não vaza; domínio não verificado não serve org; remoção revoga roteamento. Testes: I/API/C/E2E/SEC/A11Y. | plataforma; “Implemente branding e domínio customizado de NUC-PLT-003.” |
| NUC-PLT-004 | Feature / 14 | Alta / L / ALTO | RF-006/008: admin global, saúde, limites, planos/entitlements, consumo e estados de assinatura; cobrança só conforme DISC-009. Acesso de suporte temporário/auditável. | PLT-002, IAM-003/004, DISC-009; paralelo a PLT-003. | Plano limita sem excluir dados; suporte exige justificativa/expiração; estado de assinatura reproduzível. Testes: U/I/API/E2E/SEC. | plataforma; “Implemente administração e direitos comerciais de NUC-PLT-004, respeitando P-009.” |
| NUC-PLT-005 | Feature / 14 | Alta / M / CRÍTICO | RF-007: visão consolidada apenas de workspaces autorizados, com moeda/período/timezone declarados e drill-down da composição. | DISC-012, IAM-002, EXE-001/FIN-005; paralelo a PLT-003. | Revogar um workspace o remove da consulta; moedas não são somadas sem regra; total explica componentes. Testes: U/I/API/E2E/SEC. | plataforma; “Implemente consolidação autorizada de NUC-PLT-005.” |

### 5.4 Integração Hotmart e domínio comercial

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-INT-001 | Feature / 03 | Crítica / M / ALTO | RF-014: central de conexões multi-conta por workspace, credenciais protegidas, capability flags, status, owner, escopo, sync e revogação. | DISC-001, PLT/IAM, secret store; bloqueia INT-002–005. | Conexão de outro workspace é inacessível; revogada impede job posterior; segredo nunca retorna. Testes: I/API/C/SEC. | integracoes; “Implemente central de conexões e adaptador-capability de NUC-INT-001.” |
| NUC-INT-002 | Feature / 03 | Crítica / L / CRÍTICO | RF-015: endpoint webhook Hotmart, validação/autenticidade conforme capacidade, limite de payload, persistência do receipt antes de enqueue e resposta contratual. | INT-001, JOB/OBS; bloqueia INT-003. | Inválido rejeitado; válido persiste antes do ack; conexão correta resolvida sem confiar em workspace do payload. Testes: I/API/SEC/carga. | integracoes; “Implemente ingestão durável de webhook de NUC-INT-002 conforme matriz Hotmart.” |
| NUC-INT-003 | Feature / 03 | Crítica / L / CRÍTICO | RF-016: inbox processor idempotente, versionamento/mapeamento, ordem lógica, state transition guards, retries e reconciliação. | INT-002, COM schemas; bloqueia métricas. | Mesmo evento N vezes gera um efeito; antigo não regride; crash/restart recupera. Testes: U/I/contrato/resiliência. | integracoes; “Implemente processamento idempotente e ordenado de NUC-INT-003.” |
| NUC-INT-004 | Feature / 04 | Alta / L / ALTO | RF-017: importação/sync histórica com período, preview, paginação/rate limit, progresso confiável, cancelamento, resumo e divergências. | INT-001/003, DISC-001; paralelo a CRM-004. | Sobreposição import+webhook não duplica compra; campos/limites ausentes explícitos; execução retomável. Testes: U/I/API/E2E/PERF. | integracoes; “Implemente importação histórica e reconciliação de NUC-INT-004.” |
| NUC-INT-005 | Feature / 03 | Crítica / L / ALTO | RF-018: anti-corruption layer para produtos, compradores, compras e acesso/matrícula somente quando disponível; external identity por provider+connection+ID. | COM-001/002 schemas, DISC-001; paralelo a INT-003 após contratos. | Campo ausente fica desconhecido; compra ≠ acesso; mesma ID em conexões distintas não colide. Testes: U/I/contrato. | comercial; “Implemente mapeamentos Hotmart de NUC-INT-005 sem inventar semântica.” |
| NUC-INT-006 | Feature / 04 | Alta / M / ALTO | RF-019: central de receipts/syncs falhos, causa/tentativas, replay autorizado, dead-letter lógica e resolução; manter vínculo original. | INT-002–004, IAM-002/004; paralelo a CRM. | Replay não cria novo evento lógico; permanente não entra em loop; resolução auditada. Testes: I/API/C/E2E/SEC. | integracoes; “Implemente central de falhas e replay de NUC-INT-006.” |
| NUC-COM-001 | Feature / 03 | Alta / L / ALTO | RF-020/021: catálogo local de Product/Offer/Brand/Material, referências externas, versões e origem imported/internal; combos/bônus/cupons/order bump como gerenciais/capabilities. | PLT-001, INT-001; paralelo a COM-002 após schema. | Operação não suportada não aparece executável; mudança preserva histórico; unicidade inclui conexão. Testes: U/I/API/C. | comercial; “Implemente catálogo e ofertas de NUC-COM-001.” |
| NUC-COM-002 | Feature / 03 | Crítica / L / CRÍTICO | RF-022: Purchase, parcelas, fees, commissions, refund e chargeback com timeline imutável, decimal/moeda e transições mapeadas. | COM-001, DISC-001, ENG-002; bloqueia FIN. | Reembolso não apaga venda; soma e estado rastreiam evento; ordem inválida não corrompe. Testes: U/domínio/I/API. | comercial; “Implemente ciclo comercial e histórico de NUC-COM-002.” |
| NUC-COM-003 | Feature / 04 | Alta / M / ALTO | RF-023: consultas paginadas e indicadores por período/produto/oferta/marca/origem, distinguindo bruto, líquido estimado, recebido e resultado. | COM-002, INT-003; paralelo a CRM. | Cada métrica exibe definição/fonte/atualização e drill-down; p95 medido. Testes: U/I/API/C/PERF. | comercial; “Implemente indicadores comerciais explicáveis de NUC-COM-003.” |

### 5.5 CRM e financeiro

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-CRM-001 | Feature / 04 | Alta / L / CRÍTICO | RF-036: Contact por workspace, múltiplas compras/classificações e timeline; identidade não baseada apenas em e-mail. | INT-005, PLT; bloqueia CRM-002/003. | Contatos iguais em tenants distintos ficam isolados; compra associa sem fundir pessoa. Testes: U/I/API/SEC. | relacionamento; “Implemente base de contatos e timeline de NUC-CRM-001.” |
| NUC-CRM-002 | Feature / 04 | Alta / L / CRÍTICO | RF-037: regras de dedup, matches candidatos, merge explícito, sobrevivência de identities e histórico; opção de desfazer quando seguro. | CRM-001; paralelo a CRM-003. | Match ambíguo não auto-mescla; merge preserva IDs/eventos e é auditado. Testes: U/I/API/E2E. | relacionamento; “Implemente deduplicação controlada de NUC-CRM-002.” |
| NUC-CRM-003 | Feature / 04 | Alta / M / ALTO | RF-038: origem, tags, interesses, segmentos salvos/dinâmicos e timeline filtrável. | CRM-001; paralelo a CRM-002/004. | Cliente pode manter interesse distinto por produto; segmento explica critérios e contagem. Testes: U/I/API/C. | relacionamento; “Implemente classificação e segmentos de NUC-CRM-003.” |
| NUC-CRM-004 | Feature / 04 | Alta / L / ALTO | RF-039: cadastro manual, importação preview/erros/idempotência e formulário de captura com antifraude/rate limit/consentimento. | CRM-001, JOB, storage; paralelo a INT-004. | Duplicata de arquivo não duplica; erro por linha; abuso limitado; origem registrada. Testes: U/I/API/E2E/SEC/PERF. | relacionamento; “Implemente entradas e importação de contatos de NUC-CRM-004.” |
| NUC-CRM-005 | Feature / 09 | Crítica / M / CRÍTICO | RF-040: preferências por canal/finalidade, base legal configurada, suppressions e unsubscribe; rechecagem no envio. | CRM-001, revisão jurídica; bloqueia CRM-006. | Descadastro após agendamento impede envio; preferência auditada e scoped. Testes: U/I/API/E2E/SEC. | privacidade; “Implemente consentimento e supressão de NUC-CRM-005.” |
| NUC-CRM-006 | Feature / 09 | Alta / L / ALTO | RF-041: audiência preview, exclusões, templates mínimos e adaptador do canal definido em DISC-006; status/webhooks/rate limit. Fora: recuperação de venda. | DISC-006, CRM-003/005; paralelo a SUP-001. | Preview = envio elegível; bounce/unsubscribe atualiza estado; limites respeitados. Testes: I/contrato/API/E2E. | relacionamento; “Implemente comunicação segmentada de NUC-CRM-006, excluindo recuperação de vendas.” |
| NUC-FIN-001 | Feature / 05 | Crítica / L / CRÍTICO | RF-024: FinancialAccount, moeda, saldo inicial/ajustes, categorias e centros de custo com histórico e permissões. | DISC-007, PLT/IAM; bloqueia FIN-002+. | Ajuste não reescreve saldo inicial; totais decimais reproduzíveis; moeda obrigatória. Testes: U/domínio/I/API. | financeiro; “Implemente cadastros e invariantes financeiros de NUC-FIN-001.” |
| NUC-FIN-002 | Feature / 05 | Crítica / L / CRÍTICO | RF-025: payable/receivable, recorrência idempotente, vencimento por data, baixas parciais, cancelamento e histórico. | FIN-001, JOB; paralelo a FIN-003. | Reexecutar recorrência não duplica; baixa parcial mantém aberto; cancelamento preserva eventos. Testes: U/I/API/E2E. | financeiro; “Implemente contas a pagar/receber e recorrência de NUC-FIN-002.” |
| NUC-FIN-003 | Feature / 05 | Alta / L / ALTO | RF-026: entrada manual e import CSV/XLSX com upload seguro, mapping preview, locale, erros por linha, fingerprint e commit atômico/parcelado explícito. | FIN-001, storage; paralelo a FIN-002. | Arquivo repetido alerta/impede duplicata; erro não some; valores/datas usam layout escolhido. Testes: U/I/API/E2E/SEC. | financeiro; “Implemente importação financeira segura de NUC-FIN-003.” |
| NUC-FIN-004 | Feature / 05 | Crítica / L / CRÍTICO | RF-027: conciliar venda/recebível/settlement, sugestões determinísticas, divergências e resolução auditada; nunca inferir liquidação pela aprovação. | COM-002, FIN-001/002; bloqueia fechamento. | Cenário parcelado+taxa+reembolso+parcial fecha reproduzivelmente; ambíguo pede revisão. Testes: U/domínio/I/E2E. | financeiro; “Implemente reconciliação de NUC-FIN-004 com casos numéricos aprovados.” |
| NUC-FIN-005 | Feature / 06 | Crítica / L / CRÍTICO | RF-028: fluxo de caixa, resultado por regime/produto, orçamento, fechamento/reabertura e drill-down; regras versionadas. | FIN-002–004, DISC-007; bloqueia EXE. | F-03 passa; reabrir exige motivo e preserva snapshot/trilha; cálculo liga às origens. Testes: U/I/API/E2E/PERF. | financeiro; “Implemente relatórios e fechamento de NUC-FIN-005.” |
| NUC-FIN-006 | Feature / 06 | Alta / M / ALTO | RF-029: cenários de preço/conversão/custo/taxa/reembolso com premissas versionadas, comparação e rótulo de projeção. | FIN-005; paralelo a FIN-007/008. | Alterar premissa não muda realizado; cenário mostra fórmula/unidade; arredondamento testado. Testes: U/C/E2E. | financeiro; “Implemente projeções e simulador de NUC-FIN-006.” |
| NUC-FIN-007 | Feature / 13 | Média / M / ALTO | RF-030: sugestões IA de classificação/explicação/anomalia com fonte, confiança, provider/custo e aprovação; sem escrita protegida automática. | AI-005/008/009, FIN-001/005; paralelo a EXE-002. | Falha de IA não bloqueia financeiro; sugestão rejeitável e não altera dado sem política. Testes: U/I/eval/SEC. | financeiro; “Implemente assistência financeira governada de NUC-FIN-007.” |
| NUC-FIN-008 | Feature / 06 | Alta / M / ALTO | RF-031: comprovantes/anexos, download temporário autorizado, export e papel da contabilidade. | FIN-001–005, storage, IAM. | URL expira; outro tenant/role não acessa; export registra filtros/autor. Testes: I/API/E2E/SEC. | financeiro; “Implemente anexos e acesso contábil de NUC-FIN-008.” |

### 5.6 Fiscal

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-FIS-001 | Feature / 06 | Crítica / L / CRÍTICO | RF-032: perfil de emissor/estabelecimento e regras fiscais parametrizadas, versionadas e aprovadas; validações do provedor e bloqueio de produção até aprovação. | DISC-002/012, IAM, PLT; bloqueia emissão. | Config incompleta não habilita produção; aprovação contábil, autor e versão rastreáveis. Testes: U/I/API/SEC. | fiscal; “Implemente perfil fiscal validado de NUC-FIS-001 sem inferir tributação.” |
| NUC-FIS-002 | Feature / 06 | Crítica / L / CRÍTICO | RF-033: adapter fiscal, FiscalDocument/FiscalAttempt, payload determinístico, idempotência quando suportada, consulta pós-timeout, arquivos e estados. | FIS-001, COM-002, JOB, approvals; bloqueia FIS-003/004. | Timeout após envio consulta antes de repetir; identidade externa e tentativas separadas; F-04 feliz passa. Testes: U/I/contrato/E2E/resiliência. | fiscal; “Implemente emissão fiscal idempotente/reconciliável de NUC-FIS-002.” |
| NUC-FIS-003 | Feature / 06 | Alta / M / CRÍTICO | RF-034: rejeição, correção, cancelamento e operações somente se capability permitir, com prazos/permissões; reembolso não cancela automaticamente. | FIS-002, DISC-002; paralelo a FIS-004. | Operação indisponível não aparece; rejeição mostra motivo/ação; cancelamento exige policy/auditoria. Testes: U/I/API/E2E/SEC. | fiscal; “Implemente exceções fiscais de NUC-FIS-003 conforme capacidades confirmadas.” |
| NUC-FIS-004 | Feature / 06 | Alta / M / ALTO | RF-035: fila fiscal, filtros, detalhes, pendência/falha/conclusão distintas, export contábil e reconciliação manual autorizada. | FIS-002, IAM; paralelo a FIS-003. | Fila nunca mostra desconhecido como sucesso; export rastreável; operador resolve exceção com trilha. Testes: I/API/C/E2E. | fiscal; “Implemente central fiscal e export de NUC-FIS-004.” |

### 5.7 Agentes, conhecimento e workflows

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-AI-001 | Feature / 07 | Alta / M / ALTO | RF-071: catálogo de modelos/provedores e AgentTemplate/AgentInstance por workspace, configuração versionada e capability flags. | DISC-003, PLT/IAM; bloqueia demais AI. | Trocar default não altera instância existente; configuração/segredo isolados. Testes: U/I/API/SEC. | agentes; “Implemente catálogo e instâncias versionadas de NUC-AI-001.” |
| NUC-AI-002 | Feature / 07 | Alta / M / ALTO | RF-072: organograma e ficha de função com objetivo, responsabilidades, tools, knowledge, limites e handoffs; cargo não concede policy. | AI-001, IAM-002; paralelo a AI-004. | “CTO” sem grant não acessa deploy; organograma reflete vínculos, não autorização. Testes: U/API/C/SEC. | agentes; “Implemente funções e organograma sem privilégios implícitos conforme NUC-AI-002.” |
| NUC-AI-003 | Feature / 07 | Alta / L / ALTO | RF-073: chat por agente com conversa, tarefa/entrega, streaming/cancelamento, fontes e status; instrução efêmera não persiste como regra. | AI-001/002, JOB/OBS; paralelo a AI-004. | Mensagem liga à tarefa/run; cancelar não corrompe; memória permanente requer ação autorizada. Testes: I/API/C/E2E. | agentes; “Implemente chat vinculado a trabalho de NUC-AI-003.” |
| NUC-AI-004 | Feature / 07 | Crítica / L / CRÍTICO | RF-074: KnowledgeSource/Version, ingestão, chunk/index/metadata scoped, validade/revogação, citações e autorização na recuperação. | DISC-003/004, ARC-002, storage; bloqueia SUP/AI-005. | Documento revogado não recupera; prompt de tenant A não acha B; resposta cita versão. Testes: U/I/eval/SEC. | conhecimento; “Implemente base de conhecimento isolada e versionada de NUC-AI-004.” |
| NUC-AI-005 | Security / 07 | Crítica / L / CRÍTICO | RF-075: ToolGrant e policy server-side para consultar/recomendar/preparar/aprovar/executar, schemas, risk class, step/time limits, injection defenses e approval hooks. | AI-001/004, IAM/WFL-004; bloqueia tools reais. | Prompt não amplia grant; conteúdo malicioso não executa; ação sensível sem approval é negada/auditada. Testes: U/I/eval/SEC/adversarial. | agentes; “Implemente governança de ferramentas e autonomia de NUC-AI-005.” |
| NUC-AI-006 | Feature / 08 | Alta / L / CRÍTICO | RF-076: delegação entre agentes com escopo, budget, depth, deadline, completion contract e propagação restritiva de grants. | AI-003/005, WFL-001/003; paralelo a AI-007. | Delegado nunca ganha privilégio/orçamento; ciclo/profundidade interrompido; resultado liga à tarefa mãe. Testes: U/I/eval/SEC. | agentes; “Implemente delegação restritiva de NUC-AI-006.” |
| NUC-AI-007 | Feature / 08 | Alta / M / ALTO | RF-077: monitor de estados reais, ações/fontes/resultados, filtros e live update; sem exibir chain-of-thought ou simular atividade. | AI-003, OBS, WFL-003; paralelo a AI-006/008. | Estado deriva de run persistido; refresh não duplica; detalhes respeitam permissão. Testes: I/API/C/E2E/SEC. | agentes; “Implemente monitor operacional de agentes de NUC-AI-007.” |
| NUC-AI-008 | Feature / 07 | Crítica / M / CRÍTICO | RF-078: UsageRecord e budgets por tenant/agente/tarefa/campanha, preflight, reserva/ajuste, custo desconhecido e bloqueio seguro. | AI-001, FIN conventions; bloqueia autonomia. | Limite impede nova chamada sem corromper run; custo desconhecido não vira zero; concorrência não ultrapassa silenciosamente. Testes: U/I/PERF. | agentes; “Implemente medição e limites de custo de NUC-AI-008.” |
| NUC-AI-009 | Quality / 08 | Crítica / L / CRÍTICO | RF-079: datasets/evals para fidelidade, citações, injection, tool choice, isolamento, custo e regressão; versionar prompt/model/config e rollout/rollback. | AI-003–008; bloqueia autonomia ampliada. | Comparação reproduzível; regressão crítica bloqueia rollout; versão anterior restaurável. Testes: eval/SEC/PERF. | agentes; “Implemente harness e gates de avaliação de NUC-AI-009.” |
| NUC-WFL-001 | Feature / 08 | Alta / L / ALTO | RF-080: Project/Task/Goal, humano/agente responsável, prazos, dependências, origem, entregas e bloqueios; UI quadro/lista. | PLT/IAM, AI-001; bloqueia workflows/delegação. | Ciclo de dependência impedido; tarefa mostra upstream/downstream e origem. Testes: U/I/API/C. | operacao; “Implemente projetos e tarefas rastreáveis de NUC-WFL-001.” |
| NUC-WFL-002 | Feature / 08 | Alta / L / ALTO | RF-081: editor visual de trigger/condition/step/approval/action, schema/validation, drafts e WorkflowVersion imutável publicada. | WFL-001, AI-005; paralelo a WFL-004. | Inválido não ativa; edição cria versão; run antigo usa versão original. Testes: U/API/C/E2E. | automacoes; “Implemente designer e versionamento de fluxos de NUC-WFL-002.” |
| NUC-WFL-003 | Feature / 08 | Crítica / L / CRÍTICO | RF-082: runtime durável, StepRun, timers, retries limitados, timeout, cancel/continue, unknown result e recovery após worker restart. | JOB-001, WFL-002; bloqueia ações compostas. | Reinício recupera estado; efeito externo não repete cegamente; falha permanente para exceção. Testes: U/I/resiliência/chaos. | automacoes; “Implemente runtime durável e recuperável de NUC-WFL-003.” |
| NUC-WFL-004 | Feature / 08 | Crítica / L / CRÍTICO | RF-083: inbox única de ApprovalRequest com ação exata, versão/config, tenant, destino, conteúdo, custo, expiração e decisão auditada; revalidar no execute. | IAM-002/003/004, WFL-001; bloqueia AI tools/fiscal/publicação. | Aprovar v1 não autoriza v2; expirada/revogada não executa; aprovador sem policy recebe 403. Testes: U/I/API/E2E/SEC. | aprovacoes; “Implemente aprovação vinculada e expirada de NUC-WFL-004.” |
| NUC-WFL-005 | Feature / 08 | Crítica / M / ALTO | RF-084: ExceptionCase, fila, owner, resolução e pausa por connection/module/workspace/workflow, classificando ações em curso. | WFL-003/004, OBS; paralelo a WFL-006. | Pausa bloqueia novos efeitos e mostra os in-flight; retomada seletiva não repete concluídos. Testes: I/API/E2E/resiliência. | operacao; “Implemente central de exceções e pausa de NUC-WFL-005.” |
| NUC-WFL-006 | Feature / 08 | Alta / M / ALTO | RF-085: simulation mode com adapters de escrita bloqueados, fixtures/respostas simuladas rotuladas e relatório de passos/custos estimados. | WFL-002/003, AI-005; paralelo a WFL-005. | Nenhuma chamada externa de escrita ocorre; relatório distingue simulado/real; mesma versão executável após aprovação. Testes: I/E2E/SEC. | automacoes; “Implemente simulação sem efeitos reais de NUC-WFL-006.” |

### 5.8 Marketing e atendimento

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-MKT-001 | Feature / 09 | Alta / M / ALTO | RF-042: BrandKit versionado com audiência, tom, fontes, cores, logos, exemplos/restrições e preview; assets por URL autorizada. | PLT, storage; bloqueia conteúdo. | Versão antiga permanece em peça publicada; contraste/asset inválido sinalizado. Testes: U/API/C/A11Y. | marketing; “Implemente brand kit versionado de NUC-MKT-001.” |
| NUC-MKT-002 | Feature / 09 | Alta / L / ALTO | RF-043: Campaign com objetivo, offer, budget, channels, schedule e vínculos a costs/assets/tasks/metrics. | MKT-001, FIN, WFL-001; bloqueia F-06. | Limite financeiro validado; campanha explica itens e resultado; estado auditado. Testes: U/I/API/C/E2E. | marketing; “Implemente campanhas integradas de NUC-MKT-002.” |
| NUC-MKT-003 | Feature / 09 | Média / M / MÉDIO | RF-044: funil, página e e-mail como CampaignAsset; se P-010 decidir referência, guardar URL/version/owner; se construtor, replanejar antes. | DISC-010, MKT-002; paralelo a CRM-006. | UI não promete edição/publicação ausente; ativo liga à campanha e versão. Testes: U/API/C. | marketing; “Implemente somente a capacidade aprovada em P-010 para NUC-MKT-003.” |
| NUC-MKT-004 | Feature / 13 | Alta / L / CRÍTICO | RF-045: adapter de ads para métricas e mudanças suportadas, account binding, spend guard, approval, idempotência/reconciliation e audit. | DISC-005, MKT-002, WFL-004, AI-005. | Conta/limite/permissão revalidados; gasto acima do limite negado; unknown result reconciliado. Testes: I/contrato/E2E/SEC. | marketing; “Implemente anúncios governados de NUC-MKT-004 conforme capabilities.” |
| NUC-MKT-005 | Feature / 13 | Alta / M / ALTO | RF-046: Experiment com hipótese, variantes, período, métricas, attribution coverage/uncertainty e conclusão; não afirmar causalidade indevida. | MKT-002, PUB-005; paralelo a MKT-004. | Relatório explicita janela/fonte/limitação; variante imutável após início. Testes: U/I/API/C. | marketing; “Implemente experimentos e atribuição transparente de NUC-MKT-005.” |
| NUC-SUP-001 | Feature / 09 | Alta / L / ALTO | RF-067: Ticket/Conversation/Message/Assignment, entrada manual e canais decididos, contato/produto, status e histórico. | DISC-006, CRM/COM; paralelo a MKT. | Caso do canal associa sem auto-mescla ambígua; histórico/owner/status visíveis. Testes: I/API/C/E2E. | atendimento; “Implemente registro multicanal de atendimento de NUC-SUP-001.” |
| NUC-SUP-002 | Feature / 09 | Alta / L / CRÍTICO | RF-068: sugestão de resposta baseada em KnowledgeVersion/policies, citações, limites de escopo e handoff; envio conforme grant. | AI-004/005/009, SUP-001; bloqueia automação. | Sem fonte ou fora de escopo escala; não inventa acesso/preço; resposta respeita tenant. Testes: eval/I/E2E/SEC. | atendimento; “Implemente respostas assistidas e citadas de NUC-SUP-002.” |
| NUC-SUP-003 | Feature / 09 | Alta / M / ALTO | RF-069: prioridades, prazos internos, escalonamento, owner e integração ExceptionCase; alertas deduplicados. | SUP-001, WFL-005; paralelo a SUP-002. | Caso bloqueado cria exceção com próximo responsável; prazo interno é explícito. Testes: U/I/API/E2E. | atendimento; “Implemente escalonamento operacional de NUC-SUP-003.” |
| NUC-SUP-004 | Feature / 13 | Média / M / ALTO | RF-070: agrupar dúvidas e sugerir melhorias citando tickets/mensagens autorizados; revisão humana e ausência acadêmica explícita. | SUP-001/002, AI-009; paralelo a EXE-002. | Insight liga a evidência e amostra; não infere conclusão de curso inexistente. Testes: U/eval/API/SEC. | atendimento; “Implemente insights educacionais baseados em evidência de NUC-SUP-004.” |

### 5.9 Biblioteca, vídeo e conteúdo estático

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-MED-001 | Feature / 10 | Crítica / L / CRÍTICO | RF-047: MediaAsset/documentos com upload multipart/direto escolhido, allowlist MIME, inspeção, size/duration, metadata, checksum, storage scoped, lifecycle e URL temporária. | DISC-004, PLT/IAM, ADR-006; bloqueia media/knowledge. | Arquivo inválido/malicioso rejeitado; tenant alheio não lê; duplicata explícita; disco DB protegido. Testes: I/API/E2E/SEC/PERF. | conteudo; “Implemente biblioteca e upload seguro de NUC-MED-001.” |
| NUC-MED-002 | Feature / 10 | Alta / L / ALTO | RF-048: transcription job/adaptador com timestamps, speaker quando suportado, versão original/editada e editor que salta para o trecho. | DISC-003, MED-001, JOB; bloqueia cortes. | Texto editado não destrói original; timestamp localiza mídia; falha retomável/custo registrado. Testes: I/contrato/C/E2E. | conteudo; “Implemente transcrição versionada de NUC-MED-002.” |
| NUC-MED-003 | Feature / 10 | Alta / L / ALTO | RF-049/050: ClipProposal por objetivo/assunto/contexto, start/end/title/rationale, revisão de limites, descarte e preview proxy sem full render. | MED-002, AI-009; paralelo a MED-004 após contratos. | Pode retornar menos cortes; limites válidos; ajuste não retranscreve/renderiza tudo. Testes: U/eval/C/E2E. | conteudo; “Implemente propostas e revisão de cortes de NUC-MED-003.” |
| NUC-MED-004 | Feature / 11 | Alta / L / ALTO | RF-051/052: compositions face/screen/both, focal override, captions editable/sync, brand, cover e safe areas por formato. | MED-003, MKT-001; bloqueia render final. | Controles de tela preserváveis por override; legenda editável; preview representa formato. Testes: U/C/E2E/visual/A11Y. | conteudo; “Implemente composição e legendas de NUC-MED-004.” |
| NUC-MED-005 | Infrastructure / 11 | Crítica / L / CRÍTICO | RF-053: RenderJob assíncrono/versionado, filas e limites CPU/RAM/concurrency/time, progresso somente mensurável, artifact/export e isolamento da API/DB. | DISC-004, JOB, MED-004, ADR-008. | Carga limite não derruba API; estado/erro/result acessível; artefato liga à versão. Testes: I/E2E/PERF/soak/OPS. | conteudo; “Implemente pipeline de renderização isolado de NUC-MED-005.” |
| NUC-MED-006 | Feature / 11 | Alta / M / ALTO | RF-054: cancelamento cooperativo, custo já incorrido, cleanup e regeneração apenas de etapa/elemento elegível. | MED-005; paralelo a CNT-001. | Cancelar impede próximas etapas; regeneration preserva aprovados; custo e limites visíveis. Testes: U/I/E2E/resiliência. | conteudo; “Implemente cancelamento e regeneração parcial de NUC-MED-006.” |
| NUC-CNT-001 | Feature / 11 | Alta / M / ALTO | RF-055: ContentItem iniciado por idea/brief/calendar/source, com objective/brand/audience/provenance e state machine. | MKT-001, MED-001, WFL; bloqueia peças. | Toda peça mantém origem/contexto; transição inválida negada; ausência de fonte explícita. Testes: U/I/API/C. | conteudo; “Implemente núcleo de conteúdo e estados de NUC-CNT-001.” |
| NUC-CNT-002 | Feature / 12 | Alta / L / ALTO | RF-056: projetos para post/carousel/story/cover/promo, rules/dimensions e export ordenado com validação por formato. | CNT-001, MKT-001; paralelo a CNT-003. | Carrossel exporta todos slides em ordem; dimensão inválida bloqueia aprovação/export. Testes: U/C/E2E/visual. | conteudo; “Implemente formatos estáticos de NUC-CNT-002.” |
| NUC-CNT-003 | Feature / 12 | Alta / L / CRÍTICO | RF-057: adapter de image generation com provider/request/version/cost, policy de direitos, moderation e artifact separado/editável. | DISC-003, AI-005/008/009, CNT-001. | Falha/recusa não corrompe projeto; custo/provedor rastreável; prompt não contém segredo. Testes: I/eval/SEC. | conteudo; “Implemente geração de imagens governada de NUC-CNT-003.” |
| NUC-CNT-004 | Feature / 12 | Alta / L / ALTO | RF-058: editor por camadas com text/price/logo/image/color/position, autosave/version e render consistente; correção textual sem regenerar fundo. | CNT-002/003; bloqueia templates/review. | Reabrir preserva camadas; mudar texto não chama IA; undo/version não altera aprovado. Testes: U/C/E2E/visual/PERF. | conteudo; “Implemente editor em camadas de NUC-CNT-004.” |
| NUC-CNT-005 | Feature / 12 | Alta / M / ALTO | RF-059: templates e variants por brand/campaign, schema/version/pinning e copy-on-use. | CNT-004, MKT-001. | Editar template não muda peça aprovada; incompatibilidade de versão explicada. Testes: U/I/C. | conteudo; “Implemente templates versionados de NUC-CNT-005.” |
| NUC-CNT-006 | Feature / 12 | Alta / L / ALTO | RF-060: ContentPackage derivado de video/aula/document, criando cortes/carousel/post/stories com provenance comum e review independente. | MED-003, CNT-002–005; paralelo a CNT-007. | Falha de item não apaga pacote; cada derivado liga à fonte e pode ter estado próprio. Testes: I/E2E/resiliência. | conteudo; “Implemente pacotes derivados resilientes de NUC-CNT-006.” |
| NUC-CNT-007 | Feature / 12 | Crítica / M / ALTO | RF-061: comments, version history, element regeneration e approval invalidation; versão aprovada imutável. | CNT-004/006, WFL-004; bloqueia publicação. | Alteração relevante cria versão pendente; aprovação antiga não vale; comentário liga à versão/elemento. Testes: U/I/API/C/E2E. | conteudo; “Implemente revisão/versionamento de NUC-CNT-007.” |

### 5.10 Calendário, publicação e inteligência executiva

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-PUB-001 | Feature / 13 | Alta / L / ALTO | RF-062: idea bank e calendar por brand/channel/project, objetivo, format, owner, due date e estado; filtros e timezone de exibição. | CNT-001, WFL-001; bloqueia scheduling. | Drag/update respeita permission; filtros reproduzíveis; estado liga à versão. Testes: U/API/C/E2E/A11Y. | publicacao; “Implemente banco de ideias e calendário de NUC-PUB-001.” |
| NUC-PUB-002 | Feature / 13 | Crítica / M / CRÍTICO | RF-063: PublicationSchedule com instante UTC+timezone, channel account, versão aprovada, preflight e revalidação antes de executar. | PUB-001, CNT-007, WFL-004, JOB. | Alteração pós-aprovação bloqueia/reaprova; DST testado; conta revogada impede envio. Testes: U/I/E2E/SEC. | publicacao; “Implemente agendamento seguro de NUC-PUB-002.” |
| NUC-PUB-003 | Feature / 13 | Crítica / L / CRÍTICO | RF-064: channel adapters confirmados, format/capability validation, publish autorizado e pacote/export manual como fallback. | DISC-005, PUB-002, AI-005. | Limitação da API vira fallback, não sucesso; conta/formato/permissão corretos; export íntegro. Testes: I/contrato/E2E/SEC. | publicacao; “Implemente publicação por capacidades reais de NUC-PUB-003.” |
| NUC-PUB-004 | Feature / 13 | Crítica / M / CRÍTICO | RF-065: PublicationAttempt, external ID/URL, confirmation, failure/unknown e reconciliation before retry. | PUB-003, WFL-005, OBS. | Resposta perdida consulta antes de retry; duplicata detectada; operador resolve unknown com audit. Testes: I/E2E/resiliência. | publicacao; “Implemente reconciliação de publicação de NUC-PUB-004.” |
| NUC-PUB-005 | Feature / 13 | Alta / M / ALTO | RF-066: metric snapshots por content/topic/format/campaign/channel, source/window/freshness e unknown distinto de zero. | DISC-005, PUB-003/004; paralelo a MKT-005. | Dado ausente não vira 0; snapshot não reescreve histórico; drill-down à fonte. Testes: U/I/API/C. | publicacao; “Implemente métricas versionadas de conteúdo de NUC-PUB-005.” |
| NUC-EXE-001 | Feature / 14 | Alta / L / CRÍTICO | RF-086: dashboard de negócio/operação/equipe IA/decisões, projections/read models, origem/freshness/drill-down e permissões. | COM/FIN/AI/WFL/PUB; paralelo a PLT-003/004. | Todo indicador explica fonte/tempo/escopo; cache não vaza tenant; empty ≠ zero. Testes: U/I/API/C/E2E/SEC/PERF. | executivo; “Implemente dashboard explicável de NUC-EXE-001.” |
| NUC-EXE-002 | Feature / 14 | Alta / L / CRÍTICO | RF-087: resumo diário e perguntas com retrieval autorizado, tipos fato/hipótese/projeção/ausência, citações e fallback determinístico. | EXE-001, AI-004/005/009; paralelo a FIN-007/SUP-004. | Falha de IA mantém dashboards; resposta cita registro; sem dado declara ausência. Testes: eval/I/E2E/SEC. | executivo; “Implemente resumo e Q&A governado de NUC-EXE-002.” |
| NUC-EXE-003 | Feature / 14 | Alta / M / ALTO | RF-088: alert rules de falha/divergência/vencimento/oportunidade, severity, action, dedup/snooze e channel preference. | OBS, FIN/WFL/CRM, DISC-006. | Repetição deduplica; alerta liga à ação/origem; canal desabilitado não envia. Testes: U/I/E2E. | executivo; “Implemente alertas acionáveis e deduplicados de NUC-EXE-003.” |
| NUC-EXE-004 | Feature / 14 | Alta / L / CRÍTICO | RF-089: relatórios e export jobs por workspace/consolidado, filtros/version, geração assíncrona, URL expirada e autorização na criação/download. | PLT-005, EXE-001, storage/JOB. | Revogação antes do download bloqueia; export registra componentes/filtros; tenant não cruza. Testes: I/API/E2E/SEC/PERF. | executivo; “Implemente relatórios e exports seguros de NUC-EXE-004.” |

### 5.11 Hardening, infraestrutura e operação

| ID | Tipo / Sprint | Pri. / Est. / Risco | Objetivo, escopo e técnica | Dependências / paralelo / bloqueios | Aceite e testes exigidos | Docs / Prompt |
| --- | --- | --- | --- | --- | --- | --- |
| NUC-INF-002 | Infrastructure / 15 | Crítica / L / CRÍTICO | Provisionar validação/produção em VPS: imagens imutáveis, Nginx/TLS, redes/volumes, secrets, DB/storage, limites, migrations expand/contract, promotion e rollback; produzir ADR-010. | DISC-011, INF-001, CI-001; bloqueia go-live. | Deploy de versão e rollback de app ensaiados; migration não depende de rollback destrutivo; painel Hangfire restrito. Testes: smoke/OPS/SEC. | infraestrutura; “Implemente ambientes e deploy seguro de NUC-INF-002 sem publicar antes da autorização.” |
| NUC-OBS-002 | Infrastructure / 15 | Crítica / M / ALTO | Dashboards e alertas acionáveis para latency/error/traffic/resources/DB/jobs/storage/cost/external failure; severity, threshold, owner e runbook. | OBS-001 e módulos; paralelo a INF-002. | Cada alerta é provocável em validação e liga a runbook; sem alerta por ruído sem ação. Testes: OPS/chaos. | observabilidade; “Implemente SLI, dashboards e alertas de NUC-OBS-002.” |
| NUC-SEC-001 | Security / 15 | Crítica / L / CRÍTICO | Atualizar threat model: authz, CSRF/XSS/SQLi/SSRF/CORS, brute force, secrets, uploads, dependencies/supply chain, admin, AI injection e backups; corrigir achados bloqueadores. | Produto integrado; pode iniciar no 00 e fechar no 15. | Testes negativos passam; scans sem crítico/alto não aceito; riscos residuais têm owner/decisão. Testes: SEC/SAST/DAST/dependency/manual. | seguranca; “Execute hardening e threat model final de NUC-SEC-001.” |
| NUC-QA-001 | Quality / 15 | Crítica / L / ALTO | Consolidar pirâmide e suites U/I/API/contract/C/E2E/SEC/PERF/A11Y/smoke, fixtures tenant-safe, testcontainers e quality gates; flakiness tratada. | Todos os módulos; paralelo a SEC-001. | Pipeline reproduzível, sem teste crítico flaky/quarentenado; cobertura por risco, não só percentual. | qualidade; “Consolide estratégia e gates automatizados de NUC-QA-001.” |
| NUC-QA-002 | Quality / 15 | Alta / M / ALTO | Auditoria de responsividade, teclado, foco, contraste, mensagens acionáveis e estados loading/empty/error/forbidden/disconnected/no-integration em todas as telas. | Features frontend; paralelo a QA-001. | WCAG alvo decidido e violações bloqueadoras corrigidas; matriz de telas/estados evidenciada. Testes: A11Y/C/E2E/manual. | qualidade; “Execute acessibilidade e estados UX de NUC-QA-002.” |
| NUC-REL-001 | Operations / 16 | Crítica / L / CRÍTICO | Backup de DB/files/config necessária fora da VPS, criptografia, retenção, monitoramento e restore em ambiente isolado segundo RPO/RTO. | DISC-011, INF-002; bloqueia go-live. | Restore real verifica vínculos/arquivos/jobs; tempo/perda medidos; falha de backup alerta. Testes: OPS/DR. | operacoes; “Implemente e ensaie backup/restore de NUC-REL-001.” |
| NUC-REL-002 | Quality / 15 | Crítica / L / CRÍTICO | Modelar e executar carga: consultas p95, contacts/sales/events, imports, jobs, IA e minutos de mídia; resource limits e capacity triggers. | Produto integrado, DISC-004/011; paralelo a SEC/QA. | p95 alvo medido sob cenário documentado; API permanece responsiva durante mídia; gargalos/limites registrados. Testes: PERF/load/soak. | desempenho; “Execute plano de capacidade e performance de NUC-REL-002.” |
| NUC-REL-003 | Quality / 16 | Crítica / L / CRÍTICO | Automatizar e demonstrar F-01–F-08 e 15 cenários críticos da especificação, incluindo isolamento, idempotência, unknown result, budget, restart e intervenção manual. | Todos os domínios; bloqueia go-live. | Cada fluxo tem evidência, dados esperados e cleanup; falha crítica impede release. Testes: E2E/SEC/resiliência/OPS. | qualidade; “Implemente suite integrada e evidências de NUC-REL-003.” |
| NUC-REL-004 | Operations / 16 | Crítica / L / CRÍTICO | Production readiness, import inicial ensaiado, DNS/TLS/secrets, migration, smoke, release notes, aprovação, deploy progressivo, rollback e incident ownership. | INF/OBS/SEC/QA/REL-001–003; bloqueia tráfego. | Checklist aprovado; deploy/rollback/smoke ensaiados; nenhuma ação externa sem autorização humana. Testes: OPS/smoke/E2E. | operacoes; “Prepare e execute somente quando autorizado o go-live de NUC-REL-004.” |
| NUC-REL-005 | Operations / 17 | Alta / M / ALTO | Hypercare e pós-lançamento: horas/dias/semanas, error/latency/auth/DB/jobs, ativação/fluxos, suporte, custo, feedback e criação de backlog para achados. | REL-004; bloqueia encerramento. | Rotina/owner/threshold definidos; achados viram tickets priorizados; revisão confirma estabilidade ou rollback. Testes: OPS e revisão de métricas. | operacoes; “Conduza pós-lançamento e gere backlog factual conforme NUC-REL-005.” |

## 6. Mapa de dependências e caminho crítico

~~~mermaid
flowchart TD
    DISC[DISC-001..012] --> ARC[ARC/ENG foundation]
    ARC --> IAM[IAM + PLT core]
    IAM --> INT[Hotmart + Comercial]
    INT --> CRM[CRM]
    INT --> FIN[Financeiro]
    FIN --> FIS[Fiscal]
    IAM --> AI[Agentes + conhecimento]
    AI --> WFL[Workflows + aprovações]
    WFL --> MKT[Marketing + atendimento]
    DISC --> MED[Mídia]
    AI --> MED
    MED --> CNT[Conteúdo estático]
    MKT --> CNT
    CNT --> PUB[Publicação]
    FIN --> EXE[Painel executivo]
    PUB --> EXE
    WFL --> EXE
    EXE --> HARD[Security/QA/Performance]
    FIS --> HARD
    PUB --> HARD
    HARD --> REL[Restore + release]
    REL --> POST[Pós-lançamento]
~~~

### Classificação

- **Foundation:** DISC-008/011/012, ARC-001–003, ENG-001/002, FE-001, JOB-001, OBS-001, CI-001, INF-001, DOC-001.
- **Blocking:** PLT-001, IAM-002, INT-001–003, COM-002, AI-004/005, WFL-003/004, MED-001/005, CNT-007, PUB-002–004, INF-002, REL-001–004.
- **Independent após fundação:** CRM e financeiro podem avançar em paralelo; marketing/atendimento podem avançar juntos; mídia pode avançar em paralelo ao workflow quando P-003/P-004 estiverem fechados.
- **Integration:** FIN-004/005, FIS-002, AI-006/009, CNT-006/007, PUB-004/005, EXE-001–004.
- **Finalization:** SEC-001, QA-001/002, REL-001–005.

### Caminho crítico recomendado

DISC-008 → ARC-001/002 → ENG-001/002 → PLT-001 + IAM-002 → JOB-001 → INT-001/002/003 → COM-002 → FIN-004/005 → WFL-004 → FIS-002 e PUB-002/003/004 → EXE-001 → SEC/QA/PERF → backup/restore → E2E integral → go-live.

Decisões externas acrescentam trilhas críticas condicionais: P-002 para fiscal, P-003/P-004 para IA/mídia, P-005 para publicação/anúncios e P-011 para produção.

## 7. Plano de sprints

Capacidade semanal/duração permanecem pendentes de decisão humana. Cada sprint abaixo é uma fila ordenada por dependência e um objetivo indivisível; no kickoff, entra somente o volume compatível com a capacidade observada, preservando a ordem. Ticket não concluído não é declarado entregue nem “compensado” por IA.

# SPRINT-00 — Descoberta bloqueadora e arquitetura

**Sprint Goal:** transformar riscos centrais em decisões verificáveis e estabelecer os limites do sistema.

**Prerequisites:** especificação aprovada como entrada; disponibilidade do proprietário e, para P-002/P-007, responsáveis fiscal/financeiro.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-DOC-001, NUC-DISC-008, NUC-DISC-011, NUC-DISC-012 | S/M/M/M | Em paralelo; decisões alimentam arquitetura. |
| 2 | NUC-DISC-001, NUC-DISC-002, NUC-DISC-007 | M/M/M | Externos e paralelos. |
| 3 | NUC-ARC-001, NUC-ARC-002, NUC-ARC-003 | M/M/M | ARC-002 usa P-012; demais parcialmente paralelos. |
| 4 | NUC-DISC-003–006, NUC-DISC-009/010 | M/L/S | Trilhas independentes; podem continuar como gates dos módulos. |

**Deliverables:** 12 relatórios de spike, ADRs iniciais, modelo de dependências e governança documental.  
**Exit criteria:** nenhuma decisão crítica aparece como fato sem evidência; ARC-001–003 aceitos; bloqueios restantes têm owner.  
**Demo scenario:** percorrer a matriz de capacidades e mostrar como tenant, contratos e providers serão decididos.  
**Risks:** indisponibilidade de contas/contabilidade; mitigar permitindo decisões parciais explicitamente bloqueadoras.

# SPRINT-01 — Fundação executável

**Sprint Goal:** obter solução local reproduzível com API, worker, web, banco, jobs, observabilidade e CI.

**Prerequisites:** DISC-008 e ADR-001/002/004 aceitos.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-ENG-001, NUC-FE-001 | L/L | FE inicia após contratos de workspace; paralelo parcial. |
| 2 | NUC-ENG-002, NUC-OBS-001 | M/M | Persistência bloqueia jobs; observabilidade paralela. |
| 3 | NUC-JOB-001 | L | Requer DB/tenancy. |
| 4 | NUC-CI-001, NUC-INF-001 | M/M | Paralelos após build funcional. |

**Deliverables:** containers locais, migration inicial, health checks, filas, logs e pipeline.  
**Exit criteria:** clone limpo compila, testa e sobe; reinício de job simples é recuperado; CI bloqueia falha.  
**Demo scenario:** subir stack, chamar health, enfileirar job de teste e correlacionar logs.  
**Risks:** incompatibilidade de versões; resolver pelo spike e lockfile, sem troca silenciosa de stack.

# SPRINT-02 — Tenancy, identidade e autorização

**Sprint Goal:** permitir uso humano seguro em organizações/workspaces isolados.

**Prerequisites:** SPRINT-01, ADR-003 e modelo jurídico mínimo de P-012.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-PLT-001 | L | Base de contexto para identidade. |
| 2 | NUC-IAM-001, NUC-IAM-004 | L/M | Paralelos após schema base. |
| 3 | NUC-IAM-002, NUC-IAM-003 | L/M | RBAC bloqueia módulos; MFA paralelo. |
| 4 | NUC-PLT-002 | M | Usa tenancy/RBAC. |

**Deliverables:** entrada, seleção de workspace, membership/RBAC/MFA, auditoria, módulos/templates.  
**Exit criteria:** testes de escalada e isolamento passam; arquivamento/revogação bloqueiam novas execuções.  
**Demo scenario:** criar dois workspaces, convidar com papéis diferentes e provar negações cruzadas.  
**Risks:** policy matrix incompleta; mitigar com deny-by-default e casos negativos antes de UI avançada.

# SPRINT-03 — Hotmart e núcleo comercial

**Sprint Goal:** receber uma venda de forma durável, idempotente e rastreável até catálogo/compra.

**Prerequisites:** DISC-001, PLT/IAM e JOB-001.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-INT-001, NUC-COM-001 | M/L | Contratos alinhados; implementação parcialmente paralela. |
| 2 | NUC-COM-002, NUC-INT-002 | L/L | Schemas comerciais antes do mapper final. |
| 3 | NUC-INT-005 | L | Usa contratos de produto/compra. |
| 4 | NUC-INT-003 | L | Fecha ingestão transacional. |

**Deliverables:** conexão, webhook, inbox, catálogo e timeline comercial.  
**Exit criteria:** evento repetido não duplica; evento antigo não regride; compra/acesso não confundidos.  
**Demo scenario:** enviar payload assinado, repetir e inverter ordem; observar uma compra e audit trail.  
**Risks:** capacidade Hotmart parcial; capability flags e fixtures oficiais evitam simulação como produção.

# SPRINT-04 — Importação, CRM e visibilidade comercial

**Sprint Goal:** importar histórico, resolver contatos e consultar vendas sem duplicação.

**Prerequisites:** SPRINT-03 e acesso histórico confirmado.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-CRM-001, NUC-CRM-003 | L/M | Contact antes de segmentos. |
| 2 | NUC-CRM-002, NUC-CRM-004 | L/L | Paralelos após Contact. |
| 3 | NUC-INT-004, NUC-INT-006 | L/M | Import/replay usam entidades prontas. |
| 4 | NUC-COM-003 | M | Read model após dados reconciliados. |

**Deliverables:** contatos/timeline/segmentos, import preview/progress, central de falhas e métricas comerciais.  
**Exit criteria:** histórico sobreposto a webhooks não duplica e match ambíguo não mescla.  
**Demo scenario:** importar janela sobreposta, corrigir linha/evento e filtrar receita com drill-down.  
**Risks:** volume desconhecido; paginação, checkpoints e teste de carga amostral são obrigatórios.

# SPRINT-05 — Financeiro operacional

**Sprint Goal:** registrar, importar e conciliar movimentos com cálculos reproduzíveis.

**Prerequisites:** DISC-007, COM-002 e convenções decimais.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-FIN-001 | L | Base do domínio. |
| 2 | NUC-FIN-002, NUC-FIN-003 | L/L | Paralelos após cadastros. |
| 3 | NUC-FIN-004 | L | Usa comercial e settlements. |

**Deliverables:** contas/categorias, payables/receivables/recorrência, import e conciliação.  
**Exit criteria:** cenário venda parcelada + taxa + reembolso + parcial fecha com divergências explícitas.  
**Demo scenario:** importar extrato, conciliar sugestões e resolver uma ambiguidade com auditoria.  
**Risks:** fórmulas não aprovadas; bloquear relatórios, não o cadastro operacional.

# SPRINT-06 — Fechamento financeiro e fiscal

**Sprint Goal:** fechar resultado gerencial e executar o fluxo fiscal em ambiente de validação.

**Prerequisites:** SPRINT-05, DISC-002/007/012, provedor/sandbox fiscal e aprovação contábil.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-FIN-005, NUC-FIN-008, NUC-FIS-001 | L/M/L | FIN-005 usa sprint anterior; perfil fiscal paralelo. |
| 2 | NUC-FIN-006, NUC-FIS-002 | M/L | Projeções e emissão em paralelo. |
| 3 | NUC-FIS-003, NUC-FIS-004 | M/M | Após adapter fiscal. |

**Deliverables:** fechamento/resultado/orçamento, projeções, anexos/export, emissão/fila fiscal.  
**Exit criteria:** F-03 e F-04 passam; timeout fiscal reconcilia antes de repetir.  
**Demo scenario:** fechar período, simular preço, emitir em sandbox, tratar rejeição e exportar.  
**Risks:** decisão fiscal externa; nada vai a produção sem validação contábil.

# SPRINT-07 — Conhecimento e agentes controlados

**Sprint Goal:** conversar com agentes que recuperam fontes isoladas, obedecem grants e respeitam orçamento.

**Prerequisites:** DISC-003/004, IAM/PLT e storage seguro.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-AI-001, NUC-AI-004 | M/L | Catálogo e conhecimento em paralelo parcial. |
| 2 | NUC-AI-002, NUC-AI-008 | M/M | Funções e budgets independentes. |
| 3 | NUC-AI-005 | L | Usa grants/knowledge/budget. |
| 4 | NUC-AI-003 | L | Chat usa runtime governado. |

**Deliverables:** catálogo/instâncias, organograma, knowledge versionado, tools/policies, usage e chat.  
**Exit criteria:** prompt injection não amplia acesso; budget interrompe chamada; fonte revogada não aparece.  
**Demo scenario:** agente responde com citação, recusa ferramenta proibida e para ao atingir orçamento.  
**Risks:** qualidade variável/custos; toda saída relevante mantém fonte/model/version/cost.

# SPRINT-08 — Projetos, workflows e coordenação

**Sprint Goal:** executar e recuperar processos versionados com aprovações e exceções.

**Prerequisites:** SPRINT-07 e JOB-001.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-WFL-001, NUC-WFL-004 | L/L | Modelo de tarefa e approval podem avançar juntos. |
| 2 | NUC-WFL-002 | L | Usa ações/policies. |
| 3 | NUC-WFL-003 | L | Runtime usa versão publicada. |
| 4 | NUC-WFL-005, NUC-WFL-006 | M/M | Exceção e simulação paralelas. |
| 5 | NUC-AI-006, NUC-AI-007, NUC-AI-009 | L/M/L | Após runtime; monitor/evals paralelos. |

**Deliverables:** projetos, designer/runtime, approval inbox, exception center, simulation, delegação, monitor e evals.  
**Exit criteria:** reinício recupera; aprovação v1 não autoriza v2; delegação não amplia privilégio.  
**Demo scenario:** simular fluxo, aprovar, executar, reiniciar worker, pausar e retomar sem efeito duplicado.  
**Risks:** sprint densa; preservar ordem e dividir por capacidade sem separar runtime de seus testes críticos.

# SPRINT-09 — Marketing, relacionamento e atendimento

**Sprint Goal:** planejar campanha, comunicar contatos elegíveis e operar atendimento assistido.

**Prerequisites:** DISC-006/010, CRM, FIN, AI e WFL.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-MKT-001, NUC-CRM-005, NUC-SUP-001 | M/M/L | Paralelos. |
| 2 | NUC-MKT-002, NUC-CRM-006, NUC-SUP-003 | L/L/M | Campaign usa brand/FIN; comunicação usa consent. |
| 3 | NUC-MKT-003, NUC-SUP-002 | M/L | Ativos e assistência paralelos. |

**Deliverables:** brand kit, campanhas/ativos, consentimento/envio e tickets/sugestões/escalonamento.  
**Exit criteria:** descadastro pós-agendamento bloqueia envio; resposta sem fonte escala; campanha respeita budget.  
**Demo scenario:** montar campanha, pré-visualizar audiência, enviar em sandbox e tratar retorno no atendimento.  
**Risks:** consentimento/reputação; revisão jurídica precede comunicação real.

# SPRINT-10 — Biblioteca, upload e transcrição

**Sprint Goal:** ingerir mídia de forma segura e obter transcrição/editável e propostas de cortes.

**Prerequisites:** DISC-003/004, storage, jobs e brand kit.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-MED-001 | L | Bloqueia todo o estúdio. |
| 2 | NUC-MED-002 | L | Transcrição usa asset validado. |
| 3 | NUC-MED-003 | L | Proposta/revisão usa transcript. |

**Deliverables:** biblioteca, metadados/checksum, upload validado, transcrição versionada e revisão de cortes.  
**Exit criteria:** arquivo indevido é rejeitado; timestamps funcionam; ajuste não dispara full render.  
**Demo scenario:** enviar aula, corrigir transcript, gerar e ajustar propostas de corte.  
**Risks:** arquivos grandes e custo; quotas e cancelamento são preflight obrigatório.

# SPRINT-11 — Composição e renderização de vídeo

**Sprint Goal:** produzir versões de vídeo aprováveis sem comprometer a API.

**Prerequisites:** SPRINT-10 e benchmark/ADR-008.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-MED-004, NUC-CNT-001 | L/M | Composição e núcleo de conteúdo em paralelo. |
| 2 | NUC-MED-005 | L | Render usa composition. |
| 3 | NUC-MED-006 | M | Cancel/regeneration usa render. |

**Deliverables:** reenquadramento, captions/brand, render assíncrono/versionado e cancelamento parcial.  
**Exit criteria:** carga de mídia não torna API indisponível; artifact mantém versão; cancelamento é observável.  
**Demo scenario:** ajustar foco/legenda, renderizar, cancelar uma versão e regenerar elemento.  
**Risks:** saturação da VPS; limites e gatilho de separação do worker são critérios de aceite.

# SPRINT-12 — Estúdio de conteúdo estático

**Sprint Goal:** criar, editar, versionar e aprovar peças estáticas e pacotes derivados.

**Prerequisites:** CNT-001, MKT-001, MED-003 e AI governada.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-CNT-002, NUC-CNT-003 | L/L | Formatos e geração em paralelo. |
| 2 | NUC-CNT-004 | L | Editor usa assets/formats. |
| 3 | NUC-CNT-005, NUC-CNT-006 | M/L | Templates e pacote após editor. |
| 4 | NUC-CNT-007 | M | Fecha versionamento/aprovação. |

**Deliverables:** formatos, geração de imagens, editor em camadas, templates, packages, comments/approval.  
**Exit criteria:** corrigir texto não chama IA; aprovado é imutável; falha de peça não perde pacote.  
**Demo scenario:** derivar carrossel/post/stories de aula, editar camadas e aprovar versões independentes.  
**Risks:** complexidade do editor; manter escopo nos formatos e camadas especificados.

# SPRINT-13 — Calendário, publicação, anúncios e insights

**Sprint Goal:** distribuir conteúdo aprovado, reconciliar efeitos externos e medir resultados.

**Prerequisites:** DISC-005, CNT-007, WFL-004 e channel sandboxes.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-PUB-001, NUC-PUB-002 | L/M | Calendar antes de schedule. |
| 2 | NUC-PUB-003, NUC-PUB-004 | L/M | Publish antes de reconciliation. |
| 3 | NUC-PUB-005, NUC-MKT-004 | M/L | Métricas e ads após adapter. |
| 4 | NUC-MKT-005, NUC-SUP-004, NUC-FIN-007 | M/M/M | Insights/evals em paralelo. |

**Deliverables:** calendário, agendamento, publicação/manual export, reconciliação, métricas, ads, experiments e insights.  
**Exit criteria:** timeout não duplica; conta revogada bloqueia; ausência ≠ zero; gasto exige policy.  
**Demo scenario:** agendar versão, simular resposta perdida, reconciliar, coletar métricas e avaliar experimento.  
**Risks:** revisão de aplicativos; fallback manual permanece funcional e claramente rotulado.

# SPRINT-14 — Experiência executiva e produto white label

**Sprint Goal:** oferecer visão diária explicável e preparar administração comercial/white label.

**Prerequisites:** dados dos módulos, P-009/P-012, infraestrutura de domínio e AI evals.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-EXE-001, NUC-PLT-003, NUC-PLT-004 | L/L/L | Três trilhas paralelas. |
| 2 | NUC-PLT-005, NUC-EXE-003 | M/M | Consolidado/alertas após read models. |
| 3 | NUC-EXE-002, NUC-EXE-004 | L/L | Q&A e exports após dashboard. |
| 4 | NUC-IAM-005 | L | Direitos de dados após todos os stores conhecidos. |

**Deliverables:** dashboard/resumo/alertas/reports, branding/domínio, admin/plans e direitos de dados.  
**Exit criteria:** indicadores citam origem; consolidado respeita autorização/moeda; domínio não verificado não serve tenant.  
**Demo scenario:** trocar identidade, consultar empresas autorizadas, receber resumo e exportar com URL expirada.  
**Risks:** agregação/privacidade; negar consolidação quando regra de moeda ou autorização estiver ausente.

# SPRINT-15 — Hardening e capacidade

**Sprint Goal:** provar segurança, qualidade, acessibilidade e capacidade na topologia de produção.

**Prerequisites:** produto integrado e DISC-011.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-INF-002, NUC-OBS-002 | L/M | Ambiente e observabilidade em paralelo parcial. |
| 2 | NUC-SEC-001, NUC-QA-001, NUC-QA-002 | L/L/M | Workstreams paralelas; correções retornam aos módulos. |
| 3 | NUC-REL-002 | L | Carga sobre versão candidata. |

**Deliverables:** ambiente candidato, alertas/runbooks, threat model, suites/gates, acessibilidade e relatório de capacidade.  
**Exit criteria:** sem achado crítico/alto não aceito; p95 e resource limits medidos; telas críticas acessíveis.  
**Demo scenario:** provocar falha/alerta, executar scan e carga concorrente com media, mostrar API saudável.  
**Risks:** hardening revelar redesign; não maquiar risco, retornar ticket ao épico de origem.

# SPRINT-16 — Produção pronta

**Sprint Goal:** demonstrar recuperação, fluxos integrados e checklist de go-live sem ainda presumir autorização.

**Prerequisites:** SPRINT-15 e credenciais/configurações aprovadas.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-REL-001 | L | Restore é gate independente. |
| 2 | NUC-REL-003 | L | Usa candidato integrado. |
| 3 | NUC-REL-004 (preparação/ensaio) | L | Após restore/E2E. |

**Deliverables:** restore report, evidências F-01–F-08, release checklist, migration/import rehearsal e rollback.  
**Exit criteria:** restore atinge metas aprovadas; 8 fluxos e cenários críticos passam; owner autoriza ou recusa go-live.  
**Demo scenario:** restaurar ambiente isolado, executar smoke/E2E e ensaiar rollback sem tráfego real.  
**Risks:** dados externos/credenciais; usar sandbox e dados sintéticos até autorização formal.

# SPRINT-17 — Go-live e pós-lançamento

**Sprint Goal:** publicar quando autorizado, observar estabilidade e transformar achados em backlog.

**Prerequisites:** aprovação explícita do proprietário e checklist de SPRINT-16 assinado.

| Ordem | Tickets | Complexidade | Dependência / paralelização |
| ---: | --- | --- | --- |
| 1 | NUC-REL-004 (execução) | L | Sequencial e com decision gate. |
| 2 | NUC-REL-005 | M | Inicia imediatamente após release. |

**Deliverables:** release, smoke, monitoramento intensivo, relatório de estabilidade e backlog de achados.  
**Exit criteria:** métricas dentro dos thresholds ou rollback concluído; incident ownership ativo; documentação final sincronizada.  
**Demo scenario:** verificar health/smoke/métricas, simular alerta operacional e mostrar ticket de achado.  
**Risks:** efeito externo real; aplicar aprovação, feature flags, rollout e rollback definidos.

## 8. Estratégia de testes e evidências

| Categoria | Escopo | Execução / gate |
| --- | --- | --- |
| Unitário/domínio | Invariantes, transições, moeda, recorrência, dedup, budgets | Em todo commit; bloqueante. |
| Integração/DB | EF/Postgres/Hangfire/storage/adapters fake, migrations e concorrência | PR; bloqueante para módulo. |
| API/contrato | OpenAPI, erros, paginação, idempotência e provider contracts | PR e nightly; bloqueante nos contratos críticos. |
| Componente/A11Y | Formulários, estados, keyboard, contraste e editores | PR para componentes críticos; auditoria S15. |
| E2E | F-01–F-08 e jornadas por persona | Ambiente de validação; bloqueante para release. |
| Segurança | tenancy/authz, uploads, web, secrets, supply chain e IA adversarial | Contínuo; achado crítico/alto não aceito bloqueia. |
| Performance | p95 consultas, imports, webhooks, jobs, IA e media | Baseline por módulo; carga/soak S15 bloqueante. |
| Operações | deploy, migration, backup/restore, alerts, rollback e incidentes | Ensaio S15–S16; bloqueante para produção. |

Qualidade não será medida apenas por percentual de cobertura. Evidência mínima liga requisito, cenário, comando/ambiente, resultado e artefato, sem dados pessoais ou segredo.

## 9. Matriz de rastreabilidade funcional

| Requisitos | Épico | Tickets | Sprint | Evidência principal |
| --- | --- | --- | --- | --- |
| RF-001 | PLT | NUC-PLT-001 | 02 | E2E multi-workspace/arquivamento |
| RF-002, RF-003 | PLT | NUC-PLT-002 | 02 | API/UI entitlement e template idempotente |
| RF-004, RF-005 | PLT | NUC-PLT-003 | 14 | E2E branding/domínio/TLS/isolamento |
| RF-006, RF-008 | PLT | NUC-PLT-004 | 14 | E2E admin/support/plan |
| RF-007 | PLT | NUC-PLT-005 | 14 | Testes consolidação/moeda/authz |
| RF-009 | IAM | NUC-IAM-001 | 02 | E2E login/recovery/revoke |
| RF-010 | IAM | NUC-IAM-002 | 02 | Matriz SEC horizontal/vertical |
| RF-011 | IAM | NUC-IAM-003 | 02 | E2E MFA/step-up/recovery |
| RF-012 | IAM | NUC-IAM-004 | 02 | Consulta e imutabilidade de audit |
| RF-013 | IAM | NUC-IAM-005 | 14 | E2E export/retention/erase |
| RF-014 | INT | NUC-INT-001 | 03 | SEC conexão/revogação |
| RF-015 | INT | NUC-INT-002 | 03 | Contract/API webhook |
| RF-016 | INT | NUC-INT-003 | 03 | Idempotência/ordem/restart |
| RF-017 | INT | NUC-INT-004 | 04 | E2E import sobreposto |
| RF-018 | INT | NUC-INT-005 | 03 | Mapper contracts/unknowns |
| RF-019 | INT | NUC-INT-006 | 04 | E2E replay/audit |
| RF-020, RF-021 | COM | NUC-COM-001 | 03 | API catálogo/origem/capability |
| RF-022 | COM | NUC-COM-002 | 03 | Domínio timeline/refund/chargeback |
| RF-023 | COM | NUC-COM-003 | 04 | API/C metrics/drill-down |
| RF-024 | FIN | NUC-FIN-001 | 05 | Domínio moeda/saldo/audit |
| RF-025 | FIN | NUC-FIN-002 | 05 | Recorrência/baixa/cancelamento |
| RF-026 | FIN | NUC-FIN-003 | 05 | E2E preview/error/dedup import |
| RF-027 | FIN | NUC-FIN-004 | 05 | Caso numérico de conciliação |
| RF-028 | FIN | NUC-FIN-005 | 06 | F-03 e drill-down |
| RF-029 | FIN | NUC-FIN-006 | 06 | Unitários fórmulas/projeção |
| RF-030 | FIN | NUC-FIN-007 | 13 | Evals + aprovação/fallback |
| RF-031 | FIN | NUC-FIN-008 | 06 | SEC arquivo/export/accounting |
| RF-032 | FIS | NUC-FIS-001 | 06 | Validação contábil e policy |
| RF-033 | FIS | NUC-FIS-002 | 06 | F-04/idempotência/unknown |
| RF-034 | FIS | NUC-FIS-003 | 06 | Contracts rejeição/cancelamento |
| RF-035 | FIS | NUC-FIS-004 | 06 | E2E fila/export/resolução |
| RF-036 | CRM | NUC-CRM-001 | 04 | SEC contact multi-tenant |
| RF-037 | CRM | NUC-CRM-002 | 04 | Merge ambíguo/histórico |
| RF-038 | CRM | NUC-CRM-003 | 04 | Segment query/explainability |
| RF-039 | CRM | NUC-CRM-004 | 04 | Import/form abuse tests |
| RF-040 | CRM | NUC-CRM-005 | 09 | Scheduled suppression E2E |
| RF-041 | CRM | NUC-CRM-006 | 09 | Audience/send/webhook contract |
| RF-042 | MKT | NUC-MKT-001 | 09 | Version/preview/A11Y |
| RF-043 | MKT | NUC-MKT-002 | 09 | Campaign budget linkage |
| RF-044 | MKT | NUC-MKT-003 | 09 | Capability/UI contract |
| RF-045 | MKT | NUC-MKT-004 | 13 | Spend/auth/reconciliation SEC |
| RF-046 | MKT | NUC-MKT-005 | 13 | Experiment/attribution report |
| RF-047 | MED | NUC-MED-001 | 10 | Upload/storage SEC/PERF |
| RF-048 | MED | NUC-MED-002 | 10 | Transcript timestamps/version |
| RF-049, RF-050 | MED | NUC-MED-003 | 10 | Eval + edit/preview E2E |
| RF-051, RF-052 | MED | NUC-MED-004 | 11 | Visual/safe-area/captions |
| RF-053 | MED | NUC-MED-005 | 11 | Async render/load isolation |
| RF-054 | MED | NUC-MED-006 | 11 | Cancel/partial regen |
| RF-055 | CNT | NUC-CNT-001 | 11 | Provenance/state machine |
| RF-056 | CNT | NUC-CNT-002 | 12 | Visual/export order |
| RF-057 | CNT | NUC-CNT-003 | 12 | Provider/cost/rights/eval |
| RF-058 | CNT | NUC-CNT-004 | 12 | Layer persistence/no AI recall |
| RF-059 | CNT | NUC-CNT-005 | 12 | Template version/copy-on-use |
| RF-060 | CNT | NUC-CNT-006 | 12 | Package partial failure E2E |
| RF-061 | CNT | NUC-CNT-007 | 12 | Approval invalidation/version |
| RF-062 | PUB | NUC-PUB-001 | 13 | Calendar filters/A11Y |
| RF-063 | PUB | NUC-PUB-002 | 13 | DST/revoke/version preflight |
| RF-064 | PUB | NUC-PUB-003 | 13 | Channel contract/manual fallback |
| RF-065 | PUB | NUC-PUB-004 | 13 | Unknown result/no duplicate |
| RF-066 | PUB | NUC-PUB-005 | 13 | Snapshot freshness/unknown |
| RF-067 | SUP | NUC-SUP-001 | 09 | Ticket/channel/contact E2E |
| RF-068 | SUP | NUC-SUP-002 | 09 | Cited answer/eval/handoff |
| RF-069 | SUP | NUC-SUP-003 | 09 | Escalation/exception E2E |
| RF-070 | SUP | NUC-SUP-004 | 13 | Evidence/sample/unknown eval |
| RF-071 | AI | NUC-AI-001 | 07 | Version/pinning/isolation |
| RF-072 | AI | NUC-AI-002 | 07 | Role-without-grant SEC |
| RF-073 | AI | NUC-AI-003 | 07 | Chat/task/cancel/persistence |
| RF-074 | AI | NUC-AI-004 | 07 | Revocation/citation/tenant SEC |
| RF-075 | AI | NUC-AI-005 | 07 | Tool/injection adversarial suite |
| RF-076 | AI | NUC-AI-006 | 08 | Delegation scope/depth/budget |
| RF-077 | AI | NUC-AI-007 | 08 | Persisted run/UI/authz |
| RF-078 | AI | NUC-AI-008 | 07 | Budget concurrency/unknown cost |
| RF-079 | AI | NUC-AI-009 | 08 | Versioned eval/regression gate |
| RF-080 | WFL | NUC-WFL-001 | 08 | Dependency/origin/block test |
| RF-081 | WFL | NUC-WFL-002 | 08 | Invalid/published version E2E |
| RF-082 | WFL | NUC-WFL-003 | 08 | Restart/retry/unknown chaos |
| RF-083 | WFL | NUC-WFL-004 | 08 | Approval exact/expired/403 |
| RF-084 | WFL | NUC-WFL-005 | 08 | Pause/in-flight/resume E2E |
| RF-085 | WFL | NUC-WFL-006 | 08 | Zero external writes SEC |
| RF-086 | EXE | NUC-EXE-001 | 14 | Source/freshness/drill-down |
| RF-087 | EXE | NUC-EXE-002 | 14 | Fact/hypothesis/absence eval |
| RF-088 | EXE | NUC-EXE-003 | 14 | Severity/dedup/preference |
| RF-089 | EXE | NUC-EXE-004 | 14 | Async export/expiry/tenant SEC |

## 10. Matriz RNF, fluxos e pendências

### Requisitos não funcionais

| RNF | Tickets responsáveis | Evidência/gate |
| --- | --- | --- |
| RNF-001 | ARC-002, PLT-001, IAM-002, QA-001, SEC-001 | Suite negativa API/job/file/search/AI/export sem exposição cruzada. |
| RNF-002 | IAM-002/003, WFL-004, AI-005, SEC-001 | Escalada horizontal/vertical e revogação antes de job. |
| RNF-003 | ARC-003, COM-003, EXE-001, REL-002 | p95 ≤ 1 s no cenário de referência aprovado; paginação. |
| RNF-004 | JOB-001, INT-004, MED-005, WFL-003 | APIs assíncronas devolvem run ID e estado sem request longo. |
| RNF-005 | DISC-004/011, REL-002 | Modelo e teste de contacts/sales/events/files/video/jobs. |
| RNF-006 | JOB-001, INT-003, WFL-003, PUB-004 | Falha temporária/permanente/unknown distinta; backoff limitado. |
| RNF-007 | OBS-001/002 e todos adapters | Correlação request/webhook/job/external action e alertas acionáveis. |
| RNF-008 | DISC-011, REL-001 | Backup externo e restore real medido contra RPO/RTO. |
| RNF-009 | IAM, MED-001, INF-002, SEC-001 | TLS/sessão/uploads/secrets/admin/scans. |
| RNF-010 | IAM-005, CRM-005, AI-004/005, SEC-001 | Minimização, retenção, consent e revisão jurídica. |
| RNF-011 | DISC-003/004/011, AI-008, REL-002 | Usage/budgets/capacity/costs com unknown explícito. |
| RNF-012 | FE-001, QA-002 e telas de cada módulo | Responsividade, teclado, contraste e erros acionáveis. |
| RNF-013 | ARC/ENG/CI/INF-002/DOC-001 | Fronteiras, contratos, migrations, release/rollback e docs. |
| RNF-014 | AI-004/005/009, CNT-003, SUP-002 | Evals de fontes/injection/tools/limits/cost antes de autonomia. |
| RNF-015 | FIN/COM, WFL-005, EXE-002, REL-003 | Consulta/operação manual funciona com IA indisponível. |

### Fluxos ponta a ponta

| Fluxo | Tickets principais | Sprint de demonstração final |
| --- | --- | --- |
| F-01 Preparar empresa | PLT-001/002, IAM-002, INT-001/004, FIN-001, WFL-005 | 16 |
| F-02 Venda e atualização | INT-002/003/005, COM-002/003, CRM-001, FIN-004 | 16 |
| F-03 Fechamento financeiro | FIN-002–006/008 | 06 e 16 |
| F-04 Emissão fiscal | FIS-001–004, WFL-004/005 | 06 e 16 |
| F-05 Vídeo para pacote | MED-001–006, CNT-001/006/007, PUB-001–005 | 13 e 16 |
| F-06 Campanha assistida | MKT-001–005, FIN-006, CNT, PUB, WFL-004 | 13 e 16 |
| F-07 Agente recebe tarefa | AI-001–009, WFL-001/004/005 | 08 e 16 |
| F-08 Desativação e recuperação | PLT-001/002, INT-001, WFL-003/005/006, REL-003 | 08 e 16 |

### Pendências e spikes

| Pendência | Spike | Bloqueia diretamente |
| --- | --- | --- |
| P-001 | NUC-DISC-001 | INT-002–005 |
| P-002 | NUC-DISC-002 | FIS-001–004 |
| P-003 | NUC-DISC-003 | AI-001, MED-002, CNT-003 |
| P-004 | NUC-DISC-004 | MED-001/005 e capacidade |
| P-005 | NUC-DISC-005 | MKT-004, PUB-003–005 |
| P-006 | NUC-DISC-006 | CRM-006, SUP-001 |
| P-007 | NUC-DISC-007 | FIN-001–006 |
| P-008 | NUC-DISC-008 | ARC/ENG/IAM foundation |
| P-009 | NUC-DISC-009 | PLT-004 cobrança, não entitlement |
| P-010 | NUC-DISC-010 | MKT-003 além de referência |
| P-011 | NUC-DISC-011 | INF-002, REL-001/002/004 |
| P-012 | NUC-DISC-012 | PLT-005, FIS-001 e consolidação |

## 11. Riscos, operação e rollback

| Risco | Nível | Mitigação / decisão de retorno |
| --- | --- | --- |
| Exposição entre tenants | CRÍTICO | Contexto confiável, constraints/policies e suite negativa; bloqueia release. |
| Efeito externo duplicado | CRÍTICO | Receipt/inbox/idempotency/reconciliation/unknown; nunca retry cego. |
| Regra financeira/fiscal incorreta | CRÍTICO | Fórmulas/contabilidade aprovadas, versões e exemplos; produção bloqueada. |
| Prompt injection/privilégio de agente | CRÍTICO | Tools server-side, grants restritivos, conteúdo não confiável e eval adversarial. |
| Saturação por vídeo/jobs | ALTO | Filas/limits/benchmark/observability; separar worker quando threshold for atingido. |
| Provider sem capacidade prometida | ALTO | Capability matrix e fallback manual; UI não anuncia suporte inexistente. |
| Perda de dados/rollback impossível | CRÍTICO | Backup externo, restore ensaiado, expand/contract e compatibilidade entre versões. |
| Custo imprevisível | ALTO | Budgets/preflight/usage, unknown explícito, quotas e alertas. |
| Escopo de editor crescer | ALTO | Manter formatos/camadas definidos; mudança entra em controle de escopo. |

Rollback de aplicação usa imagem anterior compatível. Migration destrutiva não é revertida automaticamente: preferir expand/contract, backup e correção forward. Ações externas usam reconciliação/compensação suportada; remover uma imagem nunca desfaz publicação, nota fiscal ou gasto já executado.

## 12. Lacunas e decisões humanas ainda necessárias

- Duração da sprint, capacidade real e disponibilidade de revisão do único ou múltiplos implementadores.
- Todos os resultados P-001–P-012; a ordem do backlog permite avançar apenas nas trilhas liberadas.
- Critério jurídico de privacidade/comunicação e validação contábil/fiscal antes de operação real.
- Autorização separada para contratar providers, criar infraestrutura, conectar contas, publicar, emitir ou gastar.
- Disponibilidade/nome de marca e domínio do produto não foram verificados.
- Aplicativo de destino para importação do backlog não foi escolhido; por isso o arquivo legível é canônico e um CSV deve ser derivado quando o schema do destino for conhecido.

## 13. Documentação, lessons e mudanças desta entrega

Arquivo criado nesta entrega:

- documentacoes/transversal/2026-09-22-backlog-completo.md — plano completo, sem implementação de código/configuração.

Nenhum commit foi criado nesta tarefa. A raiz não contém repositório Git, portanto não existem branch, HEAD, base, diff staged ou unstaged reais a registrar. O conteúdo novo deste próprio documento não é recopiado recursivamente como patch; seu caminho e estado estão registrados acima.

lessons não foi alterado: esta entrega é planejamento e não introduz nem exercita implementação de conceito C#/.NET. Cada ticket de implementação exige avaliar e atualizar a lesson aplicável e o índice lessons/README.md.

## 14. Resumo final e handoff

**Arquitetura:** monólito modular com React, API/worker .NET, PostgreSQL/Hangfire, storage por decidir e adaptadores capability-based.  
**Produto:** escopo completo em quatro releases internas e 18 sprints técnicas; não é um MVP reduzido.  
**Crítico:** tenancy/IAM → ingestão/comercial → financeiro/workflows → fiscal/publicação → hardening/restore/release.  
**Maiores riscos:** isolamento, efeitos externos desconhecidos, regras fiscal/financeira, governança IA, mídia e recuperação.  
**Primeiro ticket recomendado:** NUC-DOC-001 em paralelo a NUC-DISC-008; a primeira implementação de aplicação é NUC-ENG-001 após ADR-001/002/004.

Exemplo de handoff:

> Implemente NUC-ENG-001 conforme documentacoes/transversal/2026-09-22-backlog-completo.md. Leia AGENTS.md, os ADRs referenciados e a Especificação Mestra. Implemente somente o ticket e seus critérios; execute as verificações; atualize documentacoes e lessons; relate qualquer desvio sem redesenhar decisões aceitas.

## 15. Verificações desta entrega

Executadas em 2026-09-22:

- inventário recursivo confirmou ausência de .sln, .csproj, global.json, Directory.Build.*, README técnico e arquivos anteriores em back, front, documentacoes e lessons;
- git branch --show-current, git rev-parse HEAD e git status --short retornaram “not a git repository”; por isso nenhum SHA/diff Git foi inventado;
- script PowerShell comparou os IDs da Especificação Mestra com este backlog: 89/89 RF, 15/15 RNF, 12/12 P e F-01 a F-08 presentes, sem ID ausente;
- script PowerShell contou 116 definições de ticket e 116 IDs únicos, 21 épicos, 18 sprints e dois blocos Mermaid corretamente fechados;
- Test-Path confirmou o alvo do link relativo para Nucleos-Especificacao-Mestra.md;
- inspeção de tamanho confirmou documento UTF-8 com aproximadamente 107 KB e mais de 900 linhas antes desta seção final.

Não foram executados build, testes de aplicação, lint ou formatação de código porque ainda não há código/projetos no repositório e esta entrega altera somente planejamento Markdown.
