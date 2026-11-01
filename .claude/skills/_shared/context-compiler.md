# Execução de uma etapa pelo Context Compiler Go

Este contrato se aplica quando o despacho contém `CONTEXTO_EXECUTION=step`, com run, step,
skill congelada, workdir, plano aprovado e handoff das dependências. Nas chamadas diretas,
preserve o papel da skill e as regras locais. Não mantenha uma segunda cópia da skill.

O runtime controla sequência, dependências, concorrência, claims, esperas, retries, gates e
persistência. Execute somente a etapa recebida. Não chame outras skills para avançar o
workflow; não invoque `orquestrador-fluxo-ia`, `flow claim/next/event`, nem os registros do
runtime Node legado. As orientações de encadeamento existentes nesta skill pertencem ao
uso direto/legado e não transferem a coordenação de volta ao agente durante um despacho Go.

Use a worktree fornecida. Consulte as regras do projeto e as referências especializadas
necessárias, sem refazer entrevista ou planejamento aprovados. Retorne bloqueio se faltar
informação essencial, autorização, ferramenta ou evidência. Não inicie review, auditoria,
QA, correção ou fechamento que pertençam a outra etapa. Revisão continua independente da
implementação; o workflow configura review por risco e QA obrigatório em R3/R4.

Produza os artefatos da etapa e retorne somente este JSON, sem cercas Markdown:

```json
{
  "status": "PASS",
  "summary": "O que foi executado e quais evidências comprovam o resultado.",
  "artifacts": [
    {"path": "docs/relatorio-da-etapa.md", "sha256": "SHA256_REAL_DO_ARQUIVO"}
  ]
}
```

`status` aceita `PASS`, `FAIL` e `BLOCKED`. `PASS` exige pelo menos um arquivo existente na
worktree e seu hash SHA-256 real. Use caminhos relativos à worktree. Artefatos externos
devem ser referenciados no relatório local, sem copiar segredos. O processo terminar com
exit code zero não comprova a execução. Testes exigidos não executados, permissões negadas
ou resultados inconclusivos não são `PASS`. O runtime valida o contrato e os hashes, grava
o resultado e decide o próximo passo. Não invente métricas de consumo.

Uma skill executora pode recomendar uma próxima ação no relatório; essa recomendação não
autoriza executá-la. Se o YAML precisar de outra etapa ou de um ciclo de correção, informe
a lacuna para alteração explícita da configuração. A execução em andamento usa o snapshot
com o qual começou.
