# Núcleos

Especificação e documentação do projeto: [Nucleos-Especificacao-Mestra.md](Nucleos-Especificacao-Mestra.md)
e [documentacoes/](documentacoes/). Regras para agentes de IA: [AGENTS.md](AGENTS.md) e [CLAUDE.md](CLAUDE.md).

## Contexto: memória local para os agentes de IA

O [Contexto](https://github.com/ViniciusBernucci/contexto) indexa os arquivos deste
projeto para que os agentes de IA busquem só os trechos necessários. Ele roda na
sua máquina e não usa internet, conta nem chave de API.

**Importante:** clonar este repositório não instala o Contexto. Cada pessoa precisa
fazer os passos abaixo uma vez, em cada máquina ou clone novo.

### 1. Conferir os pré-requisitos

```bash
node --version   # precisa ser v22.13 ou maior
git --version
```

Se o Node estiver abaixo da v22.13, atualize-o em <https://nodejs.org>. No Windows,
rode todos os comandos no **Git Bash**.

### 2. Baixar o Contexto ao lado deste projeto

O Contexto fica **fora** do repositório, numa pasta vizinha. Rode estes comandos na
pasta que **contém** `nucleos`:

```bash
git clone https://github.com/ViniciusBernucci/contexto.git
```

O resultado deve ficar assim:

```text
pasta-qualquer/
├── contexto/   ← a ferramenta
└── nucleos/    ← este repositório
```

Não é preciso rodar `npm install`.

### 3. Ativar o Contexto neste repositório

Os comandos seguintes são executados **dentro da pasta `nucleos`**:

```bash
cd nucleos
node ../contexto/contexto.mjs setup --project .
```

A resposta deve conter `"registered":true`. Esse comando instala um hook local do
Git e não altera nenhum arquivo versionado.

### 4. Preparar a branch de trabalho

O Contexto não funciona nas branches `main` e `master`. Troque para a branch de
trabalho e prepare-a:

```bash
git switch developer
node ../contexto/contexto.mjs ensure --project .
node ../contexto/contexto.mjs doctor --project .
```

O primeiro comando deve responder `"prepared":true`, e o segundo `"ok":true`. Isso cria a
pasta `.contexto/`, que guarda o índice e os dados locais. **Essa pasta nunca vai para o
Git.**

### 5. Testar

```bash
node ../contexto/contexto.mjs search --project . --query "lessons"
```

Se aparecer uma lista em `"hits"`, a instalação está concluída.

## Uso no dia a dia

| Situação | O que fazer |
| --- | --- |
| Criou uma worktree com `git worktree add` | Nada: o hook a prepara automaticamente |
| Mudou arquivos e quer atualizar o índice | `node ../contexto/contexto.mjs index --project .` |
| Moveu a pasta `contexto` ou atualizou o Node | Rode o passo 3 de novo |
| Clonou o projeto em outra máquina ou pasta | Repita os passos 1 a 5 |

Uma worktree criada ao lado de `nucleos` (por exemplo `../nucleos-minha-tarefa`) usa os
mesmos comandos. Se ela ficar dentro de `nucleos` (por exemplo `.worktrees/minha-tarefa`),
troque `../contexto` por `../../../contexto`.

## Problemas comuns

| Mensagem | Causa e solução |
| --- | --- |
| `Preparação automática não escreve em main/master` | Você está na `main`. Rode `git switch developer` |
| `Cannot find module .../contexto.mjs` | A pasta `contexto` não está ao lado de `nucleos`. Refaça o passo 2 |
| `SQLite indisponível` | O Node está desatualizado. Atualize para v22.13 ou maior |
| `ExperimentalWarning: SQLite is an experimental feature` | É só um aviso e pode ser ignorado |

Para configurações avançadas, como escolher as pastas indexadas ou usar MCP, veja o
[guia completo do Contexto](https://github.com/ViniciusBernucci/contexto/blob/main/INSTALL.md).
