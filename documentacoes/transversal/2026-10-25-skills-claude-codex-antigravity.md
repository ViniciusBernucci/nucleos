# Skills para Claude Code, Codex e Antigravity

**Data:** 2026-10-25

## Identificação

| Item | Valor |
| --- | --- |
| Domínio | `transversal` (fluxo de desenvolvimento com IA usado em todo o repositório) |
| Solicitação | Preparar todas as skills de `skills/` para funcionarem no projeto com Claude, Codex e Antigravity, e acrescentar às regras de cada agente as orientações de `skills/modelos/` |
| Branch | `developer` |
| Base / commit inicial | `69496e1` (`readme`), HEAD de `developer` no início da tarefa; merge-base com `main`: `cb1885c` |
| Estado inicial da árvore | Pendências não commitadas da tarefa anterior ([README de instalação do Contexto](2026-10-25-readme-instalacao-contexto.md)): `README.md`, `scripts/instalar-contexto.sh` e os documentos dela |
| Estado final | Nada commitado; arquivos listados em "Mudanças por arquivo" |
| Autores | vinicius bernucci (solicitante), Claude Code (implementação) |

## Objetivo, contexto e escopo

`skills/` é uma distribuição. `skills/skills/` é a fonte com 15 skills, e há cópias em
`skills/.agents`, `skills/.claude` e `skills/.agent`, conferidas por
`skills/scripts/sincronizar-skills.mjs`. Na raiz do projeto, porém, só existia
`.agents/skills/`. Por isso o Claude Code e o Antigravity legado não descobriam as skills.
Além disso, o `README.md` dessa pasta era de outro projeto (Intranet/ORCA, caminho
`D:\Documentos\...`).

`skills/modelos/README.md` pede três coisas: acrescentar o bloco de `modelos/CLAUDE.md` e
`modelos/AGENTS.md` às regras do projeto sem substituí-las, declarar os fatos locais
(repositórios, validação, documentos e worktrees, políticas, Contexto) e não alterar as
skills.

**No escopo:**
- instalar as 15 skills em `.claude/skills/`, `.agents/skills/` e `.agent/skills/`;
- criar um script de sincronização a partir da fonte;
- acrescentar o bloco do modelo e os fatos do projeto a `CLAUDE.md`, `AGENTS.md` e
  `.agents/rules/project-instructions.md`, que é a regra Always On do Antigravity;
- versionar o `workflow` e as fontes indexadas pelo Contexto (`scripts/contexto-projeto.json`)
  e aplicá-los pelo `scripts/instalar-contexto.sh`;
- atualizar o README.

**Fora do escopo:**
- alterar qualquer arquivo de `skills/`;
- alterar a skill `archify`;
- autenticar clientes de IA (o usuário pediu para não autenticar);
- criar `.mcp.json` ou `.claude/settings.json`;
- definir comandos de build/teste, que ainda não existem.

## Resumo da implementação

1. **Instalação das skills.** `scripts/instalar-skills.mjs --apply` copiou os 44 arquivos de
   `skills/skills/` para cada destino:
   - `.claude/skills/` e `.agent/skills/` são pastas novas;
   - `.agents/skills/` teve só o `README.md` estrangeiro substituído;
   - o `archify` foi preservado.
2. **Regras.** O bloco de `skills/modelos/CLAUDE.md` (idêntico ao de `AGENTS.md`) foi
   acrescentado sem alteração, com o título rebaixado para `##`. Depois dele vêm duas
   seções:
   - "Configuracao do fluxo de skills neste projeto", com os fatos locais;
   - "Contexto (memoria local)", a mesma do passo 8 do README. Assim o comando do README
     reconhece que ela já existe.

   O bloco foi gravado nos três arquivos de regras, em CRLF.
3. **Configuração do Contexto.** `scripts/contexto-projeto.json` define:
   - `include`: especificação, `documentacoes`, `lessons`, `back`, `front`, `README.md`,
     `AGENTS.md` e `CLAUDE.md`;
   - `exclude`: as cópias de skills, entre outros;
   - `workflow`: fuso `America/Sao_Paulo`, pastas em `documentacoes/` e worktrees em
     `../nucleos-worktrees`.

   O `instalar-contexto.sh` ganhou a etapa 4.1, que aplica esse arquivo em
   `.contexto/project.json`, roda `setup --config-from` e reindexa, só quando há diferença.
4. **README.** Ganhou a seção "Skills de IA" e a menção à configuração versionada.

## Mudanças por arquivo

