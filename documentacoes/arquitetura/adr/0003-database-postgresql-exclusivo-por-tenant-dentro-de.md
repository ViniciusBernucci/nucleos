# ADR-003 — **Database PostgreSQL exclusivo por tenant** dentro de instância compartilhada no MVP

> **Importado sem alteração de conteúdo** da seção 2.2 de [o documento consolidado](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md#22-adrs-architecture-decision-records-consolidados) (versão 1.0, 2026-10-25). O documento original permanece como fonte preservada; em caso de divergência, o texto do original prevalece até decisão formal em novo ADR.

- **Status:** Aceito como baseline de implementação, sujeito a validação de segurança e benchmarks antes de produção (status declarado no documento consolidado).
- **Data:** 2026-10-25

## Decisão

**Database PostgreSQL exclusivo por tenant** dentro de instância compartilhada no MVP

## Justificativa

Impede acesso cruzado via credenciais de aplicação

## Consequência

Provisionamento de database/roles e migrações individuais

## Seções do template sem conteúdo na fonte

Contexto, Problema, Alternativas, Benefícios, Trade-offs e Quando revisar não constam da fonte consolidada, que traz apenas decisão, justificativa e consequência por ADR; não foram inventados. O contexto geral está nas seções 1 e 2.1 do documento consolidado. Complementos devem ser feitos em novo ADR que substitua ou refine este (ver [template](0000-template.md)).
