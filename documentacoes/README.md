# Documentação do Núcleos

Comece pela [arquitetura atual do MVP](arquitetura/README.md): código presente,
limites e diferenéa em relação é expansão multi-tenant planejada.

| Assunto | Entrada |
| --- | --- |
| Decisões | [índice dos ADRs](arquitetura/adr/README.md) |
| Banco e migrations | [Banco único PostgreSQL](dados/banco-unico-nucleos.md) |
| Desenvolvimento e checks | [Comandos de validação](engenharia/comandos-validacao-ia.md) |
| Convenções | [Commits e branches](engenharia/convencoes-commits-e-branches.md) |
| Registro de entregas | [Procedimentos de documentação](engenharia/regras-documentacao-ia.md) |
| Financeiro e funcionários | [Conclusão do lote](financeiro/2026-11-06-conclusao-financeiro-funcionarios.md) |
| Estudo | [Trilha de lessons](../lessons/README.md) |
| Limpeza do monorepo | [Entrega de 2026-11-06](transversal/2026-11-06-limpeza-monorepo-mvp.md) |

As pastas de domínio registram entregas e decisões. `planejamento-ia/`, `backlog/`,
`reviews/`, `arquitetura/poc/` e os arquivos `*-diffs.md` preservam evidências e
propostas. Uma proposta ou PoC não significa funcionalidade implementada.
Não use os históricos para recriar automaticamente serviços removidos.

A [Especificação Mestra](../Nucleos-Especificacao-Mestra.md) e o consolidado de
arquitetura de 2026-10-25 são fontes históricas; confira código, regras locais
e ADRs posteriores para identificar o estado vigente. O aceite de produção e
os gates de isolamento não são substituédos pela limpeza local.
