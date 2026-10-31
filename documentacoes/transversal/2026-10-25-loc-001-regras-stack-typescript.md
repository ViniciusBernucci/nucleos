# LOC-001: regras do projeto e trilha de lessons alinhadas a stack TypeScript + Python

Data: 2026-10-25

- **Dominio:** transversal (regra de processo que afeta todas as sessoes).
- **Tarefa:** LOC-001 do lote `2026-10-25-ep00-ep01-fundacao`; especificacao canonica em [lote-2026-10-25-ep00-ep01-fundacao-loc-001.md](../planejamento-ia/lote-2026-10-25-ep00-ep01-fundacao-loc-001.md). Sem ID externo.
- **Branch:** `tarefa/loc-001`. **Base/HEAD inicial:** `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594`, arvore limpa.
- **Estado:** implementado, aguardando review independente. **Autores:** Claude (executor) a pedido de Vinicius.

## Objetivo, contexto e escopo

Remover a premissa C#/.NET de `CLAUDE.md`, `AGENTS.md` e `.agents/rules/project-instructions.md` e da trilha didatica, adotando a stack do [ADR de 2026-10-25](2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md) (TypeScript/NestJS/Next.js e Python), sem enfraquecer a documentacao obrigatoria de entrega. Dentro do escopo: os tres arquivos de regras, `lessons/README.md`, declaracao do ambiente isolado de PoC. Fora do escopo: alterar o ADR, apagar a especificacao mestra ou o backlog de 2026-09-22, criar lessons de conteudo, qualquer codigo.

Hipotese H-1 (trilha TypeScript/Python/Docker/PostgreSQL/seguranca): adotada, **nao aprovada explicitamente** pelo usuario; pode ser corrigida em review.

## Resumo da implementacao

- "Forma de trabalho": `.sln`/`.csproj`/`global.json`/`Directory.Build.*` viram `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`; a regra "Em C#/.NET" vira regra de TypeScript/Python (`strict`, versoes em `.nvmrc`/`package.json`/`pyproject.toml`, ESLint, Prettier, `ruff`, `mypy`).
- "Base didatica viva em lessons": trilha de TypeScript, Python, Docker/Compose, PostgreSQL e seguranca; exemplos executaveis em vez de "com `using`"; campo de versao passa a ser Node/TypeScript/Python.
- "Configuracao do fluxo de skills": camadas `apps/`, `services/`, `packages/`, `infrastructure/` (ADR secao 14) no lugar de `back/`/`front/`; "Validacao" aponta que os comandos reais serao declarados apos ENT-FND-001; "Dados" declara o ambiente isolado de PoC (containers descartaveis em `127.0.0.1`, sem dados reais, sem VPS) mantendo a proibicao de banco/servico real fora dele.
- `lessons/README.md` criado com apresentacao, pre-requisitos, regras da trilha, ordem pedagogica prevista (sem links) e indice vazio ("Nenhuma lesson publicada ainda").

## Mudancas por arquivo

| Arquivo | Mudanca |
| --- | --- |
| `CLAUDE.md` | Vocabulario de stack nas secoes "Forma de trabalho", "Base didatica viva" e "Configuracao do fluxo de skills". |
| `AGENTS.md` | Mesmas mudancas, preservando a redacao propria do arquivo. |
| `.agents/rules/project-instructions.md` | Mesmas mudancas, preservando a redacao propria do arquivo. |
| `lessons/README.md` | Novo (indice e trilha, sem lessons). |

Finais de linha CRLF dos tres arquivos de regras foram preservados (diff sem ruido de EOL). Sem testes, configuracao ou migracoes.

## Decisoes tecnicas

- Cada arquivo manteve sua redacao original; a consistencia exigida (AC-3) e de regras de stack, nao de texto identico. A secao "Configuracao do fluxo de skills" permanece byte a byte igual nos tres.
- Alternativa descartada: manter C#/.NET como "nota historica"; nao ha historico .NET a preservar, entao nao ha ocorrencia residual.
- Skills fonte (`skills/skills/`): ocorrencias de .NET/C# existem apenas em `security-audit` (`references/ecosystem-checks.md`, `scripts/security-surface.sh`) como checagem generica de ecossistemas, nao como fato do projeto. Nao tocadas.

## Validacoes (reais)

