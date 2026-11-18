# Reinstalação limpa das skills de IA

Data: 2026-11-06 · Domínio: transversal · Branch: `developer` · Implementação: Codex.

## Objetivo, base e escopo

Atender ao pedido de substituir todas as skills existentes pelas atualizadas da pasta
`C:/Users/vinicius.silva/Documents/Documentos/00 - Dev/docker-intranet/app/.claude/skills`
e preparar a descoberta por Claude Code, Codex e Antigravity.

HEAD inicial e base do diff próprio: `8fd672f1c2a9053bc74ac71d841f3329802e9376`. A árvore estava limpa no início.
Merge-base com `origin/main`: `54a9aa78812e7772493b9fa5721a2e0a268bfb33`. A base própria é o HEAD inicial,
para não atribuir as alterações anteriores da branch a esta tarefa.

Estado: instalação e verificações locais concluídas. A execução dentro dos três
aplicativos não foi testada; reabrir o projeto/nova sessão renova o catálogo.
Nenhuma mudança na aplicação, banco, dependências ou serviços externos foi feita.

## Arquivos e decisões

| Arquivos | Alteração |
| --- | --- |
| `skills/skills/**` | Fonte antiga substituída pelos 11 arquivos de 5 skills, sem alterar bytes recebidos |
| `.claude/skills/**` | Cópia limpa para Claude Code |
| `.agents/skills/**` | Cópia limpa para Codex e Antigravity, incluindo retirada de archify |
| `.agent/skills/**` | Cópia limpa para Antigravity legado |
| `skills/.claude/skills/**`, `skills/.agents/skills/**`, `skills/.agent/skills/**` | Cópias antigas aninhadas retiradas; não são recriadas |
| `AGENTS.md` | Catálogo atual e aplicação das referências da Intranet à stack e aos caminhos do Nucleos |
| `README.md`, `skills/README.md` | Instalação, conjunto atual, sincronização e descoberta |
| `scripts/instalar-skills.mjs` | Extras continuam preservados, mas passam a reprovar a conferência e a aplicação |
| `skills/scripts/sincronizar-skills.mjs` | Entry point antigo delega ao instalador da raiz, sem recriar cópias aninhadas |
| `.gitattributes` | Desativa conversão de finais de linha somente na fonte e nas três cópias, preservando bytes entre plataformas |
| `skills-lock.json` | Retirada da entrada GitHub de archify; importação local não simula uma origem GitHub |
| `2026-11-06-reinstalacao-limpa-skills.md`, `2026-11-06-reinstalacao-limpa-skills-diffs.md` | Registro e patch integral desta entrega |

As skills são `grill-me`, `planejador-de-lote-v1`, `revisor-de-codigo`, `tech-lead`
e `worktree-planner`. Não foi executado o fluxo de nenhuma delas. Os arquivos
originais foram preservados, em vez de reescritos; as regras canônicas locais
esclarecem monorepo, NestJS/Next.js/Python/PostgreSQL, contratos reais, documentação,
worktrees, necessidade de autorização de commits e limites de dados.
`CLAUDE.md` e `.agents/rules/project-instructions.md` já apontavam para `AGENTS.md`.

A tentativa de exclusão recursiva foi rejeitada pela revisão automática de segurança.
A alternativa executada moveu as sete pastas antigas para
`.run/skills-clean-install/old-0` até `old-6`, com caminhos absolutos e ausência de
links verificados previamente. As pastas ativas foram recriadas vazias. O backup
é local e ignorado pelo Git; não constitui uma instalação ativa. A origem externa
foi apenas lida. O antigo `_shared/contexto` não acompanha este conjunto recebido.

## Verificações executadas

- `node scripts/instalar-skills.mjs --apply`: 5 skills, 11 arquivos por destino,
  3 destinos, 33 arquivos copiados, nenhum extra.
- `node scripts/instalar-skills.mjs --check`: 0 divergências, 0 extras, exit 0.
- `node skills/scripts/sincronizar-skills.mjs --check`: mesmo resultado, exit 0.
- `node --check scripts/instalar-skills.mjs` e
  `node --check skills/scripts/sincronizar-skills.mjs`: exit 0.
- Validador `skill-creator/scripts/quick_validate.py` instalado no ambiente:
  5 SKILL.md válidos, com `PYTHONUTF8=1` e Python da `.venv` já existente.
- Comparação independente SHA-256: origem, fonte local e três destinos com os
  mesmos 11 caminhos e bytes, sem extras; cópias antigas aninhadas ausentes.
- YAML, nome versus diretório, prompt de invocação, política automática e links
  Markdown: PASS nas 5 skills em cada uma das 4 pastas locais.
