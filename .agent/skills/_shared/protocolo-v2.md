# Protocolo V2 — execução e contexto integrados

O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.

Consulte apenas a seção da próxima ação. `contexto/contexto.mjs --help` lista comandos; os testes em `contexto/tests/` fornecem exemplos executáveis completos. Este protocolo complementa risco, regras locais e proteções de banco; não concede publicação externa.

## Inicialização automática

Requer Node.js >=22.13 com `node:sqlite` e Git no PATH. Não usa npm, API de modelo, embeddings nem cadastro de MCP. A skill chama `scripts/preparar-contexto.mjs --project RAIZ_GIT_REAL`; esse helper chama o Contexto incluído em `_shared/contexto`. Não peça ao usuário `init`, `setup` ou configuração de servidor. Sem runtime/permissão, registre o bloqueio real.

`ensure` registra metadados locais, preserva configuração e prepara o índice. Não instala hooks por padrão, não altera configuração global nem arquivos rastreados. Em main/master, só prepara dados locais; gates, implementação e integração exigem branches de trabalho. `CONTEXTO_CLI` é override explícito opcional; não é necessário.

O primeiro diretório existente da lista abaixo determina o armazenamento, independentemente do cliente que chama a skill:

1. `skills/_shared/.contexto/` na fonte das skills;
2. `.agents/skills/_shared/.contexto/`;
3. `.claude/skills/_shared/.contexto/`;
4. `.agent/skills/_shared/.contexto/`.

Sem esses diretórios, crie apenas o armazenamento em `.agents/skills/_shared/.contexto/`. Uma configuração existente em `RAIZ/.contexto/` continua sendo usada; não migre/copie aprovações silenciosamente. Dois bancos/configurações da mesma raiz são erro, não fontes concorrentes. A preparação devolve `prepared:true`, raiz e caminho absoluto do SQLite. Metadados Git `info/exclude` mantêm os dados locais fora do Git. Cada worktree tem identidade e banco próprios; nunca distribua `.contexto` com as skills.

## Planejamento canônico

Preserve o manifesto Markdown e as convenções do projeto. Gere ao lado dele:

- `planning-context.json`: `schema:1`, `batch_id`, `decisions` (ID, origem, fato/decisão/hipótese, referência), `open_questions`, `specifications` (tarefa e caminho), `contracts` e `dependencies`. Preserve IDs e atualize o mesmo arquivo por lote; não copie documentos inteiros.
- `lote-<id>.json`: entrada executável para `flow load`. Caminhos são absolutos reais, derivados da máquina atual; Git usa SHAs completos. Não deixe placeholders executáveis.

Formato do manifesto JSON (campos obrigatórios):

```json
{
  "schema": 1,
  "id": "LOTE-1",
  "tasks": [{
    "id": "T1", "ticket": "TICKET-1",
    "repository": "/caminho/real/repo",
    "root": "/caminho/real/worktrees/t1",
    "branch": "feature/t1", "base_sha": "SHA_COMPLETO_REAL",
    "dependencies": [],
    "definition": {
      "id": "T1", "profile": "padrao", "risk_level": "R2",
      "rationale": "Justificativa concreta do comportamento e impacto.",
      "risk_factors": ["functional"],
      "criteria": ["AC-01"],
      "sources": ["docs/especificacao-t1.md"]
    }
  }],
  "integrations": [{
    "id": "GRUPO-1", "repository": "/caminho/real/repo",
    "root": "/caminho/real/worktrees/revisao-lote1",
    "branch": "revisao/lote1", "base_sha": "SHA_COMPLETO_REAL",
    "members": ["T1"]
  }]
}
```

Este exemplo é um contrato, não um comando pronto. `sources` aponta para arquivos existentes na base; arquivos novos de implementação são cobertos pelo snapshot Git completo. Para especificação canônica externa à camada (por exemplo a pasta de planos central da Intranet), declare `external_sources:[{root:RAIZ_REAL_CONFIRMADA,source:CAMINHO_RELATIVO_POSIX}]` e `spec` como referência. O runtime preserva os hashes dessas fontes no snapshot, sem copiar documentos ou ampliar a indexação. Nesse caso sources pode ser vazio; a árvore Git inteira continua coberta. Não copie nem altere critérios para satisfazer a validação. Cada tarefa pertence a um grupo Git; backend/frontend usam grupos distintos e o mesmo `ticket` para compartilhar os limites de rodadas. `dependencies` são IDs deste lote. A skill valida também contratos entre grupos/repositórios. Plano legado sem classificação explícita continua crítico.

## Coordenador e próxima ação

Na raiz coordenadora preparada, use a CLI embarcada com `--project` explícito:

