# Registro de decisões de arquitetura (ADR)

Os ADR-001..015 foram importados do [documento consolidado de 2026-10-25](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md), que permanece intacto como fonte. Novos ADR (ADR-016 em diante) usam o [template](0000-template.md).

**Stack vigente:** TypeScript (NestJS/Next.js) e Python, conforme ADR-004..006. A divergência com a Especificação Mestra e o backlog de 2026-09-22 (.NET 10) está resolvida a favor do ADR; a questão Q-01 do [README do backlog](../../backlog/README.md) foi decidida pelo usuário (stack TypeScript + Python); a atualização de `CLAUDE.md`, `AGENTS.md` e `lessons/` é da tarefa LOC-001, fora desta entrega.

| ID | Decisão |
| --- | --- |
| ADR-001 | [SaaS com Control Plane central e Data Plane por tenant](0001-saas-com-control-plane-central-e-data.md) |
| ADR-002 | [Runtime **dedicado por empresa**, em container; máquinas compartilhadas](0002-runtime-dedicado-por-empresa-em-container-maquinas.md) |
| ADR-003 | [**Database PostgreSQL exclusivo por tenant** dentro de instância compartilhada no MVP](0003-database-postgresql-exclusivo-por-tenant-dentro-de.md) |
| ADR-004 | [NestJS + TypeScript para Control Plane](0004-nestjs-typescript-para-control-plane.md) |
| ADR-005 | [Python para Tenant Runtime de IA](0005-python-para-tenant-runtime-de-ia.md) |
| ADR-006 | [React + Next.js; React Three Fiber + Three.js para 3D](0006-react-next-js-react-three-fiber-three.md) |
| ADR-007 | [LLMs inicialmente via APIs externas, por gateway](0007-llms-inicialmente-via-apis-externas-por-gateway.md) |
| ADR-008 | [PostgreSQL + pgvector; Redis para cache/auxiliares; armazenamento de objetos para arquivos](0008-postgresql-pgvector-redis-para-cache-auxiliares-armazenamento.md) |
| ADR-009 | [Execuções de IA assíncronas e duráveis](0009-execucoes-de-ia-assincronas-e-duraveis.md) |
| ADR-010 | [Docker Compose no MVP, com especificação declarativa migrável](0010-docker-compose-no-mvp-com-especificacao-declarativa.md) |
| ADR-011 | [Escala horizontal por tenant e por pool de workers](0011-escala-horizontal-por-tenant-e-por-pool.md) |
| ADR-012 | [**Deny-by-default e autorização externa ao LLM**](0012-deny-by-default-e-autorizacao-externa-ao.md) |
| ADR-013 | [Execução arbitrária de código fora do runtime principal](0013-execucao-arbitraria-de-codigo-fora-do-runtime.md) |
| ADR-014 | [Nenhum acesso de rede entre tenants por padrão](0014-nenhum-acesso-de-rede-entre-tenants-por.md) |
| ADR-015 | [Custos por tenant e por agente obrigatoriamente rastreados](0015-custos-por-tenant-e-por-agente-obrigatoriamente.md) |