| Arquivo | Mudança |
| --- | --- |
| `.claude/skills/**` | Novo: 44 arquivos idênticos a `skills/skills/` |
| `.agent/skills/**` | Novo: 44 arquivos idênticos a `skills/skills/` |
| `.agents/skills/README.md` | Substituído pela versão genérica da distribuição |
| `CLAUDE.md`, `AGENTS.md`, `.agents/rules/project-instructions.md` | +61 linhas no final cada: bloco do modelo, fatos do projeto e regra do Contexto |
| `scripts/instalar-skills.mjs` | Novo: sincroniza `skills/skills/` com as três pastas de descoberta (`--apply`/`--check`) |
| `scripts/contexto-projeto.json` | Novo: `include`, `exclude` e `workflow` versionados |
| `scripts/instalar-contexto.sh` | Etapa 4.1 e comentário de cabeçalho (o arquivo foi criado na tarefa anterior e ainda não está commitado) |
| `README.md` | Seção "Skills de IA" e uma frase na "Instalação rápida" |
| `documentacoes/transversal/2026-10-25-skills-claude-codex-antigravity*.md` | Este documento e o de diffs (fora do patch) |

Não houve mudanças em testes, migrações ou código de aplicação. `.contexto/project.json` e
os metadados `.git/contexto/` foram atualizados localmente pelo script; eles não são
versionados.

## Decisões técnicas

- **Script próprio em vez do `skills/scripts/sincronizar-skills.mjs`.** O script da
  distribuição só escreve dentro de `skills/`. O novo segue a mesma lógica (sem links,
  comparação byte a byte), mas grava na raiz do projeto, ignora `.DS_Store` e trata extras
  como esperados (`archify`), sem reprovar o `--check`.
- **Antigravity pela regra existente.** `.agents/rules/project-instructions.md` já se
  declara regra de workspace Always On. Acrescentar o bloco ali evita criar uma regra nova,
  que precisaria ser ativada na interface.
- **`CONTEXTO_CLI` calculado pelo diretório Git comum.** O helper
  `_shared/scripts/preparar-contexto.mjs` procura a ferramenta em `.claude/contexto/` ou
  `.agents/contexto/`, que não existem. O modelo manda usar `CONTEXTO_CLI` em vez de editar
  a skill. A expressão `$(git rev-parse --path-format=absolute --git-common-dir)/../..`
  chega à pasta que contém o `nucleos` a partir de qualquer worktree.
- **`workflow` versionado.** O `.contexto/project.json` local tinha os defaults do Contexto
  (UTC, `docs/...`, `.worktrees`), em conflito com o `CLAUDE.md`. Com
  `--config-from`, as worktrees futuras herdam a configuração corrigida.
- **Worktrees em `../nucleos-worktrees`.** Ficar fora do repositório evita indexar ou
  commitar worktrees. O `CONTEXTO_CLI` absoluto cobre a mudança de profundidade.
- **Valores escolhidos por mim, a confirmar pelo usuário:** fuso `America/Sao_Paulo`,
  `documentacoes/planejamento-ia/`, `documentacoes/reviews/`, `../nucleos-worktrees` e a
  regra de commits do orquestrador (só com autorização explícita no pedido, preservando a
  regra do `CLAUDE.md`).
- **Cópias registradas por hash.** As 88 cópias são idênticas à fonte, que já está
  versionada. O arquivo de diffs lista o SHA-256 de cada arquivo em vez de repetir ~550 KB.

## Validações

