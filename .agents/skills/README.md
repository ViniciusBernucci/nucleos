# Fluxo de desenvolvimento com IA — V2

A fonte canônica desta distribuição é `skills/` no projeto de manutenção. As cópias `.agents/skills`, `.claude/skills` e `.agent/skills` incluem todos os recursos e o Contexto embarcado. Não há caminho fixo de drive, links globais obrigatórios ou instalação de MCP.

Planejamento: chame `planejador-de-lote`. Execução: chame `orquestrador-fluxo-ia` com o manifesto pronto. Planejar só inicia execução se esse pedido já estiver explícito. O Contexto é preparado pelo agente automaticamente e requer Node.js >=22.13/Git no host.

Leia o [protocolo V2](_shared/protocolo-v2.md) apenas na seção da fase atual e as regras locais aplicáveis. O runtime controla estados, dependências, worktrees, rodadas e eventos; o cliente chama agentes independentes para implementar, revisar, auditar e fazer QA. O fluxo não continua com o cliente fechado e não usa APIs extras de modelos.

Uma especificação canônica e planning-context.json preservam decisões/referências. O manifesto Markdown é acompanhado de JSON executável. O SQLite é a fonte operacional; Markdown é projeção. Revisões iniciais têm cobertura completa proporcional ao risco; correções e integração são focais, com IDs, hashes e evidências válidas preservadas. QA exige execução observada.

Bloqueios isolam tarefas e dependentes; independentes continuam. Integração usa branches revisao/, testes e gates independentes conforme risco. Limpeza só afeta worktrees do lote com ownership comprovado, sem force/remoção recursiva ou travessia de links. Branches e arquivos históricos são preservados. Publicação externa, push e PR continuam manuais.

## Catálogo de skills

| Skill | Papel principal | Não faz |
| --- | --- | --- |
| [`planejador-de-lote`](planejador-de-lote/SKILL.md) | Encadear `grill-me → tech-lead → worktree-planner` e gerar `lote-AAAA-MM-DD-{slug}.md` | Implementar código ou disparar execução sem pedido |
| [`grill-me`](grill-me/SKILL.md) | Entrevistar requisitos e decisões de produto antes da especificação | Inventar requisitos ou implementar |
| [`grill-with-docs`](grill-with-docs/SKILL.md) | Entrevistar demanda registrando decisões e glossário | Substituir `tech-lead` |
| [`tech-lead`](tech-lead/SKILL.md) | Transformar requisitos em tickets executáveis e dependências | Implementar ou aprovar entregas |
| [`worktree-planner`](worktree-planner/SKILL.md) | Gerar planos `00/01/02/99` e `estado-*` por feature | Criar worktrees ou rodar review |
| [`orquestrador-fluxo-ia`](orquestrador-fluxo-ia/SKILL.md) | Executar o lote sem checkpoints até integração, limpeza e pacote final | Fazer `git push`, abrir PR ou autoaprovar sem evidência |
| [`implementador-de-ticket`](implementador-de-ticket/SKILL.md) | Implementar escopo autorizado e correções delegadas (`APLICAR` / QA) | Auditar ou aprovar o próprio código |
| [`fechar-entrega`](fechar-entrega/SKILL.md) | Gravar registro de entrega com `clickup-resumo`, commitar sem push e emitir `FLUXO_EVENTO` | Fazer `git push`, abrir PR ou publicar no ClickUp |
| [`revisor-de-codigo`](revisor-de-codigo/SKILL.md) | Gate técnico único (correção/performance, qualidade e segurança) e revalidação focal | Editar código |
| [`auditor-de-review`](auditor-de-review/SKILL.md) | Auditar achados do review contra código, escopo e negócio (`APLICAR`, `ADIAR`, `REJEITAR`) | Editar código ou adiar bloqueante real confirmado |
| [`review-loop-driver`](review-loop-driver/SKILL.md) | Consolidar fila e delegar correções (`APLICAR` no lote; indicadas pelo usuário fora dele) | Marcar `VERIFICADO` sem revisor independente |
| [`revisor-de-qa`](revisor-de-qa/SKILL.md) | Validar critérios de aceite e regressões em sessão independente | Aprovar por leitura sem execução |
| [`arquiteto-de-software`](arquiteto-de-software/SKILL.md) | Definir/revisar arquitetura estrutural e ADRs | Planejar sprints ou implementar rotineiramente |
| [`security-audit`](security-audit/SKILL.md) | Auditoria de segurança ampla / modelo de ameaças | Aplicar correções automaticamente |
| [`simplify`](simplify/SKILL.md) | Refatorar legibilidade sob pedido sem alterar comportamento | Substituir `revisor-de-codigo` |


## Distribuição

Na raiz do projeto de manutenção, execute `node scripts/sincronizar-skills.mjs --check`, depois `--apply`, depois `--check`. Diagnóstico é obrigatório antes de aplicar. Arquivos extras e dados locais são preservados; SQLite não é distribuído. Os entrypoints antigos do planejador delegam ao mesmo sincronizador.

Veja também o guia `docs/fluxo-v2.md` da distribuição. Regras específicas da Intranet só se aplicam quando o projeto for explicitamente identificado por suas regras locais.
