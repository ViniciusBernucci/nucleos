---
name: token-observatory
description: Registra e analisa uso de Claude Code e Codex CLI, skills, agentes e etapas com SQLite local, sem APIs pagas. Use para instrumentar sessões e investigar consumo ou retrabalho; contadores indisponíveis permanecem desconhecidos.
---

# Observatório de Tokens

Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Entregue o relatório solicitado e métricas observadas, sem assumir coordenação de outras etapas.

Resolva o runtime Python distribuído em `../_shared/observatory/token_observatory.py`. Não é preciso instalar MCP, dependências Python ou APIs de modelos. Use a autenticação existente dos CLIs. Não altere permissões ou configuração global das contas.

Inicie a sessão por `python RUNTIME run --provider claude|codex --project-dir RAIZ --skill SKILL --role PAPEL --batch LOTE --ticket TICKET -- CLI ...`. Codex exige `exec --json`; contadores do Codex interativo não são capturados por este runner. No Windows, descubra o executável real `.cmd` e passe seu caminho como argumento, sem montar comandos com dados não escapados. Não acrescente flags para desativar aprovações.

Todas as skills registram atividade conforme [observabilidade](../_shared/observabilidade.md), sem armazenar prompts, respostas ou segredos. O runner importa metadados do Contexto da pasta atual ao terminar; worktrees executadas em outras pastas precisam de `import-context SQLITE --project-dir RAIZ` próprio. A importação é idempotente e não insere tokens estimados.

Use `report --by skill|agent|role|ticket|batch|provider|project --project-dir RAIZ --json` para contadores nativos. Use `process-report --by skill|agent|stage|session|parent --project-dir RAIZ` para atividade, falhas e duração. Use `quality-report --project-dir RAIZ` para achados novos/resolvidos, critérios comprovados, SHAs, leituras repetidas observadas pelo Contexto e evolução das requisições.

Relacione tokens e qualidade apenas quando projeto, provedor, sessão, skill e agente forem explícitos e coincidentes. Sem esse vínculo, mostre null/desconhecido; não rateie tokens de sessão compartilhada. Cache lido/criado fica separado; reasoning não é somado de novo. Evite importar o mesmo trabalho por wrapper e por arquivo manual: os formatos nativos podem não fornecer ID de requisição para deduplicar fontes distintas com segurança.

Não atribua redução de bytes à cota da assinatura nem prometa economia sem comparações equivalentes, cobertura e análise de defeitos/retrabalho. Esta skill observa o processo; não altera os gates de review, auditoria ou QA por risco.