- **AC-1:** `grep -rniE "dotnet|\.csproj|\.sln|global\.json|C#|\.NET" CLAUDE.md AGENTS.md .agents/rules` => nenhuma ocorrencia (exit 1).
- **AC-2:** todos os hunks do diff ficam em "Forma de trabalho", "Base didatica viva em lessons" e "Configuracao do fluxo de skills" (verificado pelos numeros de linha dos hunks contra os cabecalhos `##`); nenhum hunk em "Definicao obrigatoria de pronto", "Documentacao de cada entrega" ou "Conferencia" e nenhuma linha alterada contem esses termos.
- **AC-3:** os tres arquivos tem 1 ocorrencia cada de: regra `TypeScript/Python` com referencia ao ADR, trilha TypeScript/Python/Docker/PostgreSQL/seguranca, exemplos executaveis, versoes Node/TypeScript/Python, `ENT-FND-001`, `127.0.0.1` e `apps/`; a secao de configuracao e identica (`diff` vazio) entre `CLAUDE.md` e os outros dois.
- **AC-4:** unico link relativo de `lessons/README.md` (ADR) resolve; nenhuma lesson referenciada.
- **AC-5:** secao "Dados" declara o ambiente isolado de PoC e mantem a proibicao de banco/servico real.
- **AC-6:** NA. Nenhum arquivo de `skills/` alterado, entao `scripts/instalar-skills.mjs --apply/--check` nao se aplicam.
- Build/teste/lint: NA (entrega somente de documentacao/regras, sem codigo; gate de codigo continua BLOCKED por declaracao).

## Impactos, riscos e rollback

Afeta o comportamento de todas as sessoes futuras. Risco: regra obrigatoria enfraquecida (mitigado por AC-2) e divergencia entre arquivos (AC-3). Rollback: `git revert` do commit da tarefa. Sem observabilidade ou compatibilidade a considerar.

## Lessons

Nenhuma lesson de conteudo criada (a entrega nao exercita conceito de TypeScript/Python/Docker/PostgreSQL/seguranca; regra "sem lesson artificial"). Criado o indice [lessons/README.md](../../lessons/README.md).

## Commits e diffs

Base `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594`. Um commit local em `tarefa/loc-001` (SHA informado na resposta do executor; um documento nao pode conter o proprio SHA). Pela regra de recursao, ficam fora do patch este documento e `lessons/README.md` (novo, listado acima). Diff dos arquivos de regras (CRLF omitido na exibicao):

