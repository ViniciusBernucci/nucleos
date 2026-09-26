# Fluxo de desenvolvimento com IA

As skills orientam o trabalho; os agentes existentes podem executar papéis especializados. A presença de ambos não exige duas revisões do mesmo escopo. Os arquivos dos agentes e o AGENTS.md foram preservados.

## Qual usar

| Intenção | Entrada | Resultado / limite |
| --- | --- | --- |
| Definir ou revisar arquitetura | `arquiteto-de-software` | Decisões, ADRs e handoff proporcional ao pedido |
| Planejar e priorizar execução | `tech-lead` | Roadmap, tickets, dependências e acompanhamento |
| Planejar isolamento operacional | `worktree-planner` | Worktrees, contratos e prompts; não implementa |
| Implementar um ticket | `implementador-de-ticket` | Código, testes e evidências; não aprova a própria entrega |
| Revisar uma implementação | `revisor-de-codigo` | Achados e plano; não altera código |
| Auditar segurança do sistema | `security-audit` | Modelo de ameaças e auditoria ampla; correções só se solicitadas |
| Organizar correções de reviews | `review-loop-driver` | Fila e prompt por item; não executa a correção |
| Aplicar simplificação solicitada | `simplify` | Refatoração que preserva comportamento |
| Validar critérios de aceite | `revisor-de-qa` | Cenários, evidências, bugs e resultado funcional |
| Registrar e fechar sessão | `fechar-entrega` | Registro e commit quando autorizado; não publica nem aprova |

Fluxo típico: arquitetura quando necessária → planejamento → isolamento quando necessário → implementação → revisão técnica → correções/revalidação → QA → fechamento. A ordem do commit segue o projeto: o perfil Intranet preserva revisão após o commit da implementação. Commit local não significa entrega aprovada.

## Agentes e skill de revisão

[revisor-de-codigo/SKILL.md](revisor-de-codigo/SKILL.md) é a entrada única, com critérios adaptados dos agentes:

| Pedido | Modo da skill | Agente equivalente |
| --- | --- | --- |
| “Revise esta implementação” | Completa: três especialidades | Especialistas, sem duplicar a mesma análise |
| “Tem bug? Vai quebrar? Tem N+1?” | Correção e performance | `code-reviewer` |
| “Está seguindo os padrões?” | Qualidade e arquitetura | `clean-code-reviewer` |
| “Revise a segurança deste diff” | Segurança | `security-reviewer` |

A skill funciona sem registro dos agentes e sem `_shared/escopo-revisao.md`. Se o protocolo compartilhado existir no projeto, deve ser lido. Sua ausência não deve ser disfarçada: o protocolo portátil está na própria skill.

O agente `debugger` continua sendo o caminho para investigação de um bug específico; `review-guide` continua preparando revisão humana. Nenhum foi alterado nem duplicado em nova skill.

Exemplos:

- `$revisor-de-codigo revise as alterações staged e unstaged deste ticket.`
- `$revisor-de-codigo revise apenas correção e performance da branch contra a base informada.`
- `$review-loop-driver organize estes relatórios em uma fila, sem corrigir código.`
- `$simplify aplique a refatoração de legibilidade descrita neste item.`

## Convenções específicas

Os caminhos Windows, contratos ClickUp e fluxo Orca ficaram em referências carregadas apenas para a Intranet:

- [Planejamento Intranet](worktree-planner/references/intranet.md).
- [Fechamento Intranet](fechar-entrega/references/intranet.md).

As regras validadas de N requisições no fluxo PN e restrições de banco de produção permanecem no contexto Intranet. Não são regras universais para qualquer stack. A classificação de um achado de segurança depende do impacto; não vira CRÍTICO apenas por ser segurança.

## Ajustes de compatibilidade

- Pasta `revisr-de-qa` → `revisor-de-qa`.
- Pasta `implementador-de-tickets` → `implementador-de-ticket`, preservando o nome já usado no frontmatter e no AGENTS.md.
- `tech-lead/SKILL.md`, antes vazio, foi preenchido.
- Não há uma segunda skill `code-reviewer`: seus critérios estão consolidados nas referências do revisor.
- Relatórios antigos `clean-code-*` e `clean-code-review-*` são aceitos pela fila.

Se houver instalações, links simbólicos ou automações externas apontando para os nomes antigos das pastas, atualize esses caminhos ao distribuir este conjunto. Esta revisão modificou somente esta pasta; não instalou as skills globalmente.

## Verificação desta revisão

Foram conferidos frontmatter YAML, nomes/pastas, descrições, referências locais e preservação por hash dos agentes e arquivos de governança. A revisão das instruções cobriu staged/unstaged, base explícita, ausência de protocolo compartilhado, QA sem ambiente e separação entre diagnosticar, corrigir e aprovar.

O validador padrão `quick_validate.py` não executou por ausência de PyYAML; a estrutura foi verificada com o parser YAML do Ruby disponível no ambiente. Essas verificações não substituem testes de uso real das skills em projetos.

Cópia anterior à alteração: `/tmp/skills-consolidacao-original` (temporária; não é instalação nem backup permanente).
