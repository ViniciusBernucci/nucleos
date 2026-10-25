# EP-01 — Fundação do monorepo, ambientes e CI

> Prefixo: `ENT-FND` · Sprints: S00–S04 · Tickets: 9 · Detalhamento: [tickets.md](tickets.md)

## Objetivo

Entregar o esqueleto executável sobre o qual os demais épicos constroem: monorepo poliglota (TypeScript + Python), contratos compartilhados, ambientes local/staging/produção, pipeline de CI bloqueante, borda TLS, estrutura documental e base de observabilidade (logs estruturados, correlation ID, redação).

## Escopo

- Estrutura da seção 14 do ADR (`apps/`, `services/`, `packages/`, `infrastructure/`, `documentacoes/`, `lessons/`).
- Qualidade de código por linguagem, hooks e política de PR.
- Ambiente local com PostgreSQL, Redis e storage S3 local; overlays de staging/produção sem segredos no repositório.
- Pipeline com testes, análise estática, varredura de dependências/segredos/imagens.

## Fora do escopo

- Regras de negócio (EP-02+), hardening de host (EP-04), centralização de logs (EP-11).

## Tickets

| ID | Título | Sprint | Tam. | Risco | Depende de |
| --- | --- | --- | --- | --- | --- |
| [ENT-FND-001](tickets.md#ent-fnd-001) | Scaffolding do monorepo | S00 | M | MÉDIO | — |
| [ENT-FND-002](tickets.md#ent-fnd-002) | Padrões de qualidade, linters e hooks | S00 | S | BAIXO | FND-001 |
| [ENT-FND-008](tickets.md#ent-fnd-008) | Estrutura documental, templates de ADR e runbooks | S00 | S | BAIXO | — |
| [ENT-FND-003](tickets.md#ent-fnd-003) | Pacote de contratos com geração TS/Python | S01 | M | MÉDIO | FND-001, DEC-003, DEC-004 |
| [ENT-FND-004](tickets.md#ent-fnd-004) | Ambiente local com Docker Compose | S01 | M | MÉDIO | FND-001 |
| [ENT-FND-005](tickets.md#ent-fnd-005) | Pipeline de CI bloqueante | S01 | M | MÉDIO | FND-001, FND-002 |
| [ENT-FND-009](tickets.md#ent-fnd-009) | Baseline de observabilidade nos serviços | S01 | M | MÉDIO | FND-001 |
| [ENT-FND-006](tickets.md#ent-fnd-006) | Configuração tipada e ambientes staging/produção | S03 | M | ALTO | FND-004, DEC-006 |
| [ENT-FND-007](tickets.md#ent-fnd-007) | Borda: reverse proxy, TLS e cabeçalhos de segurança | S04 | S | MÉDIO | FND-006 |

## Critério de saída

Clone limpo → um comando sobe o ambiente local, `pnpm test` e a suíte Python passam, CI falha em violação de qualidade/segurança, e `docker inspect` do ambiente de teste não contém segredo.

## Riscos

- Escolha de gerenciador de pacotes/versões feita sem verificar a versão vigente na data de implementação → exigir *lock files* e registro das versões em FND-001.
- Poliglotismo dobra a manutenção de tooling; mitigado por scripts únicos na raiz (`make`/`task`) e por CI com jobs paralelos por linguagem.