```diff
diff --git a/.agents/rules/project-instructions.md b/.agents/rules/project-instructions.md
index ea95d06..e2d74b0 100755
--- a/.agents/rules/project-instructions.md
+++ b/.agents/rules/project-instructions.md
@@ -5,12 +5,14 @@ Esta e uma regra de workspace do Antigravity e deve permanecer configurada como
 
 ## Forma de trabalho
 
-- Antes de alterar codigo, leia a estrutura, os arquivos `.sln`, `.csproj`,
-  `global.json`, `Directory.Build.*`, o README e os testes relacionados.
+- Antes de alterar codigo, leia a estrutura, os arquivos `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`,
+  o README e os testes relacionados.
 - Preserve arquitetura, limites de dominio, convencoes e estilo existentes.
   Nao faca refatoracoes alheias a tarefa.
-- Para C#/.NET, respeite `TargetFramework`, versao da linguagem, nullable
-  reference types, analisadores e formatadores configurados.
+- Para TypeScript/Python, respeite a stack do ADR de 2026-10-25 (TypeScript com NestJS e Next.js; Python
+  para servicos de IA/dados): `tsconfig` em modo `strict`, versoes de Node, `pnpm` e Python
+  declaradas em `.nvmrc`, `package.json` e `pyproject.toml`, e linters, formatadores e
+  verificadores de tipo configurados (ESLint, Prettier, `ruff`, `mypy`).
 - Implemente ou atualize testes proporcionais ao risco. Execute build, testes,
   lint e formatacao aplicaveis; informe exatamente o que foi ou nao executado.
 - Nao exponha segredos, tokens, dados pessoais ou valores de `.env` em codigo,
@@ -82,7 +84,8 @@ Inclua em cada documento:
 
 ## Base didatica viva em lessons
 
-`lessons/` e uma trilha progressiva de C#/.NET, nao um changelog. Toda
+`lessons/` e uma trilha progressiva de TypeScript, Python, Docker/Compose, PostgreSQL e
+seguranca, nao um changelog. Toda
 implementacao deve identificar os conceitos usados e criar ou melhorar as
 lessons correspondentes.
 
@@ -107,15 +110,16 @@ Cada lesson criada ou atualizada deve conter, quando aplicavel:
 1. objetivo, pre-requisitos e posicao na trilha;
 2. explicacao simples e modelo mental;
 3. relacao com a implementacao e link para a documentacao da entrega;
-4. exemplos validos em C#/.NET, com `using`, tipos e configuracao necessarios;
+4. exemplos validos e executaveis em TypeScript ou Python, com imports, tipos e
+   configuracao necessarios (ou Dockerfile/Compose/SQL quando for o caso);
 5. progressao do exemplo minimo ao padrao do projeto;
 6. erros comuns, trade-offs e quando nao usar;
 7. verificacao ou testes e exercicios/perguntas de revisao;
-8. data de criacao, ultima atualizacao e versao de .NET dos exemplos.
+8. data de criacao, ultima atualizacao e versoes de Node, TypeScript e Python dos exemplos.
 
-Use o framework e as convencoes do repositorio. Exemplos devem compilar ou ser
+Use o framework e as convencoes do repositorio. Exemplos devem executar (ou compilar) ou ser
 marcados como pseudocodigo. Nao copie segredos nem regras sensiveis. Se nao
-houver conceito C#/.NET relevante introduzido, alterado ou exercitado, nao crie
+houver conceito relevante de TypeScript, Python, Docker, PostgreSQL ou seguranca introduzido, alterado ou exercitado, nao crie
 conteudo artificial; justifique no documento da entrega por que `lessons/` nao
 mudou.
 
@@ -152,8 +156,8 @@ estas regras e as secoes anteriores deste arquivo.
 - **Perfil:** preset `generic`. Este projeto NAO e Intranet: ignore `references/intranet.md`,
   ORCA, SQL Server, ClickUp e `{FONTE_CLAUDE}`; use a instalacao das skills deste repositorio.
 - **Repositorios:** um unico repositorio Git, `nucleos` (raiz `.`, camada `monorepo`), com
-  branch padrao `main` e branch de trabalho `developer`. `back/` e `front/` sao camadas
-  previstas no mesmo repositorio e ainda nao tem codigo.
+  branch padrao `main` e branch de trabalho `developer`. Camadas conforme o ADR de
+  2026-10-25 (secao 14): `apps/`, `services/`, `packages/` e `infrastructure/`; ainda sem codigo.
 - **Fuso operacional:** `America/Sao_Paulo`.
 - **Documentos:** planos, manifesto e estado do lote em `documentacoes/planejamento-ia/`;
   relatorios de review, auditoria e QA em `documentacoes/reviews/`. O registro de cada
@@ -165,11 +169,14 @@ estas regras e as secoes anteriores deste arquivo.
 - **Commits:** continua valendo "nao crie commits sem pedido explicito". O orquestrador so
   faz commits locais nas branches de tarefa e `revisao/` quando o pedido de execucao
   autorizar commits de forma explicita; nunca em `main`/`master`.
-- **Validacao:** ainda nao ha codigo nem comandos de lint, build ou teste. Quando `back/` ou
-  `front/` receberem codigo, declare aqui os comandos reais. Ate la, gate de build/teste de
-  codigo fica BLOCKED; entrega somente de documentacao registra NA com justificativa.
-- **Dados:** nao ha banco nem servico declarado. Nenhum teste ou script acessa banco ou
-  servico real sem um ambiente isolado declarado nesta secao.
+- **Validacao:** ainda nao ha codigo nem comandos de lint, build ou teste. Os comandos reais
+  serao declarados aqui apos ENT-FND-001 (monorepo `pnpm` e `uv`). Ate la, gate de build/teste
+  de codigo fica BLOCKED; entrega somente de documentacao registra NA com justificativa.
+- **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
+  banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
+  declarado: containers descartaveis (Docker/Compose) publicados somente em `127.0.0.1`, sem
+  dados reais e sem VPS, destruidos ao final de cada PoC. Qualquer outro banco ou servico
+  continua proibido.
 - **Contexto:** configuracao versionada em `scripts/contexto-projeto.json`, aplicada por
   `bash scripts/instalar-contexto.sh`. A CLI fica em `contexto/contexto.mjs`, pasta
   vizinha ao checkout principal. Antes de usar `_shared/scripts/preparar-contexto.mjs`
diff --git a/AGENTS.md b/AGENTS.md
index 5226580..25bb0e6 100755
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -7,12 +7,14 @@ dispensar a documentacao obrigatoria de entrega nem a manutencao de `lessons/`.
 ## Forma de trabalho
 
 - Antes de alterar codigo, leia a estrutura do repositorio, os arquivos
-  `.sln`, `.csproj`, `global.json`, `Directory.Build.*`, o README e os testes
+  `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`, o README e os testes
   relacionados.
 - Preserve a arquitetura, os limites de dominio, as convencoes e o estilo ja
   existentes. Nao faca refatoracoes alheias a tarefa.
-- Para C#/.NET, respeite o `TargetFramework`, a versao da linguagem, nullable
-  reference types, analisadores e formatadores configurados pelo projeto.
+- Para TypeScript/Python, respeite a stack do ADR de 2026-10-25 (TypeScript com NestJS e Next.js; Python
+  para servicos de IA/dados): `tsconfig` em modo `strict`, versoes de Node, `pnpm` e Python
+  declaradas em `.nvmrc`, `package.json` e `pyproject.toml`, e linters, formatadores e
+  verificadores de tipo configurados (ESLint, Prettier, `ruff`, `mypy`).
 - Implemente ou atualize testes proporcionais ao risco. Execute build, testes,
   lint e formatacao aplicaveis antes de concluir; informe exatamente o que foi
   ou nao foi executado.
@@ -91,7 +93,8 @@ tarefa` e inclua os diffs staged e unstaged referentes a entrega.
 
 ## Base didatica viva em lessons
 
