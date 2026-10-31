# LOC-001 — Alinhar regras do projeto e trilha de lessons à stack TypeScript + Python

> Especificação canônica da tarefa local do lote [lote-2026-10-25-ep00-ep01-fundacao](lote-2026-10-25-ep00-ep01-fundacao.md). Origem: decisão do usuário em 2026-10-25 ("mude para as determinações atuais que é no caso typescript e modifique o claude.md"). Perfil **padrao**. Sem ID externo.

**Objetivo.** Remover a premissa C#/.NET das regras permanentes e da trilha didática, trocando-a pela stack do ADR de 2026-10-25 (TypeScript/NestJS/Next.js e Python), sem enfraquecer a documentação obrigatória de entrega.

**Contexto.** `CLAUDE.md` (e espelhos `AGENTS.md`, `.agents/rules/project-instructions.md`) falam de `.sln`, `.csproj`, `global.json`, nullable, `lessons/` "de C# e .NET" e `dotnet`. `lessons/` ainda não existe. A seção "Configuração do fluxo de skills" declara `back/`/`front/` sem código, o que o ADR (seção 14) substitui por `apps/`, `services/`, `packages/`.

**Escopo**
- `CLAUDE.md`: trocar referências .NET por equivalentes TS/Python (`package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `uv.lock`, `tsconfig`, `ruff`, `mypy`); manter intactos a definição obrigatória de pronto, o formato de documentação, commits/diffs e conferência final.
- Reescrever "Base didática viva em lessons" para trilha de TypeScript, Python, Docker/Compose, PostgreSQL e segurança; exemplos "com `using`..." viram exemplos executáveis nessas linguagens; campo "versão de .NET" vira versões de Node/TS/Python.
- Atualizar "Configuração do fluxo de skills": camadas reais (`apps/`, `services/`, `packages/`, `infrastructure/`); declarar o ambiente isolado de PoC (containers descartáveis em `127.0.0.1`, sem dados reais, sem VPS); deixar a seção "Validação" apontando que os comandos reais serão declarados por ENT-FND-001.
- Espelhar a mudança em `AGENTS.md` e `.agents/rules/project-instructions.md` (e nas cópias de `.claude/`, se existirem regras ali), mantendo-os consistentes.
- Criar `lessons/README.md` (índice, pré-requisitos, trilha) com a ordem pedagógica inicial **sem lessons de enchimento**: apenas a estrutura e a nota de que lessons nascem com as entregas (regra "sem lesson artificial" preservada).
- Se as skills fonte (`skills/skills/`) citarem .NET/C# como fato do projeto, listar no relatório; alterar a fonte e rodar `node scripts/instalar-skills.mjs --apply` e `--check` somente se for necessário e restrito a isso.

**Fora do escopo.** Reescrever o ADR; apagar `Nucleos-Especificacao-Mestra.md` ou o backlog de 2026-09-22 (FND-008 anota a substituição); criar lessons de conteúdo; qualquer código.

**Critérios de aceite (AC)**
- AC-1: `grep -rniE "dotnet|\.csproj|\.sln|global\.json|C#|\.NET" CLAUDE.md AGENTS.md .agents/rules` não retorna ocorrência fora de nota histórica explícita.
- AC-2: as seções "Definição obrigatória de pronto", "Documentação de cada entrega" e "Conferência antes de responder" continuam presentes e equivalentes (diff mostra mudança apenas de vocabulário técnico).
- AC-3: `CLAUDE.md`, `AGENTS.md` e `.agents/rules/project-instructions.md` têm as mesmas regras de stack (comparação feita e registrada).
- AC-4: `lessons/README.md` existe com índice e pré-requisitos e não referencia arquivos inexistentes.
- AC-5: a seção de dados declara o ambiente isolado de PoC e mantém a proibição de banco/serviço real.
- AC-6: `node scripts/instalar-skills.mjs --check` passa (se skills foram tocadas) ou é registrado como não aplicável.

**Validação.** Greps acima, comparação entre os três arquivos de regras, verificação de links relativos de `lessons/README.md`. Sem build/teste (não há código).

**Contratos afetados.** Nenhum de código; afeta o comportamento de todas as sessões futuras.

**Documentação.** Documento de entrega em `documentacoes/transversal/` (é regra de processo, realmente transversal), conforme `CLAUDE.md`.

**Riscos.** Reescrita enfraquecer uma regra obrigatória (mitigar com AC-2); divergência entre os três arquivos de regras (AC-3). Hipótese H-1 do manifesto (trilha TS/Python/Docker/PostgreSQL/segurança) pode ser corrigida pelo usuário antes da execução.