- Instalador em fixture descartável em `.run/skills-clean-install/installer-fixture`:
  PASS para cópia, check limpo, detecção e preservação de extra, detecção de drift
  e reparação pelo apply. A fixture não usa bancos nem serviços externos.
- `git check-attr text` nas quatro pastas: `unset`, preservação dos bytes importados.
- `git -c core.safecrlf=false diff --check`: exit 0.

Node usado: 24.22.2. Nenhuma dependência instalada. Lint/build/testes da aplicação
e aceite de tela: não executados, pois não houve alteração da aplicação. A validação
é da instalação, integridade e scripts; não afirma teste funcional nos clientes.

## Inventário recebido

Os hashes abaixo se aplicam aos mesmos caminhos relativos na origem, na fonte
e em cada pasta de descoberta.

| Caminho relativo | Bytes | SHA-256 |
| --- | --- | --- |
| `grill-me/SKILL.md` | 2346 | `1effb4a5505f6f25f92f02efcc54407fc2ef845056823eddf9288f7a2feb1d4b` |
| `grill-me/agents/openai.yaml` | 302 | `676ddaf9344d45cd40dd34aa248d0ef8e2b58c3df632d5640dc59c98440b0d61` |
| `planejador-de-lote-v1/SKILL.md` | 4507 | `5c217b8d09bcd72e38b71f420cb83f5ade3c69f86566f65ee88967ba3ddbcae9` |
| `planejador-de-lote-v1/agents/openai.yaml` | 349 | `09e002835e79107bbc9412be27f14ba2ebea219f2274781efa54091a7be6e07b` |
| `revisor-de-codigo/SKILL.md` | 4334 | `45b4f3c8216675a2088b61a86392480c12e6821201cf47de13f4eea6cbe3a0c6` |
| `revisor-de-codigo/agents/openai.yaml` | 312 | `58889c036ce515625f40058fb8f574baa8c8c5c15565c740d454ad92299cf8f9` |
| `revisor-de-codigo/references/checklist-risco.md` | 3232 | `074370810e857cd841cbf1c0f89d95bb7199755da1e408b54fcca5e99a8dedaf` |
| `tech-lead/SKILL.md` | 3762 | `1b89c2c12037249963e42a5d94d7c660389d2767eeff12a76378360f1dec33b4` |
| `tech-lead/agents/openai.yaml` | 293 | `d0b5451becca697cac531cb4921bec499d69732841901689572745c5dfd9b49c` |
| `worktree-planner/SKILL.md` | 6100 | `efb7f74fb526178d02aff9172208291418b7927c95449faeed8ce57a824cde32` |
| `worktree-planner/agents/openai.yaml` | 304 | `3de41157b100c32a5c801a9c600aab202812e20148dfd06eca826c77bec2e4e7` |

## Riscos, compatibilidade e rollback

Sessões já abertas podem manter o catálogo anterior até serem recarregadas.
O conjunto agora contém somente as cinco skills solicitadas; referências históricas
às skills removidas não as tornam disponíveis. Não há runtime de Contexto instalado
por esta entrega. Regras de integração, dados, autorização e QA visual permanecem
vigentes; as referências da Intranet são aplicadas conforme `AGENTS.md`.

Para rollback antes de outras edições, preservar o estado atual e restaurar somente
os caminhos desta tarefa a partir do HEAD inicial e/ou dos backups locais. O mapa é:
`old-0` = fonte; `old-1` = Claude; `old-2` = Codex/Antigravity; `old-3` = legado;
`old-4`, `old-5`, `old-6` = cópias aninhadas Claude, Codex/Antigravity e legado.
Não executar reset global nem substituir trabalho posterior.

## Commits, diffs e lessons

O fechamento técnico original foi entregue sem commits. Após autorização explícita,
as mudanças de distribuição foram reunidas no commit `8029c6814cd5febb06c255708987f7b469bd36f4`;
veja o [registro de publicação](2026-11-06-publicacao-developer.md). O
[patch integral](2026-11-06-reinstalacao-limpa-skills-diffs.md) foi atualizado para esse
commit, incluindo a fonte da sexta skill e retirada de modelos antigos da limpeza.
As regras e o README da raiz foram incluídos no commit do MVP, conforme o registro.
SHA-256 dos bytes do diff textual do commit: `c3cb880d07305fd7a519e91aec75cd42778e4127c11277f32ce70d063788f628`.

Lessons: NA. A entrega instala arquivos de instrução e ajusta distribuição local;
não introduz nem altera conceito de TypeScript, Python, Docker, PostgreSQL ou
segurança da aplicação. A validação usa ferramentas existentes sem mudar a stack.
Por isso [o índice de lessons](../../lessons/README.md) permanece inalterado.

Pendência de validação: uso funcional dos três clientes após recarregar o projeto.
Não há pendências conhecidas na integridade e sincronização verificadas localmente.