-`lessons/` e material de estudo progressivo de C# e .NET, nao um diario de
+`lessons/` e material de estudo progressivo de TypeScript, Python, Docker/Compose, PostgreSQL e
+seguranca, nao um diario de
 mudancas. Toda implementacao deve avaliar os conceitos usados e criar ou
 melhorar as lessons correspondentes.
 
@@ -113,25 +116,25 @@ melhorar as lessons correspondentes.
 
 ### Conteudo de cada lesson
 
-Cada lesson criada ou atualizada deve ser didatica para quem esta aprendendo C#
+Cada lesson criada ou atualizada deve ser didatica para quem esta aprendendo a stack do projeto
 e conter, quando aplicavel:
 
 1. objetivo de aprendizagem;
 2. pre-requisitos e posicao na trilha;
 3. explicacao em linguagem simples e modelo mental;
 4. relacao com a implementacao real, com link para a documentacao da entrega;
-5. exemplos validos em C#/.NET, incluindo `using`, tipos e configuracao
-   necessarios para compreender ou executar o exemplo;
+5. exemplos validos e executaveis em TypeScript ou Python, incluindo imports,
+   tipos e configuracao necessarios (ou Dockerfile/Compose/SQL quando for o caso), para compreender ou executar o exemplo;
 6. uma progressao do exemplo minimo para o padrao usado no projeto;
 7. erros comuns, trade-offs e quando nao usar o conceito;
 8. como testar ou verificar, preferencialmente com exemplos de teste;
 9. exercicios ou perguntas de revisao;
-10. data de criacao, ultima atualizacao e versao de .NET usada nos exemplos.
+10. data de criacao, ultima atualizacao e versoes de Node, TypeScript e Python usadas nos exemplos.
 
-Use o framework e as convencoes do repositorio. Exemplos devem ser compilaveis
+Use o framework e as convencoes do repositorio. Exemplos devem ser executaveis (ou compilaveis)
 ou claramente marcados como pseudocodigo. Nunca copie segredos ou regras de
 negocio sensiveis para material didatico. Se a entrega nao introduzir, alterar
-nem exercitar conceito relevante de C#/.NET, nao crie conteudo artificial:
+nem exercitar conceito relevante de TypeScript, Python, Docker, PostgreSQL ou seguranca, nao crie conteudo artificial:
 registre no documento da entrega a justificativa para `lessons/` nao ter sido
 alterada.
 
@@ -170,8 +173,8 @@ estas regras e as secoes anteriores deste arquivo.
 - **Perfil:** preset `generic`. Este projeto NAO e Intranet: ignore `references/intranet.md`,
   ORCA, SQL Server, ClickUp e `{FONTE_CLAUDE}`; use a instalacao das skills deste repositorio.
 - **Repositorios:** um unico repositorio Git, `nucleos` (raiz `.`, camada `monorepo`), com
