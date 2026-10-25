# README de instalação do Contexto

**Data:** 2026-10-25

## Identificação

| Item | Valor |
| --- | --- |
| Domínio | `transversal` (ferramenta de desenvolvimento usada em todo o repositório) |
| Solicitação | 1) Criar um README simples, com comandos exatos, explicando como instalar o Contexto neste projeto. 2) Acrescentar o passo a passo para o Contexto funcionar automaticamente em toda sessão de IA, conferido na documentação da ferramenta. 3) Transformar os passos 6 a 8 em comandos de terminal, para uso por SSH numa VPS, e registrar o requisito de Git >= 2.36 encontrado na instalação da VPS |
| Branch | `developer` |
| Base / commit inicial | `25aa954` (`atualizacao`), HEAD de `developer` no início da tarefa; merge-base com `main`: `cb1885c` |
| Estado inicial da árvore | `developer` sincronizada com `origin/developer`, sem arquivos modificados |
| Estado final | Commit `cfaf2fb` (feito pelo usuário) com a primeira versão; acréscimo da parte 2 em `README.md` ainda não commitado |
| Autores | vinicius bernucci (solicitante, commit `cfaf2fb`), Claude Code (implementação) |

## Objetivo, contexto e escopo

O Contexto (<https://github.com/ViniciusBernucci/contexto>) é uma memória local para
agentes de IA. Ele foi instalado nesta máquina numa pasta vizinha a `nucleos` e
registrado no repositório. Clonar o `nucleos` não leva o Contexto junto: o programa, o hook
(`.git/hooks/post-checkout`) e os dados (`.contexto/`) ficam fora do que o Git versiona.

Além disso, ter a ferramenta preparada não faz o cliente de IA usá-la. A documentação do
Contexto (`tutorial_install_vps copy.md`, seções 14, 15 e 17, e `INSTALL.md`, seção 7) diz
que "o agente precisa usar a CLI ou a integração MCP". Por isso o README precisa explicar a
instalação **e** a integração com as sessões de IA.

**No escopo:**
- `README.md` da raiz com instalação (passos 1 a 5), integração automática com o Claude
  Code (passos 6 a 9), configuração opcional do Codex, uso diário e problemas comuns.

**Fora do escopo** (descrito no README, mas não aplicado neste repositório):
- criar `.mcp.json` e `.claude/settings.json`;
- acrescentar a regra ao `CLAUDE.md` e ao `AGENTS.md`;
- personalizar o `include` do `.contexto/project.json`;
- acrescentar `/.contexto/` ao `.gitignore` versionado;
- corrigir o caminho padrão de `.agents/skills/_shared/scripts/preparar-contexto.mjs`;
- alterar o repositório do Contexto.

## Resumo da implementação

O `README.md` da raiz foi organizado assim:

- **Cabeçalho curto** com links para a especificação e para as regras dos agentes.
- **Passos 1 a 5, feitos por cada pessoa:**
  1. conferir os pré-requisitos;
  2. clonar o Contexto numa pasta vizinha;
  3. rodar `setup`;
  4. rodar `ensure` e `doctor` na branch `developer`;
  5. testar com `search`.
- **Passos 6 a 8, feitos uma vez no repositório:**
  - `.mcp.json` com o servidor `node ../contexto/contexto.mjs mcp`;
  - `.claude/settings.json` com `enabledMcpjsonServers` e a permissão `mcp__contexto`;
  - um bloco de regra para o final do `CLAUDE.md` e do `AGENTS.md`.
  - Todos esses passos são comandos prontos para colar no terminal (`cat > ... <<'EOF'`,
    um laço com `awk` para acrescentar a regra, validação do JSON e
    `git add`/`commit`/`push` no passo 8.1).
- **Passo 9, feito por cada pessoa:** conferir com `claude mcp list`.
- **Requisito de Git >= 2.36** no passo 1, com os comandos de atualização no Ubuntu e uma
  linha nova na tabela de problemas comuns.
- **Codex (opcional):** um `codex mcp add` com caminhos absolutos, porque a configuração
  dele é global por usuário.
- **Tabelas de uso diário e de problemas comuns.**

## Mudanças por arquivo

| Arquivo | Mudança |
| --- | --- |
| `README.md` | Novo no commit `cfaf2fb`; ampliado (não commitado) com a integração das sessões de IA |
| `documentacoes/transversal/2026-10-25-readme-instalacao-contexto.md` | Este documento (fora do patch) |
| `documentacoes/transversal/2026-10-25-readme-instalacao-contexto-diffs.md` | Novo: diffs reais da tarefa (fora do patch) |

Não houve mudanças em testes, configurações ou migrações.

## Decisões técnicas

- **Ferramenta em pasta vizinha, não dentro do repositório.** Se ficasse dentro, o Contexto
  (que tem seu próprio `.git`) poderia entrar por engano num `git add .`. Com a pasta
  vizinha, os comandos e o `.mcp.json` podem usar o caminho fixo `../contexto`.
- **`.mcp.json` sem `--project`.** O `contexto.mjs` usa `process.cwd()` quando `--project`
  não é passado. Assim, um único arquivo versionado funciona no checkout e em worktrees
  vizinhas. A alternativa, caminhos absolutos, mudaria de máquina para máquina.
  Consequência: o Claude Code precisa ser aberto na raiz certa, e worktrees dentro de
  `nucleos` quebram o caminho relativo.
- **MCP mais regra.** A documentação do Contexto apresenta os dois mecanismos como
  complementares. O MCP dá as ferramentas, a regra faz o agente usá-las e cobre clientes
  sem MCP pela CLI.
- **`.claude/settings.json` versionado.** Evita a aprovação manual do servidor e das
  ferramentas. As quatro ferramentas são somente leitura (`readOnlyHint: true` em
  `lib/mcp.mjs`), então liberar todas não permite executar comandos.
- **Codex com configuração global.** `codex mcp add` grava em `~/.codex/config.toml`, fora do
  repositório, então o README trata o Codex como passo pessoal e opcional.
- **Comandos de terminal em vez de "crie o arquivo".** O acesso à VPS é só por SSH. Os
  comandos têm proteções:
  - o `ls` prévio evita sobrescrever um `.mcp.json` ou um `.claude/settings.json` que já
    exista;
  - o `grep` torna o passo 8 idempotente;
  - o `awk` grava o bloco com CRLF, porque `CLAUDE.md` e `AGENTS.md` estão versionados
    assim (`git ls-files --eol`: `i/crlf w/crlf`, sem `.gitattributes`), o que evita
    misturar estilos de linha.
- **Git >= 2.36.** A instalação na VPS falhou com `unknown switch 'z'`. A causa é
  `lib/worktrees.mjs:42`, que roda `git worktree list --porcelain -z`, opção que só existe
  a partir do Git 2.36. A documentação do Contexto pede `git --version`, mas não informa
  essa versão mínima. O `setup` falha em `discover()` antes de qualquer gravação, então não
  deixa estado parcial.
- **`ensure` explícito no passo 4.** O hook ignora o checkout principal, mesmo fora da
  `main`, então sem `ensure` a pasta `.contexto/` não seria criada.

## Validações

Executei os roteiros em clones descartáveis do `nucleos` e do `contexto`, em pastas
vizinhas dentro do diretório temporário da sessão. Nenhum arquivo do repositório real foi
usado como teste.

**Parte 1 (instalação):**

| Comando | Resultado real |
| --- | --- |
| `node --version` / `git --version` | `v24.14.1` / `git version 2.50.1 (Apple Git-155)` |
| `node ../contexto/contexto.mjs setup --project .` | `"registered":true`, `"automatic_hook":true`, `"tracked_files_changed":false` |
| `git switch main` e depois `git switch developer` | O hook rodou e não criou `.contexto/`, como esperado no checkout principal |
| `node ../contexto/contexto.mjs ensure --project .` | `"prepared":true`, `"created":true`, 2 fontes indexadas |
| `node ../contexto/contexto.mjs doctor --project .` | `"ok":true`, `"sqlite":"3.51.2"`, `"fts5":true` |
| `node ../contexto/contexto.mjs search --project . --query "lessons"` | `hits` retornou resultado em `CLAUDE.md` |
| `git worktree add -q ../nucleos-minha-tarefa -b minha-tarefa` | O hook criou `.contexto/` (`context.sqlite`, `project.json`) automaticamente |
| `git status --short` (clone e worktree) | Vazio: nenhum arquivo versionado foi alterado |
| `node ../naoexiste/contexto.mjs` | Erro `Cannot find module`, conforme a tabela de problemas comuns |

**Parte 2 (sessões de IA):**

| Comando | Resultado real |
| --- | --- |
| `initialize`, `tools/list` e `tools/call context_search` por stdio em `node ../contexto/contexto.mjs mcp`, sem `--project` | Respondeu `contexto-local 0.2.0`, listou as 4 ferramentas e devolveu hit em `CLAUDE.md` |
| `claude mcp list` com o `.mcp.json` do passo 6 (Claude Code 2.1.144) | `contexto: node ../contexto/contexto.mjs mcp - ✓ Connected` |
| `claude mcp get contexto` | `Scope: Project config (shared via .mcp.json)`, `Status: ✓ Connected` |
| `claude -p "...context_search..." --model haiku --allowedTools mcp__contexto__context_search` | A sessão chamou a ferramenta e respondeu `CLAUDE.md` |
| O mesmo `claude -p`, sem `--allowedTools`, com o `.claude/settings.json` do passo 7 | A sessão chamou a ferramenta sem pedir aprovação e respondeu `CLAUDE.md` |
| Commit dos dois arquivos no clone e `git worktree add -q ../nucleos-wt -b wt`, depois `claude mcp list` dentro da worktree | `.contexto/` criado pelo hook; `contexto ... ✓ Connected` |
| `CODEX_HOME=<pasta temporária> codex mcp add contexto-nucleos -- node ".../contexto.mjs" mcp --project ".../nucleos"` (codex-cli 0.164.0) | Gravou `[mcp_servers.contexto-nucleos]` com os argumentos corretos; `codex mcp list` mostrou `enabled` |

**Parte 3 (comandos de terminal).** Extraí os blocos `bash` entre `### 6.` e `### 9.`
direto do `README.md` e rodei com `bash` num clone descartável. Só troquei `git push` por
um `echo` e informei uma identidade Git temporária no `commit`:

| Etapa | Resultado real |
| --- | --- |
| `ls .mcp.json .claude/settings.json` | `No such file or directory` para os dois |
| Criação dos arquivos e validação com `node -e ...` | `JSON ok` |
| Laço do passo 8 | `CLAUDE.md: regra acrescentada` / `AGENTS.md: regra acrescentada` |
| Segunda execução do laço | `regra ja existe, nada alterado` nos dois arquivos |
| `file CLAUDE.md AGENTS.md` / `git ls-files --eol CLAUDE.md` | `with CRLF line terminators` / `i/crlf w/crlf` |
| `git status --short` antes do commit | Só `A .claude/settings.json`, `A .mcp.json`, `M AGENTS.md`, `M CLAUDE.md` |
| `git show --stat HEAD` | 4 arquivos, 38 inserções |
| `claude mcp list` | `contexto: node ../contexto/contexto.mjs mcp - ✓ Connected` |

A correção do Git na VPS foi feita pelo usuário, que confirmou que funcionou. Não tenho
acesso à VPS e não executei os comandos de `apt-get` do passo 1.

**Limitação:** não executei uma sessão real do Codex chamando as ferramentas. Isso exigiria
alterar a configuração global do usuário. Foram verificados só a sintaxe e o registro do
comando, numa configuração isolada.

Não há build, testes, lint ou formatador aplicáveis a um arquivo Markdown neste repositório.

## Impactos, riscos e rollback

- **Impacto:** só documentação. Este repositório não muda de comportamento, configuração
  nem dados até que alguém aplique os passos 6 a 8.
- **Riscos de quem aplicar os passos 6 a 8:**
  - o `.claude/settings.json` versionado vale para todas as sessões do Claude Code no
    projeto;
  - o índice padrão só inclui `AGENTS.md` e `CLAUDE.md`, então as buscas ficam limitadas
    até ajustar o `include`;
  - um processo MCP fica preso à raiz em que foi aberto;
  - trechos devolvidos podem ficar desatualizados (*stale*) até rodar `index`.
- **Compatibilidade:**
  - Node >=22.13;
  - mesma organização de pastas em macOS, Linux e Windows (Git Bash);
  - Claude Code 2.1.144 e codex-cli 0.164.0 testados.
- **Rollback:** reverter `README.md` para a versão de `cfaf2fb` (`git checkout -- README.md`)
  ou reverter o commit.

## Commits e diffs

- `cfaf2fb32dfdf1685c8cdee380d832d3d5e1f863`, `readme contexto`, autor vinicius bernucci.
  Contém a primeira versão do `README.md` (blob `2e35451`) e este documento.
- Nenhum commit criado pelo Claude nesta tarefa. As ampliações do `README.md` (partes 2 e
  3) estão unstaged; não há diff staged.

Os patches completos estão em
[2026-10-25-readme-instalacao-contexto-diffs.md](2026-10-25-readme-instalacao-contexto-diffs.md).

## Lessons

Nenhuma lesson criada ou atualizada. A entrega é só documentação operacional de uma
ferramenta Node.js e de configuração de clientes de IA. Ela não introduz, altera nem
exercita conceito de C#/.NET, e criar uma lesson aqui seria artificial, como o `CLAUDE.md`
alerta. `lessons/` continua vazia, sem `README.md` de índice, e nenhum link foi afetado.

## Pendências

Não há pendências desta tarefa. Para que as sessões de IA passem a usar o Contexto, alguém
precisa aplicar os passos 6 a 8 do README e commitá-los. Melhorias opcionais, fora do escopo
e não executadas:
- ampliar o `include` do Contexto para `Nucleos-Especificacao-Mestra.md`, `documentacoes/`
  e `lessons/`;
- acrescentar `/.contexto/` ao `.gitignore` versionado;
- ajustar o caminho padrão de `.agents/skills/_shared/scripts/preparar-contexto.mjs`, que
  procura `.agents/contexto/contexto.mjs`, ou documentar `CONTEXTO_CLI`;
- no repositório `contexto`:
  - documentar Git >= 2.36 no `INSTALL.md` e no tutorial da VPS;
  - corrigir o link para `tutorial_install_vps.md`, já que o arquivo se chama
    `tutorial_install_vps copy.md`.