1. `flow load --file MANIFESTO_JSON`: importa uma definição imutável, validando DAG, bases e grupos; repetir o mesmo manifesto é idempotente.
2. `flow claim --batch ID --session SESSAO_COORDENADORA`: assume/renova lease de 30 minutos. Mesmo expirado, outro proprietário não é removido automaticamente; confira que parou e use `flow release --batch ID --expected-session SESSAO_ANTIGA` antes de assumir. Não invente morte de processo.
3. `flow next --batch ID`: devolve ações compactas. Execute as independentes com no máximo duas simultâneas inicialmente; meça antes de aumentar. Não chame IA para escolher transição já devolvida pelo runtime.
4. `flow prepare --batch ID --task T --session S`: cria worktree em branch final/base fixa, prepara contexto e registra ownership antes da criação. Worktree externa ao lote não é apropriada. Dependências Git aprovadas da mesma camada são incorporadas; a base efetiva do review fica registrada após essa incorporação.
5. Delegue a ação ao agente nativo do cliente, em sessão independente quando o gate exigir. Antes de delegar, gere `pack --project WORKTREE --task T --role PAPEL --mode initial|focal|integrated --max-bytes 10000`. Papel: implementer/reviewer/auditor/qa/coordinator. Aumente orçamento ou expanda referências se faltar critério essencial; não omita cobertura.
6. Registre o JSON devolvido pelo executor com `flow event --batch ID --task T --session S --file EVENTO`. O coordenador usa sua raiz; `event.session` identifica a sessão executora. Dentro de lote, não mantenha estado Markdown paralelo nem use eventos avulsos como segunda coordenação. Consulte `flow next` após cada resultado.

A CLI não inicia modelos por assinatura/API e não cria sessões independentes por conta própria. O cliente que executa a skill faz a delegação; ausência dessa capacidade bloqueia o gate independente. O runtime reduz decisões operacionais da sessão coordenadora, mas não promete execução autônoma com o cliente fechado.

## Eventos, evidência e correção

Todo evento contém `id`, `task`, `session`, `expected_revision` e `type`. Em `type:gate`, informe `gate`, `status`, `snapshot` atual de `snapshot --task T`, e `evidence:[{source,detail}]`; os hashes são calculados e preservados pelo runtime. Caminhos relativos pertencem à worktree. O relatório deve identificar comandos/cenários, resultado observado, ambiente/isolamento, base/HEAD e limitações.

Gates iniciais: `implementation`, `review`, `audit`, `qa`. Status: PASS/FAIL/BLOCKED, ou NA_SEM_ACHADOS/COBERTO_NO_REVIEW somente nas condições do risco. R3/R4 exigem revisor-de-qa separado. Em R0–R2, QA_COVERAGE registra COBERTO_NO_REVIEW com sessão do revisor independente, coverage completa, checks determinísticos aplicáveis e evidência íntegra. Lacuna/risco sem cobertura exige evento require_qa com reason; o runtime invalida dispensas. Planos persistidos sem risk_level mantêm a política anterior. Review informa findings, finding_ids, coverage e, nos novos R0–R4, finding_details (id, severity P0–P3, file, line, evidence, impact, expected_test). QA informa cobertura e matriz observada. PASS não é consequência automática de leitura de código, contador, booleano ou código de saída de build.

Repositórios Git usam snapshot completo da árvore commitada, base e estado local, incluindo código fora de `sources`. PASS exige árvore limpa. Commits em `docs/historico/reviews/` e `docs/historico/entregas/` não invalidam o código; requisitos, ADRs, configuração, testes e demais docs continuam cobertos. Não guarde executáveis nesses diretórios históricos. Evidência alterada invalida o gate mesmo quando o código não muda. As identidades de sessão são declarações verificadas por diferença, não autenticação criptográfica; o coordenador confere a procedência real dos agentes.

Com achados, use `type:audit_decision`, snapshot, evidências e `decisions:[{id,decision,reason,blocking}]`. APLICAR é registrado **antes** de corrigir. ADIAR/REJEITAR precisam de fundamento; bloqueante confirmado não pode ser adiado/rejeitado. Não marque `verified:true` pelo próprio auditor.

Para corrigir:

1. Registre `type:round`, `kind:technical`, `round_id` estável e único desta rodada. O runtime vincula a rodada ao plano de auditoria pendente. Agrupe APLICAR compatíveis com dependências explícitas; não agrupe apenas para esconder unidades independentes.
2. Delegue somente os IDs APLICAR ao implementador, com arquivos, origem, negócio e teste esperado. Feche em modo CORRECAO, commit local e nova implementação observada. Não recrie registro/índice por ID.
3. Devolva ao revisor independente `type:revalidate`, snapshot novo, evidência, `coverage`, `impact_checked:true`, `results:[{id,status:"VERIFICADO"}]` exatamente para os IDs APLICAR. O snapshot de origem inalterado não é aceito. ID ainda presente/regressão exige novo review/auditoria com os IDs pendentes; nunca invente VERIFICADO.
4. Preserve os pareceres antigos nos eventos. O novo gate registra a revalidação, não reescreve o veredito original nem cria uma nova aprovação do auditor sobre código que ele não examinou.

