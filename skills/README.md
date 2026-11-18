# Skills do Nucleos

A fonte canônica é `skills/skills/`, relativa à raiz do repositório. Em 2026-11-06,
ela foi substituída pelas cinco skills fornecidas em
`C:/Users/vinicius.silva/Documents/Documentos/00 - Dev/docker-intranet/app/.claude/skills`.
Os 11 arquivos foram preservados sem alteração, incluindo metadados de descoberta
e o checklist do revisor.

| Skill | Uso |
| --- | --- |
| `arquiteto-de-software` | Investigar e revisar decisões de arquitetura |
| `grill-me` | Entrevistar requisitos e critérios de aceite |
| `planejador-de-lote-v1` | Encadear entrevista, especificação e plano Markdown |
| `tech-lead` | Especificar tickets, contratos, dependências e riscos |
| `worktree-planner` | Preparar prompts por frente e plano de integração |
| `revisor-de-codigo` | Revisar e corrigir achados médios, altos e críticos em um ciclo |

## Descoberta e sincronização

| Cliente | Pasta na raiz do projeto |
| --- | --- |
| Claude Code | `.claude/skills/` |
| Codex e Antigravity | `.agents/skills/` |
| Antigravity legado | `.agent/skills/` |

Edite somente a fonte e execute na raiz:

```sh
node scripts/instalar-skills.mjs --apply
node scripts/instalar-skills.mjs --check
```

O `--check` compara bytes e reprova arquivos ausentes, diferentes ou extras.
O `--apply` atualiza as cópias sem apagar extras; a instalação limpa inicial
retirou previamente todas as pastas antigas. Não há cópias de descoberta dentro
de `skills/.agents/`, `skills/.claude/` ou `skills/.agent/`. O entrypoint
`skills/scripts/sincronizar-skills.mjs` delega ao instalador da raiz.

As regras de [AGENTS.md](../AGENTS.md#aplicação-das-skills-importadas-neste-projeto)
definem a aplicação no monorepo NestJS/Next.js/Python/PostgreSQL, os caminhos locais
e os limites de Git e dados. As referências específicas da Intranet nos arquivos
recebidos não alteram essas regras. A instalação não inclui o antigo runtime
`_shared/contexto` nem inicia execução ou configuração de ferramentas externas.

Recarregue o projeto ou abra uma nova sessão nos clientes após a substituição.
As pastas e os metadados foram preparados para descoberta; a execução nos aplicativos
depende da sessão e das ferramentas disponíveis em cada cliente.

Em 2026-11-06, a limpeza do monorepo também incorporou à fonte a skill
`arquiteto-de-software`, já presente nas três pastas de descoberta (total: seis skills).
Os antigos modelos de regras em `skills/modelos/` foram retirados por descreverem
o fluxo anterior. As referências `_shared/` citadas pelo arquiteto não vieram na distribuição
disponível; não há runtime ou helpers desses links instalados. O roteiro arquitetural
foi preservado com a skill.
As regras de projeto e o corpo da skill continuam disponíveis.
