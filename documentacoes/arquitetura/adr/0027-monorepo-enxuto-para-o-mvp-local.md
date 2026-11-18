# ADR-027 — Monorepo enxuto para o MVP local

- **Status:** Proposto para a topologia futura; limpeza do scaffolding local implementada por pedido humano.
- **Data:** 2026-11-06
- **Decisores:** usuário autorizou refatoração e exclusão do inútil; novos limites de produção não foram aceitos.
- **Origem:** pedido de limpeza com a skill arquiteto-de-software.

## Contexto e evidências

O [consolidado de 2026-10-25](../../transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md)
prevê runtimes dedicados, provisioner e gateways separados. No código observado,
API, web e gateway CFO implementam negócio. Provisioner, tenant-runtime,
tool-gateway e event-dispatcher apenas implementavam probes, telemetria e testes
dessas probes. O motor de tarefas duráveis e as ferramentas financeiras já estão
na API/gateway, sem consumir os esboços. As reservas Terraform/Ansible/Kubernetes
continham apenas README.

O banco único com schemas é a regra local vigente, conforme
[banco único](../../dados/banco-unico-nucleos.md); esta limpeza não altera dados.

## Mudança aplicada ao checkout local

Manter `apps/web`, `apps/api`, `services/ai-gateway`, pacotes utilizados e Docker.
Retirar os quatro esboços dos workspaces, lockfiles, Compose, scripts e checks.
Preservar negócio, migrations, contratos e gates de segurança.
A regra Python passa a impedir pacotes compartilhados de importar `ai_gateway`
e contratos de importar outros pacotes internos, com fixtures negativas.

## Proposta e conflito com o baseline

A árvore da seção 14 do consolidado deve ser referência de evolução, sem obrigar
processos vazios no desenvolvimento. Os ADRs 002/005/018/025 continuam descrevendo
fronteiras do produto multi-tenant conforme seu status. A remoção das probes não
implementa nem dispensa essas fronteiras. Os documentos anteriores são preservados.

Aceitar uma topologia simplificada para produção requer decisão humana sobre
isolamento, identidade e autorização, além dos testes. A IA não marca o ADR como
aceito nem altera silenciosamente os ADRs anteriores.

## Alternativas e consequências

| Alternativa | Avaliação |
| --- | --- |
| Manter servidores de probes | Mais processos/builds, sem oferecer o isolamento prometido |
| Mover todo Python para NestJS | Reescreve negócio e muda stack aprovada sem necessidade |
| Criar novas camadas e serviços | Aumenta a complexidade que motivou o pedido |
| Retirar esboços e manter módulos/pacotes usados | Menor mudança operacional preservando funcionalidades |

Três componentes em vez de sete no launcher/Compose. As portas 3002, 8001, 8003 e
8004 deixam de ser disponibilizadas pelos scripts; não havia consumidores de negócio
no código. Testes exclusivos dos esboços saem; testes do produto e gates permanecem.

Não há exclusão de banco, volume, migration, dado ou credencial. Serviços auxiliares
e overlays permanecem. Para rollback, restaure fontes/configurações e importers
pelos [diffs próprios da entrega](../../transversal/2026-11-06-limpeza-monorepo-mvp-diffs.md).

## Quando revisar

Antes de provisionar clientes externos, executar ferramentas com escrita, oferecer
isolamento por tenant ou separar workers por necessidade medida de disponibilidade
ou escala. Um nome na árvore histórica não justifica recriar um serviço.
