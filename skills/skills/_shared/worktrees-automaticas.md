# Contexto automático por worktree

O padrão para novos lotes é o [fluxo enxuto](fluxo-enxuto.md). Durante seu planejamento e despacho Go, não execute preparação/indexação/process/flow do Node legado nem acrescente gates/auditores/QA. As instruções operacionais Node abaixo só se aplicam ao modo legado explícito; regras de negócio e segurança do projeto permanecem vigentes.

O código Contexto está em `_shared/contexto/`. Não depende de instalação externa ou cadastro de MCP. O usuário não executa init por worktree. Siga o [protocolo V2](protocolo-v2.md) e preserve autorização, Git e proteção de banco.

## Criar, reutilizar e retomar

1. Confirme raiz Git, diretório comum, branch/base e ownership. Não derive identidade só do path; não aproprie worktree de outro lote.
2. No lote V2, use `flow prepare` para criar em branch final, preparar contexto e registrar recibo. Fora dele, o criador autorizado chama automaticamente `scripts/preparar-contexto.mjs --project RAIZ_REAL_DA_WORKTREE` desta pasta. Resolva o path a partir da skill, não de um drive fixo.
3. Exija exit 0, `prepared:true`, raiz correta e caminho do banco isolado antes de delegar. Runtime/permissão/topologia indisponível é bloqueio real; continue as tarefas independentes.
4. `ensure` é idempotente, preserva configuração, registra defaults locais e reindexa. Não altera arquivos rastreados nem instala hooks por padrão. Pode receber `--config-from RAIZ_CONFIRMADA` para herdar somente configuração pertinente; não copia índices, eventos, gates, credenciais ou aprovações.

O SQLite vive em `_shared/.contexto/` da instalação local escolhida por regra fixa. Sem skills copiadas na worktree, o helper cria somente `.agents/skills/_shared/.contexto/`. A CLI embarcada pode ser chamada da instalação central com `--project` apontando para a worktree; os dados ficam na raiz selecionada, não na fonte central. Cada executor usa sua raiz explícita. Configuração legada em `.contexto/` continua válida; não migre/copiem estados silenciosamente.

`setup` existe para compatibilidade e registro explícito; o fluxo usa ensure automaticamente. Hooks antigos permanecem preservados; nenhum hook novo é necessário nesta distribuição. Não configure um MCP global para aprovar outra raiz.

## Limpeza

Encerre executores e use `flow cleanup-check` antes de `flow cleanup` no lote. Fora dele, `archive --project RAIZ_REAL` apenas preserva o histórico e informa `archived:true`/`cleanup_safe`; não remove a worktree nem prova ausência de executores.

Ownership, topologia, branch preservada, estado Git limpo, ausência de operação pendente e de ignorados únicos continuam obrigatórios. Links/junctions, node_modules, arquivos operacionais desconhecidos ou atividade concorrente bloqueiam remoção. Nunca exclusão recursiva/force, nunca limpeza de worktree externa ao lote. Arquivo histórico não reativa gates em outra raiz.
