# Origem da variante avulsa

Base histórica: commit e18f2e3 (primeiro commit do acervo), arquivos
skills/planejador-de-lote/SKILL.md, skills/grill-me/SKILL.md,
skills/tech-lead/SKILL.md e skills/worktree-planner/SKILL.md.
Também conferida a revisão c79d38d (V1.0.3), anterior à adaptação Go em 35925ae.

Restaurado o encadeamento clássico grill-me → tech-lead → worktree-planner.
A revisão c79d38d já exigia manifesto/runtime V2; por isso a base escolhida é anterior.

Adaptações intencionais para o pedido atual: nome planejador-de-lote-avulso; uso
portátil; referências próprias aos papéis originais; saída em Markdown sem manifesto
executável; remoção do acoplamento a compilador, runtime Node, indexação e lançamento
automático do orquestrador. Não é uma cópia byte a byte: são os papéis clássicos
preservados com esse isolamento operacional. Não se modificou o planejador atual.

O arquivo de origem é documentação histórica para conferência, não outra etapa.