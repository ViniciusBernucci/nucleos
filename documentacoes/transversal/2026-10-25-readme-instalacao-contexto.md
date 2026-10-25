# README de instalação do Contexto

**Data:** 2026-10-25

## Identificação

| Item | Valor |
| --- | --- |
| Domínio | `transversal` (ferramenta de desenvolvimento usada em todo o repositório) |
| Solicitação | Criar um README simples, com comandos exatos, explicando como instalar o Contexto neste projeto |
| Branch | `developer` |
| Base / commit inicial | `25aa954` (`atualizacao`), HEAD de `developer` no início da tarefa; merge-base com `main`: `cb1885c` |
| Estado inicial da árvore | `developer` sincronizada com `origin/developer`, sem arquivos modificados |
| Estado final | `README.md` novo, não rastreado; nenhum commit criado |
| Autores | vinicius bernucci (solicitante), Claude Code (implementação) |

## Objetivo, contexto e escopo

O Contexto (<https://github.com/ViniciusBernucci/contexto>) é uma memória local para
agentes de IA. Ele foi instalado nesta máquina numa pasta vizinha a `nucleos` e
registrado no repositório. Clonar o `nucleos` não leva o Contexto junto: o programa, o hook
(`.git/hooks/post-checkout`) e os dados (`.contexto/`) ficam fora do que o Git versiona.
Por isso, quem clona o projeto precisa de instruções claras para reativá-lo.

**No escopo:** criar o `README.md` da raiz com o passo a passo de instalação, uso diário
e problemas comuns.

**Fora do escopo:**
- personalizar o `include` do `.contexto/project.json`;
- acrescentar `/.contexto/` ao `.gitignore` versionado;
- configurar MCP;
- alterar o repositório do Contexto.

## Resumo da implementação

Criei o `README.md` na raiz, que ainda não existia. Ele tem um cabeçalho curto com links
para a especificação e para as regras dos agentes, e depois cinco passos numerados:

1. conferir os pré-requisitos;
2. clonar o Contexto numa pasta vizinha;
3. rodar `setup`;
4. rodar `ensure` e `doctor` na branch `developer`;
5. testar com `search`.

Em seguida vêm uma tabela de uso diário e uma tabela de erros comuns. Todos os comandos
usam caminhos relativos (`../contexto`, `--project .`), então funcionam em qualquer
máquina que mantenha essa organização de pastas.

## Mudanças por arquivo

| Arquivo | Mudança |
| --- | --- |
| `README.md` | Novo: guia de instalação e uso do Contexto |
| `documentacoes/transversal/2026-10-25-readme-instalacao-contexto.md` | Novo: este documento (fora do patch) |

Não houve mudanças em testes, configurações ou migrações.

## Decisões técnicas

- **Ferramenta em pasta vizinha, não dentro do repositório.** Se ficasse dentro, o Contexto
  (que tem seu próprio `.git`) poderia entrar por engano num `git add .`. Com a pasta
  vizinha, os comandos podem usar o caminho fixo `../contexto`. A alternativa seria um
  caminho absoluto, que muda de máquina para máquina.
- **README na raiz, não em `documentacoes/`.** É o primeiro arquivo que alguém vê ao clonar.
  A consequência é que o README da raiz passa a conter só esta orientação, além dos links
  do cabeçalho, e pode ser ampliado depois.
- **`ensure` explícito no passo 4.** O hook ignora o checkout principal, mesmo fora da
  `main`, então sem `ensure` a pasta `.contexto/` não seria criada.
- **Comandos em Bash.** No Windows, o Contexto já exige o Bash do Git for Windows.

## Validações

Executei o roteiro do README num clone descartável. O `nucleos` e o `contexto` foram
clonados em pastas vizinhas dentro do diretório temporário da sessão:

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

Não há build, testes, lint ou formatador aplicáveis a um arquivo Markdown neste repositório.

## Impactos, riscos e rollback

- **Impacto:** só documentação. Não muda comportamento, configuração nem dados.
- **Risco:** o índice padrão do Contexto só inclui `AGENTS.md` e `CLAUDE.md`, porque as
  pastas padrão (`docs`, `src`, `tests`) não existem no `nucleos`. O README avisa que
  ajustes avançados ficam no guia completo.
- **Compatibilidade:** os comandos exigem Node >=22.13 e mantêm a mesma organização de
  pastas em macOS, Linux e Windows (Git Bash).
- **Rollback:** apagar o `README.md`.

## Commits e diffs

Nenhum commit criado nesta tarefa. Não há diff staged. O diff não rastreado de `README.md`
segue abaixo:

```diff
diff --git a/README.md b/README.md
new file mode 100644
index 0000000..2e35451
--- /dev/null
+++ b/README.md
@@ -0,0 +1,102 @@
+# Núcleos
+
+Especificação e documentação do projeto: [Nucleos-Especificacao-Mestra.md](Nucleos-Especificacao-Mestra.md)
+e [documentacoes/](documentacoes/). Regras para agentes de IA: [AGENTS.md](AGENTS.md) e [CLAUDE.md](CLAUDE.md).
+
+## Contexto: memória local para os agentes de IA
+
+O [Contexto](https://github.com/ViniciusBernucci/contexto) indexa os arquivos deste
+projeto para que os agentes de IA busquem só os trechos necessários. Ele roda na
+sua máquina e não usa internet, conta nem chave de API.
+
+**Importante:** clonar este repositório não instala o Contexto. Cada pessoa precisa
+fazer os passos abaixo uma vez, em cada máquina ou clone novo.
+
+### 1. Conferir os pré-requisitos
+
+```bash
+node --version   # precisa ser v22.13 ou maior
+git --version
+```
+
+Se o Node estiver abaixo da v22.13, atualize-o em <https://nodejs.org>. No Windows,
+rode todos os comandos no **Git Bash**.
+
+### 2. Baixar o Contexto ao lado deste projeto
+
+O Contexto fica **fora** do repositório, numa pasta vizinha. Rode estes comandos na
+pasta que **contém** `nucleos`:
+
+```bash
+git clone https://github.com/ViniciusBernucci/contexto.git
+```
+
+O resultado deve ficar assim:
+
+```text
+pasta-qualquer/
+├── contexto/   ← a ferramenta
+└── nucleos/    ← este repositório
+```
+
+Não é preciso rodar `npm install`.
+
+### 3. Ativar o Contexto neste repositório
+
+Os comandos seguintes são executados **dentro da pasta `nucleos`**:
+
+```bash
+cd nucleos
+node ../contexto/contexto.mjs setup --project .
+```
+
+A resposta deve conter `"registered":true`. Esse comando instala um hook local do
+Git e não altera nenhum arquivo versionado.
+
+### 4. Preparar a branch de trabalho
+
+O Contexto não funciona nas branches `main` e `master`. Troque para a branch de
+trabalho e prepare-a:
+
+```bash
+git switch developer
+node ../contexto/contexto.mjs ensure --project .
+node ../contexto/contexto.mjs doctor --project .
+```
+
+O primeiro comando deve responder `"prepared":true`, e o segundo `"ok":true`. Isso cria a
+pasta `.contexto/`, que guarda o índice e os dados locais. **Essa pasta nunca vai para o
+Git.**
+
+### 5. Testar
+
+```bash
+node ../contexto/contexto.mjs search --project . --query "lessons"
+```
+
+Se aparecer uma lista em `"hits"`, a instalação está concluída.
+
+## Uso no dia a dia
+
+| Situação | O que fazer |
+| --- | --- |
+| Criou uma worktree com `git worktree add` | Nada: o hook a prepara automaticamente |
+| Mudou arquivos e quer atualizar o índice | `node ../contexto/contexto.mjs index --project .` |
+| Moveu a pasta `contexto` ou atualizou o Node | Rode o passo 3 de novo |
+| Clonou o projeto em outra máquina ou pasta | Repita os passos 1 a 5 |
+
+Uma worktree criada ao lado de `nucleos` (por exemplo `../nucleos-minha-tarefa`) usa os
+mesmos comandos. Se ela ficar dentro de `nucleos` (por exemplo `.worktrees/minha-tarefa`),
+troque `../contexto` por `../../../contexto`.
+
+## Problemas comuns
+
+| Mensagem | Causa e solução |
+| --- | --- |
+| `Preparação automática não escreve em main/master` | Você está na `main`. Rode `git switch developer` |
+| `Cannot find module .../contexto.mjs` | A pasta `contexto` não está ao lado de `nucleos`. Refaça o passo 2 |
+| `SQLite indisponível` | O Node está desatualizado. Atualize para v22.13 ou maior |
+| `ExperimentalWarning: SQLite is an experimental feature` | É só um aviso e pode ser ignorado |
+
+Para configurações avançadas, como escolher as pastas indexadas ou usar MCP, veja o
+[guia completo do Contexto](https://github.com/ViniciusBernucci/contexto/blob/main/INSTALL.md).
```

## Lessons

Nenhuma lesson criada ou atualizada. A entrega é só documentação operacional de uma
ferramenta Node.js e não introduz, altera nem exercita conceito de C#/.NET. Criar uma
lesson aqui seria artificial, como o `CLAUDE.md` alerta. `lessons/` continua vazia, sem
`README.md` de índice, e nenhum link foi afetado.

## Pendências

Não há pendências desta tarefa. Melhorias opcionais, fora do escopo e não executadas:
- acrescentar `/.contexto/` ao `.gitignore` versionado;
- ampliar o `include` do Contexto para `Nucleos-Especificacao-Mestra.md`, `documentacoes/`
  e `lessons/`.
