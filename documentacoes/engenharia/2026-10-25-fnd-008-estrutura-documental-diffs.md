# FND-008 — diffs

Diffs reais da tarefa (base `2cb39dc`), exceto esta entrega e este arquivo. Registro principal: [2026-10-25-fnd-008-estrutura-documental.md](2026-10-25-fnd-008-estrutura-documental.md).

```diff
diff --git a/Nucleos-Especificacao-Mestra.md b/Nucleos-Especificacao-Mestra.md
index eee6b4f..9041cfb 100755
--- a/Nucleos-Especificacao-Mestra.md
+++ b/Nucleos-Especificacao-Mestra.md
@@ -5,6 +5,8 @@ Data de consolidação: 2026-09-22
 Responsável pelo produto: Vinícius  
 Finalidade: entrada autossuficiente para um agente elaborar épicos, funcionalidades, histórias, tarefas, dependências, sprints, validação e publicação do software.
 
+> **Nota de substituição (2026-10-25) — status: Substituída em parte.** A **stack tecnológica** descrita neste documento (.NET 10) foi substituída pelas decisões do [ADR de arquitetura de 2026-10-25](documentacoes/transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md) (NestJS/TypeScript, Python, React/Next.js; ver [ADR-004..006](documentacoes/arquitetura/adr/README.md)). O restante (visão de produto, domínio, requisitos funcionais e regras de negócio) permanece como insumo, sujeito à consolidação da segunda parte do planejamento. Nenhum conteúdo original foi apagado. Origem: tarefa FND-008; questões Q-01 e Q-07 do [README do backlog](documentacoes/backlog/README.md).
+
 > Este documento especifica trabalho a realizar. Não afirma que funcionalidades, integrações, testes ou infraestrutura já estejam implementados. O planejamento deve cobrir o produto completo; as etapas são marcos internos de construção, não uma redução para MVP.
 
 ## 1. Como usar e interpretar este documento
diff --git a/documentacoes/_modelos/README.md b/documentacoes/_modelos/README.md
new file mode 100644
index 0000000..baded59
--- /dev/null
+++ b/documentacoes/_modelos/README.md
@@ -0,0 +1,6 @@
+# Modelos
+
+Templates reutilizáveis de documentação.
+
+- [modelo-documento-de-entrega.md](modelo-documento-de-entrega.md) — documento de entrega exigido pelo `CLAUDE.md`.
+- ADR: [arquitetura/adr/0000-template.md](../arquitetura/adr/0000-template.md).
diff --git a/documentacoes/_modelos/modelo-documento-de-entrega.md b/documentacoes/_modelos/modelo-documento-de-entrega.md
new file mode 100644
index 0000000..5bd7662
--- /dev/null
+++ b/documentacoes/_modelos/modelo-documento-de-entrega.md
@@ -0,0 +1,48 @@
+# <Título breve> — AAAA-MM-DD
+
+## 1. Metadados
+
+- **Domínio:** <domínio de negócio em kebab-case>
+- **Tarefa/solicitação:** <ticket ou descrição>
+- **Branch:** <branch>
+- **Base / commit inicial:** <SHA e como foi definida a base>
+- **Estado da árvore no início:** <limpa | alterações preexistentes>
+- **Estado da entrega:** <em andamento | pronta para revisão | concluída>
+- **Autores conhecidos:** <pessoas e agentes>
+
+## 2. Objetivo, contexto e escopo
+
+- **Objetivo:**
+- **Contexto:**
+- **Escopo:**
+- **Fora do escopo:**
+
+## 3. Resumo da implementação
+
+## 4. Mudanças por arquivo
+
+| Arquivo | Tipo (código/teste/config/migração/doc) | Descrição |
+| --- | --- | --- |
+
+## 5. Decisões técnicas, alternativas e consequências
+
+## 6. Validações (comandos e resultados reais)
+
+| Comando | Resultado |
+| --- | --- |
+
+O que não foi executado e por quê:
+
+## 7. Impactos, riscos, compatibilidade, observabilidade e rollback
+
+## 8. Commits e diffs
+
+Registrar branch, `HEAD`, estado da árvore e base no início. Para cada commit da tarefa: SHA, mensagem e diff unificado em bloco `diff`. Sem commit: "Nenhum commit criado nesta tarefa" e os diffs staged e unstaged. Diffs grandes: arquivo `AAAA-MM-DD-titulo-breve-diffs.md` com links nos dois sentidos. Binários: caminho, tipo, tamanho e hash. Segredos: `[REDACTED]` com sinalização. Não incluir o diff de `documentacoes/` e `lessons/` produzido só por esta escrita; listar esses arquivos.
+
+## 9. Lessons
+
+Links relativos para lessons criadas ou atualizadas, ou justificativa de não aplicabilidade.
+
+## 10. Pendências
+
+Pendências reais ou "Não há pendências conhecidas".
diff --git a/documentacoes/arquitetura/adr/0000-template.md b/documentacoes/arquitetura/adr/0000-template.md
new file mode 100644
index 0000000..23b61f7
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0000-template.md
@@ -0,0 +1,46 @@
+# ADR-NNN — Título da decisão
+
+- **Status:** Proposto | Aceito | Rejeitado | Substituído por ADR-NNN | Obsoleto
+- **Data:** AAAA-MM-DD
+- **Decisores:** nomes ou papéis
+- **Origem:** ticket, spike ou documento que motivou o ADR
+
+## Contexto
+
+Situação, forças em jogo e restrições (técnicas, de segurança, de custo, de prazo).
+
+## Problema
+
+A pergunta que precisa ser decidida, em uma ou duas frases.
+
+## Decisão
+
+O que foi decidido, no imperativo e sem ambiguidade.
+
+## Alternativas
+
+| Alternativa | Por que foi considerada | Por que não foi escolhida |
+| --- | --- | --- |
+| A | | |
+
+## Benefícios
+
+O que a decisão melhora.
+
+## Trade-offs
+
+O que se perde ou se paga com a decisão.
+
+## Consequências
+
+Efeitos sobre código, operação, segurança, testes e documentação; trabalho derivado.
+
+## Quando revisar
+
+Gatilhos concretos (métrica, evento ou data) que obrigam a reabrir a decisão.
+
+## Referências
+
+Links relativos para tickets, evidências (script e saída) e documentos relacionados.
+
+> Regra: ADR de spike nasce como **Proposto**; só decisão humana o torna **Aceito**. Numeração: ADR-016 em diante, sequencial, sem reutilizar números.
diff --git a/documentacoes/arquitetura/adr/0001-saas-com-control-plane-central-e-data.md b/documentacoes/arquitetura/adr/0001-saas-com-control-plane-central-e-data.md
new file mode 100644
index 0000000..ab87f73
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0001-saas-com-control-plane-central-e-data.md
@@ -0,0 +1,22 @@
+# ADR-001 — SaaS com Control Plane central e Data Plane por tenant
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+SaaS com Control Plane central e Data Plane por tenant
+
+## Justificativa
+
+Administração unificada, execução separada
+
+## Consequência
+
+Duas áreas com responsabilidades distintas
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0002-runtime-dedicado-por-empresa-em-container-maquinas.md b/documentacoes/arquitetura/adr/0002-runtime-dedicado-por-empresa-em-container-maquinas.md
new file mode 100644
index 0000000..0002eff
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0002-runtime-dedicado-por-empresa-em-container-maquinas.md
@@ -0,0 +1,22 @@
+# ADR-002 — Runtime **dedicado por empresa**, em container; máquinas compartilhadas
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Runtime **dedicado por empresa**, em container; máquinas compartilhadas
+
+## Justificativa
+
+Custos controlados sem compartilhar processo de execução
+
+## Consequência
+
+Um deployment/runtime identificado por tenant
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0003-database-postgresql-exclusivo-por-tenant-dentro-de.md b/documentacoes/arquitetura/adr/0003-database-postgresql-exclusivo-por-tenant-dentro-de.md
new file mode 100644
index 0000000..e3bbcc4
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0003-database-postgresql-exclusivo-por-tenant-dentro-de.md
@@ -0,0 +1,22 @@
+# ADR-003 — **Database PostgreSQL exclusivo por tenant** dentro de instância compartilhada no MVP
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+**Database PostgreSQL exclusivo por tenant** dentro de instância compartilhada no MVP
+
+## Justificativa
+
+Impede acesso cruzado via credenciais de aplicação
+
+## Consequência
+
+Provisionamento de database/roles e migrações individuais
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0004-nestjs-typescript-para-control-plane.md b/documentacoes/arquitetura/adr/0004-nestjs-typescript-para-control-plane.md
new file mode 100644
index 0000000..a48161e
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0004-nestjs-typescript-para-control-plane.md
@@ -0,0 +1,22 @@
+# ADR-004 — NestJS + TypeScript para Control Plane
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+NestJS + TypeScript para Control Plane
+
+## Justificativa
+
+Organização do domínio e APIs
+
+## Consequência
+
+Contratos claros com runtimes
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0005-python-para-tenant-runtime-de-ia.md b/documentacoes/arquitetura/adr/0005-python-para-tenant-runtime-de-ia.md
new file mode 100644
index 0000000..587326f
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0005-python-para-tenant-runtime-de-ia.md
@@ -0,0 +1,22 @@
+# ADR-005 — Python para Tenant Runtime de IA
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Python para Tenant Runtime de IA
+
+## Justificativa
+
+Ferramentas/ecossistema de agentes
+
+## Consequência
+
+Deploy e ciclo de vida independentes
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0006-react-next-js-react-three-fiber-three.md b/documentacoes/arquitetura/adr/0006-react-next-js-react-three-fiber-three.md
new file mode 100644
index 0000000..8d300a7
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0006-react-next-js-react-three-fiber-three.md
@@ -0,0 +1,22 @@
+# ADR-006 — React + Next.js; React Three Fiber + Three.js para 3D
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+React + Next.js; React Three Fiber + Three.js para 3D
+
+## Justificativa
+
+UI SaaS e renderização no cliente
+
+## Consequência
+
+GPU de renderização 3D não é requisito do servidor
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0007-llms-inicialmente-via-apis-externas-por-gateway.md b/documentacoes/arquitetura/adr/0007-llms-inicialmente-via-apis-externas-por-gateway.md
new file mode 100644
index 0000000..c4e52df
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0007-llms-inicialmente-via-apis-externas-por-gateway.md
@@ -0,0 +1,22 @@
+# ADR-007 — LLMs inicialmente via APIs externas, por gateway
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+LLMs inicialmente via APIs externas, por gateway
+
+## Justificativa
+
+Evita custo de GPU própria
+
+## Consequência
+
+Custos variáveis de tokens devem ser limitados
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0008-postgresql-pgvector-redis-para-cache-auxiliares-armazenamento.md b/documentacoes/arquitetura/adr/0008-postgresql-pgvector-redis-para-cache-auxiliares-armazenamento.md
new file mode 100644
index 0000000..d274eb1
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0008-postgresql-pgvector-redis-para-cache-auxiliares-armazenamento.md
@@ -0,0 +1,22 @@
+# ADR-008 — PostgreSQL + pgvector; Redis para cache/auxiliares; armazenamento de objetos para arquivos
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+PostgreSQL + pgvector; Redis para cache/auxiliares; armazenamento de objetos para arquivos
+
+## Justificativa
+
+Persistência relacional + memória semântica
+
+## Consequência
+
+Backups e permissões diferenciados
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0009-execucoes-de-ia-assincronas-e-duraveis.md b/documentacoes/arquitetura/adr/0009-execucoes-de-ia-assincronas-e-duraveis.md
new file mode 100644
index 0000000..9b1b0e1
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0009-execucoes-de-ia-assincronas-e-duraveis.md
@@ -0,0 +1,22 @@
+# ADR-009 — Execuções de IA assíncronas e duráveis
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Execuções de IA assíncronas e duráveis
+
+## Justificativa
+
+Requisições web não bloqueiam por tarefas longas
+
+## Consequência
+
+Filas/workflows, retries, idempotência
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0010-docker-compose-no-mvp-com-especificacao-declarativa.md b/documentacoes/arquitetura/adr/0010-docker-compose-no-mvp-com-especificacao-declarativa.md
new file mode 100644
index 0000000..2ea8dc3
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0010-docker-compose-no-mvp-com-especificacao-declarativa.md
@@ -0,0 +1,22 @@
+# ADR-010 — Docker Compose no MVP, com especificação declarativa migrável
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Docker Compose no MVP, com especificação declarativa migrável
+
+## Justificativa
+
+Baixo custo operacional inicial
+
+## Consequência
+
+Implementar provisionamento abstrato do orquestrador
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0011-escala-horizontal-por-tenant-e-por-pool.md b/documentacoes/arquitetura/adr/0011-escala-horizontal-por-tenant-e-por-pool.md
new file mode 100644
index 0000000..e219726
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0011-escala-horizontal-por-tenant-e-por-pool.md
@@ -0,0 +1,22 @@
+# ADR-011 — Escala horizontal por tenant e por pool de workers
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Escala horizontal por tenant e por pool de workers
+
+## Justificativa
+
+Isolamento de carga
+
+## Consequência
+
+Distribuição entre hosts e quotas
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0012-deny-by-default-e-autorizacao-externa-ao.md b/documentacoes/arquitetura/adr/0012-deny-by-default-e-autorizacao-externa-ao.md
new file mode 100644
index 0000000..901edbc
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0012-deny-by-default-e-autorizacao-externa-ao.md
@@ -0,0 +1,22 @@
+# ADR-012 — **Deny-by-default e autorização externa ao LLM**
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+**Deny-by-default e autorização externa ao LLM**
+
+## Justificativa
+
+Prompt não é controle de acesso
+
+## Consequência
+
+Gateway de ferramentas e política por recurso/operação
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0013-execucao-arbitraria-de-codigo-fora-do-runtime.md b/documentacoes/arquitetura/adr/0013-execucao-arbitraria-de-codigo-fora-do-runtime.md
new file mode 100644
index 0000000..9c0d1c0
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0013-execucao-arbitraria-de-codigo-fora-do-runtime.md
@@ -0,0 +1,22 @@
+# ADR-013 — Execução arbitrária de código fora do runtime principal
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Execução arbitrária de código fora do runtime principal
+
+## Justificativa
+
+Reduz risco de escape/acesso a segredos
+
+## Consequência
+
+Sandbox Executor segregado, ou funcionalidade desativada no MVP
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0014-nenhum-acesso-de-rede-entre-tenants-por.md b/documentacoes/arquitetura/adr/0014-nenhum-acesso-de-rede-entre-tenants-por.md
new file mode 100644
index 0000000..699fbba
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0014-nenhum-acesso-de-rede-entre-tenants-por.md
@@ -0,0 +1,22 @@
+# ADR-014 — Nenhum acesso de rede entre tenants por padrão
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Nenhum acesso de rede entre tenants por padrão
+
+## Justificativa
+
+Containers exclusivos não bastam
+
+## Consequência
+
+Firewall DOCKER-USER/nftables ou política de rede equivalente testada
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/0015-custos-por-tenant-e-por-agente-obrigatoriamente.md b/documentacoes/arquitetura/adr/0015-custos-por-tenant-e-por-agente-obrigatoriamente.md
new file mode 100644
index 0000000..a5022f4
--- /dev/null
+++ b/documentacoes/arquitetura/adr/0015-custos-por-tenant-e-por-agente-obrigatoriamente.md
@@ -0,0 +1,22 @@
+# ADR-015 — Custos por tenant e por agente obrigatoriamente rastreados
+
+> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.
+
+- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
+- **Data:** 2026-10-25
+
+## Decisão
+
+Custos por tenant e por agente obrigatoriamente rastreados
+
+## Justificativa
+
+Evitar surpresa financeira
+
+## Consequência
+
+Cotas, rate limits, telemetria e corte de orçamento
+
+## Seções do template sem conteúdo na fonte
+
+Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
diff --git a/documentacoes/arquitetura/adr/README.md b/documentacoes/arquitetura/adr/README.md
new file mode 100644
index 0000000..f6b5aaf
--- /dev/null
+++ b/documentacoes/arquitetura/adr/README.md
@@ -0,0 +1,23 @@
+# Registro de decisões de arquitetura (ADR)
+
+Os ADR-001..015 foram importados do [documento consolidado de 2026-10-25](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md), que permanece intacto como fonte. Novos ADR (ADR-016 em diante) usam o [template](0000-template.md).
+
+**Stack vigente:** TypeScript (NestJS/Next.js) e Python, conforme ADR-004..006. A divergência com a Especificação Mestra e o backlog de 2026-09-22 (.NET 10) está resolvida a favor do ADR; a questão Q-01 do [README do backlog](../../backlog/README.md) foi decidida pelo usuário (stack TypeScript + Python); a atualização de `CLAUDE.md`, `AGENTS.md` e `lessons/` é da tarefa LOC-001, fora desta entrega.
+
+| ID | Decisão |
+| --- | --- |
+| ADR-001 | [SaaS com Control Plane central e Data Plane por tenant](0001-saas-com-control-plane-central-e-data.md) |
+| ADR-002 | [Runtime **dedicado por empresa**, em container; máquinas compartilhadas](0002-runtime-dedicado-por-empresa-em-container-maquinas.md) |
+| ADR-003 | [**Database PostgreSQL exclusivo por tenant** dentro de instância compartilhada no MVP](0003-database-postgresql-exclusivo-por-tenant-dentro-de.md) |
+| ADR-004 | [NestJS + TypeScript para Control Plane](0004-nestjs-typescript-para-control-plane.md) |
+| ADR-005 | [Python para Tenant Runtime de IA](0005-python-para-tenant-runtime-de-ia.md) |
+| ADR-006 | [React + Next.js; React Three Fiber + Three.js para 3D](0006-react-next-js-react-three-fiber-three.md) |
+| ADR-007 | [LLMs inicialmente via APIs externas, por gateway](0007-llms-inicialmente-via-apis-externas-por-gateway.md) |
+| ADR-008 | [PostgreSQL + pgvector; Redis para cache/auxiliares; armazenamento de objetos para arquivos](0008-postgresql-pgvector-redis-para-cache-auxiliares-armazenamento.md) |
+| ADR-009 | [Execuções de IA assíncronas e duráveis](0009-execucoes-de-ia-assincronas-e-duraveis.md) |
+| ADR-010 | [Docker Compose no MVP, com especificação declarativa migrável](0010-docker-compose-no-mvp-com-especificacao-declarativa.md) |
+| ADR-011 | [Escala horizontal por tenant e por pool de workers](0011-escala-horizontal-por-tenant-e-por-pool.md) |
+| ADR-012 | [**Deny-by-default e autorização externa ao LLM**](0012-deny-by-default-e-autorizacao-externa-ao.md) |
+| ADR-013 | [Execução arbitrária de código fora do runtime principal](0013-execucao-arbitraria-de-codigo-fora-do-runtime.md) |
+| ADR-014 | [Nenhum acesso de rede entre tenants por padrão](0014-nenhum-acesso-de-rede-entre-tenants-por.md) |
+| ADR-015 | [Custos por tenant e por agente obrigatoriamente rastreados](0015-custos-por-tenant-e-por-agente-obrigatoriamente.md) |
diff --git a/documentacoes/engenharia/README.md b/documentacoes/engenharia/README.md
new file mode 100644
index 0000000..b9fa765
--- /dev/null
+++ b/documentacoes/engenharia/README.md
@@ -0,0 +1,7 @@
+# Engenharia
+
+Documentação de entrega de tarefas de engenharia (fundação, monorepo, CI, ambientes, versões de ferramentas), no formato de [_modelos/modelo-documento-de-entrega.md](../_modelos/modelo-documento-de-entrega.md), com nome `AAAA-MM-DD-titulo-breve.md`.
+
+Entregas registradas:
+
+- [FND-008 — estrutura documental](2026-10-25-fnd-008-estrutura-documental.md)
diff --git a/documentacoes/runbooks/README.md b/documentacoes/runbooks/README.md
new file mode 100644
index 0000000..1ea9d8f
--- /dev/null
+++ b/documentacoes/runbooks/README.md
@@ -0,0 +1,8 @@
+# Runbooks
+
+Procedimentos operacionais passo a passo (provisionar tenant, rotacionar segredo, restaurar backup, responder a incidente). Cada runbook deve declarar: objetivo, pré-requisitos, passos verificáveis, validação, rollback e contatos/responsáveis.
+
+- Sem segredos ou dados reais nos exemplos.
+- Procedimentos que tocam banco ou serviços reais exigem ambiente isolado declarado.
+
+Estado: pasta criada pela tarefa FND-008; ainda sem runbooks.
diff --git a/documentacoes/seguranca/README.md b/documentacoes/seguranca/README.md
new file mode 100644
index 0000000..c6e784f
--- /dev/null
+++ b/documentacoes/seguranca/README.md
@@ -0,0 +1,9 @@
+# Segurança
+
+Documentos de segurança do NÚCLEOS Enterprise: modelo de ameaças, controles, evidências do gate de segurança (seção 15 do [ADR consolidado](../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md)) e relatórios de auditoria.
+
+- Não registrar segredos, tokens, dados pessoais ou valores de `.env`; use `[REDACTED]`.
+- Decisões estruturais de segurança viram ADR em [arquitetura/adr](../arquitetura/adr/README.md).
+- Relatórios de review, auditoria e QA do fluxo de IA ficam em `documentacoes/reviews/`.
+
+Estado: pasta criada pela tarefa FND-008; ainda sem documentos de conteúdo.
diff --git a/documentacoes/transversal/2026-09-22-backlog-completo.md b/documentacoes/transversal/2026-09-22-backlog-completo.md
index 12e4611..2ef9625 100755
--- a/documentacoes/transversal/2026-09-22-backlog-completo.md
+++ b/documentacoes/transversal/2026-09-22-backlog-completo.md
@@ -8,6 +8,8 @@ Estado: proposta de planejamento; nenhum item deste documento afirma implementa
 Autores conhecidos: Vinícius (produto e especificação), Codex (decomposição)  
 Branch, commit-base e commits: não aplicável — a raiz ainda não é um repositório Git  
 
+> **Nota de substituição (2026-10-25) — status: Substituída em parte.** A **stack tecnológica** descrita neste backlog (.NET 10) foi substituída pelas decisões do [ADR de arquitetura de 2026-10-25](2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md) (NestJS/TypeScript, Python, React/Next.js; ver [ADR-004..006](../arquitetura/adr/README.md)). O restante (visão de produto, domínio, requisitos funcionais e regras de negócio) permanece como insumo, sujeito à consolidação da segunda parte do planejamento. Nenhum conteúdo original foi apagado. Origem: tarefa FND-008; questões Q-01 e Q-07 do [README do backlog](../backlog/README.md).
+
 > Este backlog cobre o produto completo. “Release” e “sprint” são marcos de construção e validação, não autorização para gastos, publicação, acesso a contas externas ou redução silenciosa de escopo.
 
 ## 1. Resumo executivo
```
