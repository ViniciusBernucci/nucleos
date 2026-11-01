# Pacote executável do fluxo enxuto

O planejador publica manifesto Markdown, workflow YAML e bindings YAML. O usuário só
precisa iniciar context run depois. O helper monta o DAG: unidades sequenciais e checks,
uma revisão corretiva, checks integrados, entrega local. Não abre IA nem executa o lote
durante o planejamento. Não inclui approval/wait_event/QA de tela.

## Entrada do helper

Grave um JSON com os fatos verificados do planejamento:

```json
{
  "schema_version": 1,
  "status": "ready",
  "flow_profile": "enxuto-v1",
  "title": "Lote identificado",
  "project_root": "CAMINHO_REAL_DO_PROJETO",
  "isolation": "worktree",
  "body_file": "especificacao-aprovada.md",
  "workflow_ref": {"id": "software/lote-identificado", "version": 1},
  "local_git_authorized": true,
  "delivery_branch": "revisao/lote-identificado",
  "implementation_executor": "claude/subscription",
  "review_executor": "claude/subscription",
  "units": [{
    "id": "t1",
    "ticket_id": "T1",
    "risk_level": 3,
    "objective": "Comportamento aprovado",
    "scope": ["Arquivos e contratos pertinentes"],
    "acceptance": ["AC-1: critério verificável"],
    "instructions": "Regras, contratos, decisões e verificações essenciais desta unidade",
    "required": [],
    "initial": [],
    "available": [],
    "checks": ["project/check-unit"]
  }],
  "review_context": {
    "ticket_id": "LOTE-REVIEW",
    "objective": "Conferir e corrigir impactos médios/altos/críticos do conjunto",
    "scope": ["Diff do lote e contratos afetados"],
    "acceptance": ["Nenhum problema demonstrado médio/alto/crítico pendente"],
    "instructions": "Base SHA REAL; critérios consolidados; superfícies críticas; comandos de testes e fontes pertinentes",
    "required": [],
    "initial": [],
    "available": []
  },
  "final_checks": ["project/check-integrated"],
  "manual_screen_tests": ["Pré-condição e cenário de tela com resultado esperado"],
  "bindings": {
    "schema_version": 1,
    "execution": {"profile": "compiled", "effort": "medium"},
    "skills": {
      "software/implementador-de-ticket@v1": "CAMINHO_REAL_DA_SKILL",
      "software/revisor-de-codigo@v1": "CAMINHO_REAL_DA_SKILL"
    },
    "executors": {"claude/subscription": {"provider": "claude"}},
    "commands": {
      "project/check-unit": ["COMANDO_REAL", "ARGUMENTOS"],
      "project/check-integrated": ["COMANDO_REAL", "ARGUMENTOS"]
    },
    "values": {}
  }
}
```

O exemplo mostra formato, não comandos/caminhos reais. Resolve-os pelo repositório.
body ou body_file, nunca ambos. Localize as skills do mesmo acervo e a CLI Go, sem
pedir ao usuário para montar o catálogo. Cada unidade tem checks não vazios.
depends_on pode referir unidades anteriores; o padrão executa em sequência, sem paralelo.

Use uma unidade por comportamento coerente; não fragmente por arquivo. O padrão usa uma
worktree por lote. Não declare branch/worktree por unidade nesse perfil. Frentes realmente
paralelas exigem workflow custom explícito com suporte operacional verificado; não use
custom para contornar a política enxuta. No perfil custom, workflow e step_contexts
continuam sendo informados explicitamente e mantêm as validações do compilador.

A revisão é obrigatória por padrão. review:"skip-low-risk" só é aceito se todas as
unidades forem risk_level:0 e houver review_skip_reason. Não reduza risco para dispensá-la.
review_context deve conter critérios e base reais, sem exigir que o revisor releia
todos os planos. Sua sessão pode corrigir dentro do escopo em um ciclo, sem auditor.

manual_screen_tests contém cenários com pré-condição, ação e resultado. Sem alteração
de tela, informe [] e manual_screen_tests_na com justificativa. Não inclua Playwright,
Cypress ou Selenium nos checks de tela do perfil atual. Testes automatizados de código,
API, contratos e regressões continuam previstos conforme pertinência.

## Contexto, recursos e autorização

O helper gera step_contexts a partir das unidades e do brief de revisão; ele não inventa
requisitos. Paths required/initial/available são relativos à raiz Git, com faixas
start_line/end_line opcionais. Required precisa existir na base e caber no orçamento.
Initial pode ser omitido; available é índice. Não inclua segredos nem catálogos inteiros.

Limites finitos e checkpoints do compilador continuam ativos; personalize execution.limits
ou unit.limits proporcionalmente ao trabalho. USD nativo só no Claude, nunca teto global
num lote com outros providers. Não adicione outra LLM para coordenar/resumir o contexto.

local_git_authorized:true descreve a proposta: o manifesto informa que chamar run
autoriza commits e branch locais previstos. Não afirma que o usuário já executou ou
aprovou o lote durante a geração. O planejador termina no pacote e não chama run.
Não há checkpoints humanos entre etapas; bloqueio real continua sendo reportado.
Não autoriza push, PR, publicação ou merge em main/master.

## Geração

```text
node CAMINHO_DA_SKILL/scripts/gerar-pacote-go.mjs --input pacote.json --manifest PASTA/lote.md --contexto EXECUTAVEL_GO
```

O helper valida projeto, Git/base, referências, briefs, comandos e risco; monta o YAML;
chama plan validate e run --dry-run com o binário real. Só publica os três arquivos após
aprovação. Não sobrescreve arquivos existentes. Sem CLI Go, preserve rascunhos e informe
bloqueio de validação, sem marcar ready. Não confunda a CLI Go com contexto.mjs legado.

A etapa local_delivery usa o helper determinístico do mesmo acervo. Ele exige worktree
do runtime e branch contexto/ ou a mesma revisao/, recusa conflitos e branch de destino
já existente, registra roteiro manual, cria commit local e renomeia a branch para revisao/.
Não há merge entre unidades porque elas compartilham a mesma worktree. Não atribua esse
helper à integração de múltiplas worktrees: esse fluxo exige outro contrato explícito.

Ao finalizar, a branch conserva documentacoes/entregas-ia/testes-manuais.md como
PENDENTE_DE_TESTES_MANUAIS_DE_TELA. DONE do runtime é conclusão técnica, não QA visual.
Snapshots históricos não são regenerados nem modificados automaticamente.