Até três rodadas técnicas e três de QA por `ticket`, somadas entre camadas e integração. Repetição do mesmo evento/round_id não consome outra; uma rodada antiga não autoriza novas decisões. QA FAIL registra nova rodada `kind:qa` antes de corrigir; faça review técnico focal das alterações e QA observado dos bugs/regressões, mantendo a matriz anterior por referência. Use `flow isolate --batch ID --task T --session S --reason MOTIVO` para bloqueios reais; dependentes são isoladas e independentes continuam. Não contorne falhas editando SQLite.

## Integração, pacote e limpeza

`flow integrate --batch ID --group G --session S` exige membros/dependências aprovados, cria a candidata em `revisao/` e faz merges locais sem force. Conflito preserva a candidata e bloqueia; não resolve ours/theirs, não faz reset/rebase nem altera checkout principal. Se membros mudarem, preserve a candidata antiga e use uma nova candidata pelo protocolo `flow candidate`.

Registre gates finais com `flow receipt --batch ID --session S --file RECIBO`: `id`, `group`, `expected_revision` do lote, `session` executora, `stage` checks/review/audit/qa, `status`, snapshot/hash e `head_sha` atuais de `flow status`, `evidence:[{source,hash}]`. Review/QA exigem `coverage_complete:true`; review PASS exige `findings:0`. Perfil crítico atual do grupo exige auditor independente mesmo sem achados. Auditoria NA é evento determinístico nos demais, com referência ao review sem achados. Novos achados bloqueiam: review FAIL registra findings/finding_ids; a próxima ação AUDIT_INTEGRATED_FINDINGS pede auditor independente. Registre triagem integrada em audit FAIL/BLOCKED com decisões por ID, sem aprovar a candidata. ROUTE_INTEGRATED_CORRECTIONS e CORRECT_INTEGRATED_QA exigem identificar as tarefas responsáveis, auditar/corrigir nelas, revalidar e reconstruir candidata. Não repita review/QA falho sem alteração material.

No review/QA integrado, investigue exclusivamente interações, mudanças de contrato, resoluções de merge e regressões do conjunto. Preserve evidências individuais válidas; não repita toda a análise semântica dos arquivos inalterados. Testes automatizados abrangentes podem continuar rodando.

Em grupos exclusivamente R0–R2 sem QA condicional, INTEGRATED_QA_COVERAGE aceita recibo qa COBERTO_NO_REVIEW da sessão do review, coverage_complete:true, checks e evidências próprias das interações. R3/R4 mantêm QA PASS observado por sessão separada. Mudança da exigência de QA de um membro invalida a candidata anterior, mesmo sem mudança de SHA/perfil. Nunca reaproveite a dispensa antiga depois de elevar o risco.

`flow package --batch ID` gera pacote humano em `generated/` do armazenamento local. Distinga pronta para integrar de validada, limpeza pendente, parcial e bloqueada. Complemente o roteiro funcional/PR com texto da IA somente onde houver conteúdo novo; não publique ClickUp, push ou PR.

Antes de remover uma worktree, encerre os executores e execute `flow cleanup-check --batch ID --task T|--group G --session S`. O script verifica ownership, topologia, branch, operações pendentes, ignorados e links. `node_modules`, junction, arquivo desconhecido ou ignorado único bloqueiam; nunca siga links nem apague recursivamente. Histórico Contexto é arquivado no Git comum. Com recibo seguro e comprovação dos executores parados, execute `flow cleanup ... --executors-stopped yes`. Remoção usa somente Git sem force e preserva branches; retomada não remove de novo.

Após liberar a worktree da candidata, `flow deliver --batch ID --group G --session S` troca somente o checkout principal limpo para a branch aprovada. Se estiver sujo, preserve-o e registre comandos no pacote. Gere o pacote novamente após limpeza/entrega para inventário real e resultado final. Uma tarefa isolada nunca vira concluída por constar no pacote.

## Medição e documentação

Use `capture --project WORKTREE -- EXECUTAVEL ARGUMENTOS` para executar validação permitida e reter código de saída/log saneado. Não é sandbox nem prova de isolamento de banco. Prefira log diagnóstico resumido; leia a captura completa só ao investigar. Nunca execute teste de banco sem prova de isolamento conforme regras locais.

Importe `usage --file JSON` com contadores do cliente; sem telemetria, registre `observed:false` e tokens null. Registre papel, modelo, sessão, tentativa, duração e ferramentas quando disponíveis. `report` separa medições reais de estimativas de bytes; não invente economia nem contador indisponível. O teste comparativo de consumo real exige lotes equivalentes, entregas aprovadas e análise de defeitos/retrabalho.

`delivery --file JSON` gera estrutura/inventário por Git. Modos: ENTREGA_INICIAL, CORRECAO e FECHAMENTO_INTEGRADO. IA fornece título, contexto, motivo, riscos e como testar; o script não chama modelo, não commita, não publica e não acrescenta índice externo. O mesmo implementador usa fechar-entrega; não abra outro agente apenas para copiar metadados. Coordenador serializa a linha do índice após o commit real, usando chave do registro; CORRECAO atualiza o registro existente antes do bloco ClickUp e não cria outra linha.