| Comando / verificação | Resultado real |
| --- | --- |
| `node skills/scripts/sincronizar-skills.mjs --check` (distribuição, antes) | `15 skills; 44 arquivos por destino; 3 destinos; 0 divergências; 0 extras.` |
| `node scripts/instalar-skills.mjs --check` (antes) | `89 divergências; 1 extras preservados`, exit 1 |
| `node scripts/instalar-skills.mjs --apply` | `89 arquivos copiados; 1 extras preservados` |
| `node scripts/instalar-skills.mjs --check` (depois) | `15 skills; 44 arquivos por destino; 3 destinos; 0 divergências; 1 extras preservados.`, exit 0 |
| `diff -rq skills/skills .claude/skills` / `.agent/skills` / `.agents/skills` | Sem diferenças, exceto `Only in .agents/skills: archify` |
| `diff` do bloco do modelo contra `skills/modelos/CLAUDE.md` | Idêntico |
| `file CLAUDE.md AGENTS.md .agents/rules/project-instructions.md` | `with CRLF line terminators` |
| Clone descartável: aplicar `contexto-projeto.json`, `setup --config-from .`, `index` | `"sources":38` (antes 3); `search "tenant"` devolveu `documentacoes/backlog/EP-03-.../README.md` |
| Clone descartável: `git worktree add ../nucleos-worktrees/teste` | A worktree herdou `timezone: America/Sao_Paulo` e `include` com 8 itens |
| `CONTEXTO_CLI=... node .agents/skills/_shared/scripts/preparar-contexto.mjs --project $(pwd)` no checkout e na worktree | `"prepared":true` nos dois |
| `bash scripts/instalar-contexto.sh` (repositório real), duas vezes | 1ª: `Configuracao ... aplicada e indice refeito`; 2ª: `ja aplicada` |
| `bash -n scripts/instalar-contexto.sh` | Sem erros |
| `claude -p "...liste as skills..." --model haiku` | Listou 14 nomes; uma segunda pergunta confirmou que a `simplify` do projeto está disponível junto com a embutida do Claude Code |
| Esta sessão do Claude Code | Passou a listar as 15 skills do projeto |
| `codex exec --sandbox read-only "...liste as skills..."` | Listou as 15 skills e o `archify` |
| `agy -p ...` (Antigravity) | Não executado: pediu autenticação, e o usuário pediu para não autenticar. A descoberta no Antigravity não foi comprovada |

Não há build, testes de aplicação ou lint aplicáveis.

## Impactos, riscos e rollback

- **Impacto:** as skills passam a ser descobertas pelos três clientes, e as regras passam a
  conter o contrato das skills e os fatos do projeto. Comportamento de aplicação: nenhum.
- **Riscos:**
  - três cópias para manter, mitigadas pelo `--check`;
  - `/simplify` ambíguo no Claude Code;
  - valores de configuração escolhidos sem confirmação;
  - o `CLAUDE.md` exige C#/.NET e a especificação (ADR) cita NestJS, Python e Next.js;
    essa divergência não foi resolvida.
- **Rollback:**
  - remover `.claude/skills/` e `.agent/skills/`;
  - `git checkout -- .agents/skills/README.md CLAUDE.md AGENTS.md .agents/rules/project-instructions.md`;
  - apagar `scripts/instalar-skills.mjs` e `scripts/contexto-projeto.json`;
  - reverter a etapa 4.1 do script.

  O `.contexto/project.json` local pode ser recriado com `ensure` após apagá-lo.

## Commits e diffs

- `eb337d7` (`skills`), feito pelo usuário, contém as mudanças desta tarefa e as pendências
  da tarefa anterior.
- `d54f871`, merge de `origin/developer`, feito pelo Claude a pedido do usuário depois de um
  `git push` recusado. O remoto trazia `e19a720` (`contexto app`, feito na VPS com os passos
  6 a 8 do README: `.mcp.json`, `.claude/settings.json` e o bloco "Contexto (memoria
  local)" no `CLAUDE.md` e no `AGENTS.md`). O conflito em `CLAUDE.md` e `AGENTS.md` foi
  resolvido mantendo a versão local, porque o bloco do remoto é idêntico ao que já existia
  nela (comparado sem `\r`). Resultado: uma ocorrência do bloco por arquivo, CRLF preservado
  e `claude mcp list` mostrando `contexto ... ✓ Connected`.

Os diffs gerados antes do commit, os arquivos novos e os hashes das cópias estão em
[2026-10-25-skills-claude-codex-antigravity-diffs.md](2026-10-25-skills-claude-codex-antigravity-diffs.md).

`README.md` e `scripts/instalar-contexto.sh` também têm alterações pendentes da tarefa
anterior. O arquivo de diffs indica quais trechos pertencem a esta tarefa.

## Lessons

Nenhuma lesson criada ou atualizada. A entrega instala arquivos Markdown de skills, escreve
regras de agentes e cria scripts Node.js/Bash de instalação. Ela não introduz, altera nem
exercita conceito de C#/.NET. `lessons/` continua vazia e nenhum link foi afetado.

## Pendências

- Confirmar ou ajustar os valores escolhidos (ver "Decisões técnicas").
- Comprovar a descoberta no Antigravity abrindo o projeto nele (não autenticado nesta tarefa).
- Declarar os comandos reais de lint, build e teste quando `back/` ou `front/` tiverem código.
- Resolver a divergência de stack entre o `CLAUDE.md` (C#/.NET) e a especificação.
- Fazer commit das mudanças. Na VPS: `git pull` e `bash scripts/instalar-contexto.sh`.
