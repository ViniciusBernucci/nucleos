# Execução de uma etapa pelo Context Compiler Go

Aplica-se somente a despachos com CONTEXTO_EXECUTION=step. O runtime Go controla
sequência, dependências, gates, concorrência, estado, limites, logs e retomada.
Na chamada direta da skill, preserve seu papel e as regras locais.

Execute somente o step/ticket recebido na worktree indicada. Não encadeie skills,
orquestrador-fluxo-ia, outros CLIs de IA nem flow claim/next/event. Não rode preparação,
indexação, process/handoff/checkpoint do Contexto Node legado nesse modo. Instruções
legadas de encadeamento não transferem a coordenação ao agente. Não faça commits
sem autorização explícita do projeto/usuário.

## Contexto proporcional

Comece pelo brief aprovado, regras obrigatórias e fontes incluídas. Preserve regras de
negócio, segurança, dados, documentação e independência de revisão/QA. Não releia regras
já incluídas sem motivo. Referências available são índice para consulta sob demanda,
não uma lista de leitura. Abra arquivos/faixas pertinentes a uma dependência concreta.
Não despeje lockfiles, catálogos, logs, histórico, diffs ou documentação inteira no contexto.
Não refaça planejamento, outros tickets ou etapas. Lacuna essencial, conflito ou gate
sem evidência exige BLOCKED com causa precisa. Não investigue indefinidamente.
Registre progresso e pendências no artefato local. Subagentes exigem autorização explícita
no despacho e capacidade do executor.

## Resultado

Retorne somente JSON, sem cercas Markdown:
{"status":"PASS","summary":"Trabalho e verificações reais, limitações.","artifacts":[{"path":"docs/relatorio-da-etapa.md"}]}

Status: PASS, FAIL ou BLOCKED. Caminhos relativos à worktree; PASS exige arquivo existente
e evidência real. Informe caminhos: o runtime calcula SHA-256 a partir dos bytes. Não
calcule/transcreva hashes na resposta. Hash legado fornecido continua sujeito a validação.
Exit code zero não comprova critérios, testes ou QA. Não copie segredos nem invente métricas.

## Interrupção

Pausa, timeout ou orçamento preservam worktree e checkpoint. Na retomada, inspecione o
trabalho existente e implemente somente o que falta. Arquivo alterado não significa critério
concluído. Não apague nem recomece automaticamente. O runtime fornece contexto compacto
e registra o ID nativo, sem reenviar a conversa inteira.
Falha exclusivamente na finalização dos artefatos é tratada por recover, sem chamar IA
ou repetir implementação. Isso não dispensa os checks e a revisão previstos no snapshot. No fluxo enxuto, testes de tela são manuais e ficam pendentes.
Não contorne bloqueios nem altere o snapshot. Recomendar próxima ação não autoriza executá-la.

Em flow.profile=enxuto-v1, aplica-se o [fluxo enxuto](fluxo-enxuto.md). A revisão corretiva autorizada pode editar e testar dentro do próprio step, sem auditor intermediário. Não importar gates do Node legado. Não faça commits/merges pela IA: o comando determinístico de entrega faz as ações locais autorizadas no manifesto. DONE técnico não aprova testes manuais de tela.