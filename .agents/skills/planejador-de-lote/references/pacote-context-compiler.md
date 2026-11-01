# Saída obrigatória do planejador para o Context Compiler

Esta é a entrega padrão da chamada normal da skill. O usuário não precisa solicitar
cabeçalho, YAML ou catálogo. Planejar continua sem iniciar implementação.

## Arquivos finais

Para um lote `lote-X`, entregue juntos:

- `lote-X.md`: manifesto legível com cabeçalho `contexto` e corpo aprovado.
- `lote-X.workflow.yaml`: todas as etapas executoras, dependências, condições e providers.
- `lote-X.bindings.yaml`: caminhos reais das skills, executores, argv dos comandos e valores.

Use a pasta de planos do projeto e nomes exclusivos do lote. Caminhos do cabeçalho são
relativos ao manifesto; o helper grava o projeto e as skills com caminhos reais absolutos
do computador atual. Referências do JSON de entrada são relativas à pasta desse JSON.
Não reaproveite caminhos de outro computador nem invente comandos de teste.

O corpo do manifesto deve permitir executar sem a conversa anterior: identidade do lote,
objetivo, escopo/exclusões, decisões e origem da aprovação; por ticket, IDs, comportamento,
critérios observáveis, arquivos/contratos, dependências, validações e risco justificado;
raiz/base ref/SHA verificados, ordem e mapeamento **step ID → ticket/critério**; recursos,
preparação do ambiente na worktree, autorizações e bloqueios. Inclua o conteúdo essencial
da especificação. Links auxiliares devem ser verificáveis; o runtime envia o corpo do
manifesto, não a conversa de planejamento ou arquivos externos automaticamente.

O workflow começa depois do planejamento. Não inclua `planejador-de-lote`, entrevista ou
uma LLM orquestradora novamente. Cadastre cada executora por referência qualificada e
versão. Reutilize o catálogo explícito do projeto; se não existir, verifique os SKILL.md
no mesmo acervo desta skill e registre seus caminhos. Não exija que o usuário monte o catálogo.

Configure checks conforme os scripts e ferramentas do projeto, incluindo preparação de
dependências que não existem em uma worktree nova. Todo `command_ref` precisa de argv no
catálogo; toda `skill_ref` precisa de arquivo real e `executor_ref` cadastrado. Todo ref
de condição deve apontar para uma etapa existente ou uma chave de `bindings.values`.

No workflow software, checks permanecem obrigatórios; configure review por risco e QA em
R3/R4. Expresse o risco numericamente (0..4), conforme a classificação verificada. Use
concorrência 1 para mutações na mesma worktree enquanto não houver isolamento por ticket.
Se faltarem dados essenciais ou o fluxo exigir uma capacidade ainda não conectada ao
runtime, registre o bloqueio em vez de retirar gates ou marcar um plano incompleto como ready.

## Geração e validação automática

Grave `pacote-planejamento.json` como entrada do helper. Ele reaproveita o planejamento,
não toma decisões de produto. Exemplo mínimo de formato, a substituir pelos fatos reais:

```json
{
  "schema_version": 1,
  "status": "ready",
  "title": "Identificador e objetivo do lote",
  "project_root": "CAMINHO_REAL_DO_PROJETO",
  "isolation": "worktree",
  "body_file": "especificacao-aprovada.md",
  "workflow": {
    "schema_version": 1,
    "workflow": {"id": "software/execucao", "version": 1, "trigger": "manual"},
    "steps": [
      {"id": "implementar", "type": "skill", "skill_ref": "software/implementador-de-ticket@v1", "executor_ref": "codex/subscription"},
      {"id": "checks", "type": "command", "depends_on": ["implementar"], "command_ref": "project/checks"}
    ]
  },
  "bindings": {
    "schema_version": 1,
    "max_concurrency": 1,
    "skills": {"software/implementador-de-ticket@v1": "CAMINHO_REAL_DO_SKILL_MD"},
    "executors": {"codex/subscription": {"provider": "codex"}},
    "commands": {"project/checks": ["COMANDO_REAL", "ARGUMENTOS_REAIS"]},
    "values": {"task.final_risk_level": 0}
  }
}
```

Esse exemplo apenas mostra o contrato; não é um workflow padrão para todos os riscos.
Pode usar `body` com texto em vez de `body_file`, nunca ambos. Preserve os artefatos de
decisão já produzidos e reutilize-os; não gere documentação duplicada sem necessidade.

Execute o helper da pasta desta skill, sem pedir ao usuário que o invoque:

```text
node CAMINHO_DA_SKILL/scripts/gerar-pacote-go.mjs --input PACOTE.json --manifest PASTA_DO_LOTE/lote-X.md --contexto EXECUTAVEL_CONTEXTO
```

Localize o executável pela configuração do projeto, `CONTEXTO_CLI`, PATH ou pelo caminho
de instalação já verificado na sessão. Em um checkout de desenvolvimento com os dois
repositórios lado a lado, verifique também `context-compiler-v1/bin/contexto.exe` (Windows)
ou `context-compiler-v1/bin/contexto` ao lado do repositório de skills. Não pergunte um caminho
que já possa verificar. `--contexto` aceita um executável, não uma string
de shell como `go run ...`. Se a CLI estiver indisponível, registre `BLOQUEADO_POR_VALIDACAO`
e os rascunhos, sem declarar prontidão ou simular as validações.

O helper gera os arquivos em uma pasta temporária, chama o compilador real com
`plan validate` e `run --dry-run` e só publica os três arquivos quando ambos aprovam.
Não abre IA, não cria worktree de execução e não altera arquivos finais existentes.
Falhas preservam os planos anteriores e não deixam um novo manifesto final falso como ready.

Ao retornar `ready: true`, confira os caminhos publicados e entregue ao usuário o comando
`contexto run CAMINHO_ABSOLUTO_DO_MANIFESTO` (ou o executável absoluto se estiver fora do
PATH). Não imponha `--with claude`: sem override, cada etapa usa seu executor configurado.
Informe os três arquivos, validações realizadas e qualquer limitação material. Somente
execute `run` quando o usuário já tiver autorizado a implementação.