-  branch padrao `main` e branch de trabalho `developer`. `back/` e `front/` sao camadas
-  previstas no mesmo repositorio e ainda nao tem codigo.
+  branch padrao `main` e branch de trabalho `developer`. Camadas conforme o ADR de
+  2026-10-25 (secao 14): `apps/`, `services/`, `packages/` e `infrastructure/`; ainda sem codigo.
 - **Fuso operacional:** `America/Sao_Paulo`.
 - **Documentos:** planos, manifesto e estado do lote em `documentacoes/planejamento-ia/`;
   relatorios de review, auditoria e QA em `documentacoes/reviews/`. O registro de cada
@@ -183,11 +186,14 @@ estas regras e as secoes anteriores deste arquivo.
 - **Commits:** continua valendo "nao crie commits sem pedido explicito". O orquestrador so
   faz commits locais nas branches de tarefa e `revisao/` quando o pedido de execucao
   autorizar commits de forma explicita; nunca em `main`/`master`.
-- **Validacao:** ainda nao ha codigo nem comandos de lint, build ou teste. Quando `back/` ou
-  `front/` receberem codigo, declare aqui os comandos reais. Ate la, gate de build/teste de
-  codigo fica BLOCKED; entrega somente de documentacao registra NA com justificativa.
-- **Dados:** nao ha banco nem servico declarado. Nenhum teste ou script acessa banco ou
-  servico real sem um ambiente isolado declarado nesta secao.
+- **Validacao:** ainda nao ha codigo nem comandos de lint, build ou teste. Os comandos reais
+  serao declarados aqui apos ENT-FND-001 (monorepo `pnpm` e `uv`). Ate la, gate de build/teste
+  de codigo fica BLOCKED; entrega somente de documentacao registra NA com justificativa.
+- **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
+  banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
+  declarado: containers descartaveis (Docker/Compose) publicados somente em `127.0.0.1`, sem
+  dados reais e sem VPS, destruidos ao final de cada PoC. Qualquer outro banco ou servico
+  continua proibido.
 - **Contexto:** configuracao versionada em `scripts/contexto-projeto.json`, aplicada por
   `bash scripts/instalar-contexto.sh`. A CLI fica em `contexto/contexto.mjs`, pasta
   vizinha ao checkout principal. Antes de usar `_shared/scripts/preparar-contexto.mjs`
diff --git a/CLAUDE.md b/CLAUDE.md
index 3f4fbc6..3ab4678 100755
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -8,12 +8,14 @@ didatica descritas aqui.
 ## Forma de trabalho
 
 - Antes de alterar codigo, leia a estrutura do repositorio, os arquivos
-  `.sln`, `.csproj`, `global.json`, `Directory.Build.*`, o README e os testes
+  `package.json`, `pnpm-workspace.yaml`, `tsconfig*.json`, `pyproject.toml`, `uv.lock`, o README e os testes
   relacionados.
 - Preserve arquitetura, limites de dominio, convencoes e estilo existentes.
   Evite refatoracoes sem relacao com a tarefa.
-- Em C#/.NET, respeite `TargetFramework`, versao da linguagem, nullable
-  reference types, analisadores e formatadores configurados.
+- Em TypeScript/Python, respeite a stack do ADR de 2026-10-25 (TypeScript com NestJS e Next.js; Python
+  para servicos de IA/dados): `tsconfig` em modo `strict`, versoes de Node, `pnpm` e Python
+  declaradas em `.nvmrc`, `package.json` e `pyproject.toml`, e linters, formatadores e
+  verificadores de tipo configurados (ESLint, Prettier, `ruff`, `mypy`).
 - Implemente ou atualize testes proporcionais ao risco. Execute build, testes,
   lint e formatacao aplicaveis e relate exatamente o que foi ou nao executado.
 - Nunca exponha segredos, tokens, dados pessoais ou valores de `.env` em codigo,
@@ -89,7 +91,8 @@ Cada documento deve incluir:
 
 ## Base didatica viva em lessons
 
-`lessons/` e uma trilha progressiva de C# e .NET, nao um changelog. Em toda
+`lessons/` e uma trilha progressiva de TypeScript, Python, Docker/Compose,
+PostgreSQL e seguranca, nao um changelog. Em toda
 implementacao, identifique os conceitos usados e crie ou melhore as lessons
 correspondentes.
 
@@ -114,16 +117,17 @@ Inclua, conforme aplicavel:
 1. objetivo, pre-requisitos e posicao na trilha;
 2. explicacao simples e modelo mental;
 3. conexao com a implementacao real e link para a documentacao da entrega;
