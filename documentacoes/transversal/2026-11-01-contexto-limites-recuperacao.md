# Context Compiler: contexto, limites e recuperação

Data: 2026-11-01. Domínio: transversal. Solicitação: corrigir carregamento indevido de
configurações, consumo excessivo e possibilidade de retomar o lote sem perder o trabalho.
Branch: developer. HEAD inicial/base de comparação: 8129a391f0f88f6d77704eb41b7cd89a2fc19379,
com comparação adicional aos bytes da árvore no início desta tarefa. Autor: agente
Codex a pedido de Vinicius. Nenhum commit criado nesta tarefa.

## Objetivo e escopo

Ajustar instruções e skills locais para a execução determinística pelo Context Compiler Go.
A árvore inicial já tinha 56 entradas alteradas/não rastreadas, incluindo CLAUDE.md e
arquivos de negócio. Essas alterações não pertencem a esta entrega e foram preservadas.
Não se alteram endpoints, migrações, arquitetura de banco ou critérios do login.

## Alterações

- AGENTS.md/CLAUDE.md: exceção explícita de coordenação para CONTEXTO_EXECUTION=step;
  leitura proporcional, sem lockfiles inteiros ou rotina Node durante despacho Go.
  Preservadas regras de banco, segurança, documentação, lessons e autorização de commits.
- skills/skills/_shared/context-compiler.md: escopo por step, fontes sob demanda,
  artefatos por caminho/hash pelo Go, checkpoint e continuidade sem recomeçar.
- skills/skills/_shared/observabilidade.md: telemetria do Go sem duplicar o Node legado.
- implementador-de-ticket/SKILL.md: encadeamento/preparação legados restritos ao uso direto.
- planejador-de-lote/SKILL.md, references/pacote-context-compiler.md e scripts/gerar-pacote-go*:
  brief obrigatório por step, referências seguras, limites finitos e testes do pacote.
- skills/modelos/AGENTS.md e CLAUDE.md: preservar a distinção em futuras instalações.
- .claude/skills, .agents/skills e .agent/skills: espelhos da fonte pelo instalador oficial.
- Este registro e [diffs reais da tarefa](2026-11-01-contexto-limites-recuperacao-diffs.md).

## Decisões e operação

O YAML controla a ordem das skills; o planejador permanece externo. Não é necessário
duplicar cada skill para usar o Go. No despacho Go, não chamar outro orquestrador/IA,
index/ensure do Node ou registros Node de processo/handoff. O runtime registra a sessão.

Cada etapa recebe brief e regras obrigatórias; referências available são para consulta
sob demanda. Uma lacuna essencial exige BLOCKED preciso. Não trocar arquitetura por
inferência. Em particular, mantenha a regra vigente de banco único com schemas.

O binário Go fica no repositório vizinho context-compiler-v1/bin/contexto.exe; o alias
context pode apontar para ele. Não confunda com contexto/contexto.mjs do fluxo legado.
O compilador possui manuais técnico e operacional em:
../context-compiler-v1/docs/CONTEXTO-LIMITES-E-RECUPERACAO.md e
../context-compiler-v1/docs/CONTEXTO-RECUPERACAO-TECNICA.md, a partir da raiz Nucleos.
A investigação detalhada fica em docs/2026-11-01-investigacao-contexto-nucleos.md no compilador.

Comandos, substituindo RUN_ID:
```bash
context pause RUN_ID --project "C:/caminho/nucleos"
context checkpoint RUN_ID --project "C:/caminho/nucleos" --format md
context report RUN_ID --project "C:/caminho/nucleos" --format md
context resume RUN_ID --project "C:/caminho/nucleos"
```

Ctrl+C uma vez também solicita interrupção cooperativa. Aguarde checkpoint e relatórios.
A worktree é preservada; retomada usa o mesmo run e não repete steps PASS. Comando de
efeito incerto requer inspeção e --retry-step explícito. Pausa não é congelamento em RAM,
backup de arquivos nem aprovação funcional.

Falha de finalização exige recover, em prévia por padrão, e --apply com revisão exata
para registrar correção sem chamar IA. Depois, resume é separado. Não edite SQLite nem
snapshot manualmente. O run antigo 31d672... tem seis arquivos elegíveis à recuperação
de hashes, mas a arquitetura do snapshot deve passar pelos gates antes de integração.
Nenhum lote real foi reexecutado nesta entrega.

## Validação

- Compilador: 393 testes aprovados, 3 skips Windows, zero falhas; go vet e build aprovados.
- Gerador de manifesto: 11 testes aprovados com compilador real.
- Frontmatter e links das 16 skills validados.
- Sincronização das três cópias: ver registro final de validação desta entrega.
- Prova com Claude real interrompida por quota da assinatura; não declarar sucesso completo.
- Build/lint/test do aplicativo: NA, pois não houve alteração de TypeScript, Python,
  SQL, infraestrutura ou dependências. Não se iniciou banco/serviço da aplicação.

## Lessons, riscos e rollback

lessons/ não foi alterada: esta entrega trata instruções de ferramenta externa e não
introduz, altera ou exercita conceitos da trilha TypeScript/Python/Docker/PostgreSQL/
segurança da aplicação. Não foi criado material didático artificial nem alterado seu índice.

Os limites são por tentativa e dados não expostos continuam desconhecidos. O isolamento
automático de personalizações está implementado no Claude; outros clientes têm cobertura
diferente. Não há promessa de economia percentual sem medição comparável.
Recuperar integridade não aprova critérios nem resolve divergência de arquitetura.

Rollback: reverter somente os patches listados nesta tarefa e reinstalar os espelhos
a partir da fonte correspondente. Preservar a árvore anterior, worktrees, banco SQLite,
logs e checkpoints. Não remover implementações já existentes nem fazer reset global.
Pendência de validação externa: executar prova completa quando houver quota Claude,
e avaliar o lote antigo pelos gates antes de integração.
## Registro final

Instalador --apply e --check concluídos: 16 skills, 76 arquivos por destino,
três destinos, zero divergências; archify extra preservada. A sincronização global
também passou. Conferidos por hash 82 arquivos alheios a esta entrega, intactos.

Finalização de t1_implement do run 31d6724286f0e3bb0542b6818c7971d0 recuperada:
revisão 7, seis artefatos, zero chamadas de IA. O run ficou PENDING, sem execução
de steps seguintes; setup/db_up/t1_implement continuam na tentativa 1.
O snapshot não foi alterado. A continuidade e os gates ainda são necessários;
a divergência potencial de arquitetura com o plano antigo não foi aprovada.