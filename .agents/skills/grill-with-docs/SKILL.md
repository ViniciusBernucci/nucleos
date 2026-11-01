---
name: grill-with-docs
description: Entrevista uma demanda e registra decisões e vocabulário de domínio. Use quando o usuário pedir entrevista acompanhada de documentação.
---

# Entrevista documentada

Quando despachado com `CONTEXTO_EXECUTION=step`, siga primeiro o [contrato do Context Compiler](../_shared/context-compiler.md). Produza a documentação da etapa e registre questões essenciais pendentes como `BLOCKED`.

## Registro de execução e contexto compacto

Registre início/fim desta skill com identidade de sessão, agente e etapa conforme [observabilidade](../_shared/observabilidade.md). Antes de passar trabalho a outra sessão, use handoff por papel e checkpoint; envie IDs e referências em vez da conversa completa. Tokens indisponíveis ficam desconhecidos. Preserve a política de QA por risco em [perfis de risco](../_shared/perfis-de-risco.md).

## Reaproveitamento

Se entrevista, glossário e decisões já estiverem na especificação/contexto canônico, atualize esses artefatos; não gere outra cópia. ADR somente para decisão estrutural real. Devolva caminhos/IDs, sem repetir a documentação no handoff.

Resolva uma vez por projeto a [configuração local](../_shared/perfil-projeto.md). Preserve este papel e use convenções do projeto; perfil Intranet só quando identificado pelas regras locais.

Carregue grill-me e siga a entrevista. Grave as decisões e o glossário no padrão documental do projeto. Registre ADR apenas quando uma decisão estrutural real exigir e use arquiteto-de-software nesse caso. Não dependa de skills ausentes como “grilling” ou “domain-modeling”. No planejador-de-lote, devolva os caminhos ao coordenador e continue pelo tech-lead.