-4. exemplos validos em C#/.NET com `using`, tipos e configuracao necessarios;
+4. exemplos validos e executaveis em TypeScript ou Python, com imports, tipos e
+   configuracao necessarios (ou Dockerfile/Compose/SQL quando for o caso);
 5. progressao do exemplo minimo para o padrao do projeto;
 6. erros comuns, trade-offs e situacoes em que o conceito nao se aplica;
 7. verificacao ou testes, mais exercicios ou perguntas de revisao;
-8. data de criacao, ultima atualizacao e versao de .NET dos exemplos.
+8. data de criacao, ultima atualizacao e versoes de Node, TypeScript e Python dos exemplos.
 
-Use o framework e as convencoes do repositorio. Exemplos devem compilar ou ser
+Use o framework e as convencoes do repositorio. Exemplos devem executar (ou compilar) ou ser
 marcados claramente como pseudocodigo. Nao copie segredos ou regras de negocio
 sensiveis. Se a entrega nao introduzir, alterar nem exercitar conceito relevante
-de C#/.NET, nao crie uma lesson artificial; registre a justificativa no documento
+de TypeScript, Python, Docker, PostgreSQL ou seguranca, nao crie uma lesson artificial; registre a justificativa no documento
 da entrega.
 
 ## Conferencia antes de responder
@@ -159,8 +163,8 @@ estas regras e as secoes anteriores deste arquivo.
 - **Perfil:** preset `generic`. Este projeto NAO e Intranet: ignore `references/intranet.md`,
   ORCA, SQL Server, ClickUp e `{FONTE_CLAUDE}`; use a instalacao das skills deste repositorio.
 - **Repositorios:** um unico repositorio Git, `nucleos` (raiz `.`, camada `monorepo`), com
-  branch padrao `main` e branch de trabalho `developer`. `back/` e `front/` sao camadas
-  previstas no mesmo repositorio e ainda nao tem codigo.
+  branch padrao `main` e branch de trabalho `developer`. Camadas conforme o ADR de
+  2026-10-25 (secao 14): `apps/`, `services/`, `packages/` e `infrastructure/`; ainda sem codigo.
 - **Fuso operacional:** `America/Sao_Paulo`.
 - **Documentos:** planos, manifesto e estado do lote em `documentacoes/planejamento-ia/`;
   relatorios de review, auditoria e QA em `documentacoes/reviews/`. O registro de cada
@@ -172,11 +176,14 @@ estas regras e as secoes anteriores deste arquivo.
 - **Commits:** continua valendo "nao crie commits sem pedido explicito". O orquestrador so
   faz commits locais nas branches de tarefa e `revisao/` quando o pedido de execucao
   autorizar commits de forma explicita; nunca em `main`/`master`.
-- **Validacao:** ainda nao ha codigo nem comandos de lint, build ou teste. Quando `back/` ou
-  `front/` receberem codigo, declare aqui os comandos reais. Ate la, gate de build/teste de
-  codigo fica BLOCKED; entrega somente de documentacao registra NA com justificativa.
-- **Dados:** nao ha banco nem servico declarado. Nenhum teste ou script acessa banco ou
-  servico real sem um ambiente isolado declarado nesta secao.
+- **Validacao:** ainda nao ha codigo nem comandos de lint, build ou teste. Os comandos reais
+  serao declarados aqui apos ENT-FND-001 (monorepo `pnpm` e `uv`). Ate la, gate de build/teste
+  de codigo fica BLOCKED; entrega somente de documentacao registra NA com justificativa.
+- **Dados:** nao ha banco nem servico de producao declarado. Nenhum teste ou script acessa
+  banco ou servico real sem um ambiente isolado declarado nesta secao. Ambiente isolado de PoC
+  declarado: containers descartaveis (Docker/Compose) publicados somente em `127.0.0.1`, sem
+  dados reais e sem VPS, destruidos ao final de cada PoC. Qualquer outro banco ou servico
+  continua proibido.
 - **Contexto:** configuracao versionada em `scripts/contexto-projeto.json`, aplicada por
   `bash scripts/instalar-contexto.sh`. A CLI fica em `contexto/contexto.mjs`, pasta
   vizinha ao checkout principal. Antes de usar `_shared/scripts/preparar-contexto.mjs`
```

## Pendencias

- Aprovacao explicita do usuario da hipotese H-1 (segue em aberto).
- Registrar os comandos reais de build/teste em `CLAUDE.md` e na secao "Validacao" apos a integracao de ENT-FND-001.
- Registrar SHA e mensagem do commit desta tarefa no fechamento do lote (coordenador).
- QA independente em andamento; sem aprovacao ate sua conclusao.
