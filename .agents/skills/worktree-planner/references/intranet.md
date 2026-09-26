## Invariantes de registro e autorização

Os caminhos abaixo são o perfil Intranet/Orca original. Confirme os caminhos reais antes de gerar comandos; não aplique esse perfil a outro projeto. Instruções explícitas do usuário prevalecem sobre as convenções deste perfil.

O registro captura apenas as alterações desta entrega: inclua alterações staged, unstaged e arquivos novos pertinentes, sem duplicar trechos. Não inclua o próprio registro, relatórios gerados, segredos, binários ou alterações de terceiros no diff documental. Para binários, registre caminho e efeito; para conteúdo sensível, descreva a alteração com redação. `git diff` sozinho não cobre staged nem arquivos não rastreados. Antes de commitar, confira o índice inteiro: se houver alterações staged alheias, não as inclua nem as remova silenciosamente.

O índice diário exige conferir se a linha desta entrega já existe antes de acrescentar. Escritas concorrentes precisam ser serializadas ou protegidas por lock; estar fora do Git não elimina corridas. Não use o hash de HEAD como prova de commit de trabalho ainda não commitado. Publicar o resumo no ClickUp é outra ação, dependente de autorização já existente ou pedido explícito.

# Worktree Feature Planner

Conduz entrevista estruturada, escreve a **especificação** de cada tarefa (spec-driven) e **grava
em arquivos** o plano completo — incluindo, para cada worktree, o **prompt pronto para colar no
Claude CLI**.

A saída desta skill são **arquivos em disco**, não texto no chat. O chat recebe só o resumo e os
caminhos.

---

## 1. Contexto fixo do projeto (nunca perguntar ao usuário)

| O que                         | Caminho                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Backend (Laravel)             | `D:\Documentos\00 - Dev\docker-intranet\app` — escreve em `app\` e `database\` |
| Frontend (Angular)            | `D:\Documentos\00 - Dev\intranetNova` — escreve em `src\app\`                  |
| Worktree de backend (código)  | `C:\Users\vinicius.silva\orca\workspaces\app\`                                 |
| Worktree de frontend (código) | `C:\Users\vinicius.silva\orca\workspaces\intranetNova\`                        |
| Planos gerados                | `D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\`                    |

`<obrigatório>` **Quem cria a worktree é o app orca, não o GitKraken.** No app orca você escolhe o
repositório e dá nome à worktree; a pasta nasce automática dentro de `orca\workspaces\{app|
intranetNova}\`. Se qualquer bloco gerado ainda mencionar GitKraken ou `D:\...\worktrees\`, é
resíduo de versão antiga da skill — corrija antes de entregar. `</obrigatório>`

`<obrigatório>`

**A raiz do backend é `...\docker-intranet\app`, com o `\app` no fim.** A pasta `docker-intranet`
não é repositório git — `git -C "...\docker-intranet" <algo>` devolve `fatal: not a git repository`
e a worktree nunca é criada. Confira cada `git -C` que você gerar.

Consequências que aparecem nos arquivos gerados:

- O código Laravel fica em `...\docker-intranet\app\app\Http\...` — `app` duas vezes. Não "corrija".
- Uma worktree de backend nasce como cópia da pasta `app\`: na raiz dela ficam `composer.json`,
  `artisan`, `routes\`, `docs\`, `CLAUDE.md` e `CLAUDE.worktree.md`, todos versionados.
- O `.claude\` do projeto (skills, agents, o CLAUDE.md de orquestração) vive em
  `docker-intranet\.claude\`, **fora** do repositório, e **não existe dentro de uma worktree de
  backend**. O que existe lá é `.claude\context\api-contracts\`. Nunca mande um agente de worktree
  ler `.claude\skills\` ou `.claude\CLAUDE.md`. Se uma regra de skill for indispensável, transcreva
  o trecho no próprio prompt.

`</obrigatório>`

### 1.1 Duas worktrees por feature — no máximo, sempre

`<obrigatório>`

**Toda feature gera no máximo DUAS worktrees: uma de backend e uma de frontend.** Nunca três, nunca
uma por tarefa, nunca uma por módulo. Esse é o padrão deste perfil; um pedido explícito diferente exige adaptar o plano e seus contratos.

| Feature toca           | Worktrees                     |
| ---------------------- | ----------------------------- |
| Só backend             | 1 — `{id}-backend-{assunto}`  |
| Só frontend            | 1 — `{id}-frontend-{assunto}` |
| Backend **e** frontend | 2 — uma de cada               |

**Todas** as tarefas de backend entram na worktree de backend, numeradas na ordem de execução
dentro do mesmo prompt. Idem para o frontend. Quantidade de tarefas, tamanho do escopo e risco de
conflito **não** são critério: o único critério é a camada.

| Item                          | Backend                                                              | Frontend                                                                       |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Pasta (criada pelo orca)      | `C:/Users/vinicius.silva/orca/workspaces/app/{id}-backend-{assunto}` | `C:/Users/vinicius.silva/orca/workspaces/intranetNova/{id}-frontend-{assunto}` |
| Branch como o orca cria       | `{id}-backend-{assunto}`                                             | `{id}-frontend-{assunto}`                                                      |
| Branch final, após o renomeio | `{feat\|fix\|refactor}/{id}-{assunto}`                               | **a mesma**                                                                    |
| Arquivo do plano              | `01-{id}-backend-{assunto}.md`                                       | `02-{id}-frontend-{assunto}.md`                                                |

A branch **final** tem o mesmo nome nos dois repositórios — repositórios diferentes não colidem, e o
nome igual é o que liga as duas metades. Por isso ela **não** leva a camada no nome.

`</obrigatório>`

### 1.1.1 O orca não pergunta o nome da branch — quem renomeia é o agente

`<obrigatório>`

**O app orca não tem campo de branch.** Ele pergunta só o repositório e o nome da worktree, e cria a
branch com **exatamente esse nome**: uma worktree chamada `{id}-frontend-{assunto}` nasce na branch
`{id}-frontend-{assunto}`, sem prefixo `feat/`, `fix/` ou `refactor/`.

Por isso **todo plano declara os dois nomes**, nunca só um:

|                        | Valor                                  | Quem produz                                                           |
| ---------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Branch que o orca cria | `{id}-{backend\|frontend}-{assunto}`   | o orca, sozinho                                                       |
| Branch final           | `{feat\|fix\|refactor}/{id}-{assunto}` | o **agente**, no primeiro passo do prompt, com `git branch -m` (§8.3) |

Declarar só a branch final é **o erro clássico desta skill**: o agente abre a worktree, roda
`branch --show-current`, lê `{id}-frontend-{assunto}` em vez de `feat/{id}-{assunto}`, e trava antes
de tocar em qualquer código — "a branch atual diverge do esperado". Se um plano gerado disser
"Branch: `feat/{id}-{assunto}`" sem dizer de onde esse nome veio, ele **está errado**; refaça.

**A pasta continua com o nome antigo depois do renomeio.** `git branch -m` muda só a branch — a
worktree segue em `orca/workspaces/{app|intranetNova}/{id}-{camada}-{assunto}`. Todo `git -C` do
plano usa o **caminho da pasta**, nunca o nome da branch. Não "corrija" esse descasamento.

`</obrigatório>`

### 1.2 Shell dos comandos gerados

`<obrigatório>`

Todo bloco de comando gerado é **Git Bash**, com **barra normal** e **sempre entre aspas duplas**:

```bash
git -C "D:/Documentos/00 - Dev/docker-intranet/app" status
```

No bash a barra invertida é escape (`D:\Documentos\...` vira `DDocumentos...`) e o espaço em
`00 - Dev` quebra o argumento sem aspas. Os dois erros produzem `fatal: cannot change to ...` ou
`too many arguments`, e a mensagem aponta para o lugar errado.

Nunca gere PowerShell (`@"..."@`, `Set-Content`, `New-Item`, `Out-Null`). Arquivo se escreve com
heredoc `<<'EOF'` — as aspas simples impedem interpolação de `$` e crases.

**Exceção:** o bloco ` ```text ` do prompt do CLI (§6.3). Ali os caminhos são lidos pelo agente com
Read/Glob, não passam por shell, e seguem com `\` como no resto do `CLAUDE.md`, sem aspas.

`</obrigatório>`

Particularidade do frontend: `npm install` puro falha em `ERESOLVE` (peer
`platform-browser-dynamic` do `ngx-charts`). Toda worktree de frontend usa
`npm install --legacy-peer-deps`.

### 1.3 ID da tarefa no ClickUp — em todo nome e em todo arquivo

`<obrigatório>`

Todo plano carrega o **ID da tarefa no ClickUp**, para que qualquer worktree, branch ou arquivo de
plano leve de volta à tarefa. O ID é perguntado **sempre** na Fase 1 (§3) — nunca inferido, nunca
pulado, mesmo que o usuário já tenha descrito tudo.

**Normalização do `{id}`:** minúsculas, sem `#`, sem espaço, só `[a-z0-9-]`. `#86B2XK4Z1` →
`86b2xk4z1`; `DEV-123` → `dev-123`. Qualquer outro caractere quebra nome de branch ou de pasta.

| Onde                                                                                              | Com ID                                                                                                                                   | Sem ID vinculado                           |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Nome da worktree = branch do orca                                                                 | `{id}-backend-{assunto}` · `{id}-frontend-{assunto}`                                                                                     | `backend-{assunto}` · `frontend-{assunto}` |
| Pasta da worktree                                                                                 | `.../workspaces/app/{id}-backend-{assunto}` · `.../workspaces/intranetNova/{id}-frontend-{assunto}`                                      | idem, sem `{id}-`                          |
| Branch final                                                                                      | `{feat\|fix\|refactor}/{id}-{assunto}`                                                                                                   | `{feat\|fix\|refactor}/{assunto}`          |
| Arquivos do plano                                                                                 | `00-plano-{id}-{assunto}.md` · `01-{id}-backend-{assunto}.md` · `02-{id}-frontend-{assunto}.md` · `99-merge-e-limpeza-{id}-{assunto}.md` | os mesmos, sem `{id}-`                     |
| Texto: `00-plano`, cabeçalho do `01`/`02`, âncora (§8.1), REGRAS FIXAS e `CLAUDE.local.md` (§8.3) | `Tarefa ClickUp: {id}` (e o link, quando houver)                                                                                         | `Tarefa ClickUp: não possui ID vinculado`  |
| Registro de entrega (§8.6)                                                                        | nome `{data}-{id}-{assunto}.md`, linha `Tarefa ClickUp: {id}`, marcador `id={id}`                                                         | sem `{id}-` no nome, `id=nenhum` no marcador |
| Índice diário de entregas (§8.6)                                                                  | coluna `ID ClickUp` = `{id}`                                                                                                             | `não possui ID vinculado`                  |

Sem ID, **sai o segmento `{id}-` inteiro** — nunca deixe hífen sobrando (`-backend-...`), nunca
escreva `sem-id`, `000` ou similar no nome. No **texto**, a linha `Tarefa ClickUp` continua
existindo, com "não possui ID vinculado": ausência registrada é diferente de esquecimento.

O ID **não** entra na mensagem de commit — ela continua `{tipo}: {o que mudou}`, sem sufixo.

Todo exemplo desta skill daqui em diante mostra a forma **com ID**. Sem ID, aplique a coluna da
direita da tabela acima.

`</obrigatório>`

---

## 2. As regras fixas vão embutidas no prompt, por extenso

`<obrigatório>`

**O prompt gerado (§8.3) traz, por extenso, dentro do próprio bloco ` ```text `:** o aviso de shell,
a REGRA GIT, a PREPARAÇÃO DA WORKTREE (com o heredoc da âncora e a cópia dos arquivos gitignorados
necessários, §8.3.1), a REGRA DE BANCO (backend) ou o `npm install` (frontend), o procedimento de
COMMIT e o REGISTRO DE ENTREGA (§8.6) — com o resumo marcado para o ClickUp e a linha do índice
diário.

**O agente da worktree não enxerga a skill `fechar-entrega`.** Ela mora em
`docker-intranet\.claude\skills\`, fora de toda worktree do orca, e a âncora (§8.1) proíbe ler lá. O
`CLAUDE.md` do repositório manda invocá-la — ordem que o agente não consegue cumprir. Por isso tudo
que a `fechar-entrega` faria vai **transcrito** no bloco §8.6, e o prompt declara que ele prevalece
sobre o `CLAUDE.md` do repositório nesse ponto.

**Não delegue para um `CLAUDE.worktree.md` fora da worktree e não instrua o agente a lê-lo como
pré-requisito.** Ele só existe hoje em branches específicas de feature, em nenhum dos dois
repositórios está mergeado em `main`, e uma worktree nova nasce de `origin/main` — ou seja, nasce
**sem esse arquivo**. Um prompt que manda "leia `CLAUDE.worktree.md` antes de tudo" quebra no
primeiro passo, antes de o agente tocar em qualquer código. Se algum dia esse arquivo for mergeado
em `main` como infraestrutura própria, ótimo — mas o prompt continua **não dependendo** dele.

`</obrigatório>`

O agente da worktree **fecha o próprio trabalho no git**: commit na branch daquela worktree, pelo
**git CLI**, e para. `<obrigatório>` **Nunca roda `git push`** — publicar no remoto é manual, do
usuário, por enquanto. Merge, push e Pull Request continuam sendo exclusivamente dele.
`</obrigatório>`

---

## 2.1 Modo batch — chamada pelo orquestrador semanal

Com `MODO: BATCH`, não conduzir entrevista: preencher as fases 1 a 5 a partir da descrição vinda do
ClickUp.

A trava da Fase 2 continua valendo e é o ponto central deste modo. Sem critério de aceite testável,
em vez de perguntar, a skill:

1. grava o `00-plano-{id}-{assunto}.md` com o que conseguiu extrair;
2. **não** grava os arquivos `01-` e `02-`;
3. abre o `00-plano` com `## Bloqueado — falta especificação`, listando o que não pôde ser extraído;
4. devolve a tarefa ao orquestrador com status `bloqueada`.

Campo que não seja critério de aceite e não possa ser extraído vira `[PENDENTE-HUMANO: {o que
falta}]`. Nunca inferir, nunca assumir o caso comum.

O `{assunto}` vem pronto do orquestrador, no formato `{p}-{seq}-{descricao-kebab}` (ver
`convencoes/tags.md`). A skill não o reescreve.

O `{id}` vem do **ID da própria tarefa no ClickUp**, normalizado (§1.3). Como toda tarefa do modo
batch nasce no ClickUp, "não possui ID vinculado" **não** se aplica aqui: se o ID não vier, ele vira
`[PENDENTE-HUMANO: ID da tarefa no ClickUp]` e a tarefa segue o mesmo bloqueio da trava acima —
grava só o `00-plano` e devolve `bloqueada`, porque nome de worktree e de branch dependem dele.

**Uma invocação por módulo, não por semana inteira.** Tarefas do mesmo módulo compartilham a
pesquisa de código e valem uma invocação só; módulos diferentes em invocações separadas, senão o
contexto cresce carregando pesquisa que não será reusada.

---

## 3. Entrevista — uma fase por vez

Se o usuário já respondeu algo, carregue para frente e não repergunte, inclusive o ID do ClickUp quando inequívoco.

**Fase 1 — Entendimento:** o que precisa ser feito (pular se já descreveu); bug ou feature; afeta
backend, frontend ou ambos; e o **ID da tarefa no ClickUp**.

Use o ID ou link inequívoco já fornecido. Só pergunte se ele estiver ausente ou ambíguo, oferecendo “Informar o ID” e “Não possui ID vinculado”. Não deduza um ID de branch com segmentação ambígua. Normalize (§1.3) e reutilize o mesmo valor em todos os artefatos.

### Fase 2 — Especificação (spec-driven) ← CRÍTICO

Vem **antes** do mapeamento de arquivos. Não se discute implementação; levanta-se **comportamento
observável**.

1. **Objetivo** — uma frase, o resultado do ponto de vista de quem usa. Nunca descreve implementação.
2. **Critérios de aceite** — pergunte: "como você vai verificar, na tela ou na resposta da API, que
   isso funcionou?" Cada critério vira uma linha `Dado / Quando / Então`, testável e sem ambiguidade.
   Critério que não pode ser verificado não é critério — reformule.
3. **Casos de borda e erro** — lista vazia, sem permissão, valor duplicado, registro inexistente.
   Pergunte explicitamente: "o que deve acontecer quando der errado?"
4. **Contrato de API**, quando cruza backend↔frontend: verbo e rota; payload campo a campo com tipo
   e obrigatoriedade; response espelhando o Resource; status semânticos; erro no formato
   `{ message, errors }`. Operação que o front aplica a vários itens é **batch** — array no payload,
   uma transação. Nunca N requisições.
5. **Fora do escopo** — o que explicitamente **não** deve ser feito. É a trava de YAGNI do agente.
   Se o usuário não citar nada, proponha os não-objetivos óbvios e confirme.

`<obrigatório>` Sem critério de aceite testável, o prompt da worktree **não pode ser gerado**. Pare e
pergunte. Um prompt sem critério de aceite entrega código que ninguém consegue reprovar.
`</obrigatório>`

**Fase 3 — Mapeamento de arquivos.** Pergunte só o lado relevante (controllers, models, migration,
service / componentes, service, rota, tipo TS). Resolva os caminhos reais **pesquisando o
repositório** — nunca deixe `{placeholder}`. Caminho que não conseguiu confirmar: pergunte.

### Fase 4 — Dependências e distribuição

**4a — Dependências:** o frontend depende de endpoint novo? Qual o formato? Alguma tarefa depende de
outra? Qual vem primeiro?

**4b — Distribuição: só existe a camada (§1.1).** Toda tarefa de backend → worktree de backend; toda
de frontend → a de frontend. Não existe terceira worktree; não avalie agrupamento, escopo ou
conflito.

Dentro de cada worktree, o prompt lista as tarefas **numeradas na ordem de execução**, cada uma com
objetivo e critérios de aceite, para o mesmo agente executar em sequência.

Dependência **dentro** da mesma worktree vira ordem das tarefas. Dependência **entre** as duas vira
contrato de API escrito nos dois prompts e ordem de merge no `00-plano` — nunca uma worktree a mais.

**Fase 5 — Restrições:** arquivos que não devem ser tocados; regras de negócio; testes e cenários;
branch de integração e branch base.

`<obrigatório>` A branch de integração **nunca é a `main`**. Se o usuário responder "main", pare e
peça a branch real. Derivar a worktree de `origin/main` é permitido (é leitura); merge, commit e
push na `main` ficam fora de todo arquivo gerado. `</obrigatório>`

---

## 4. Saída em arquivos — OBRIGATÓRIO

`<obrigatório>` O plano é entregue como **arquivos gravados com Write**. Plano que existe só na
resposta do chat está **incompleto**. `</obrigatório>`

Destino: `D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\{AAAA-MM-DD}\`, com a data **de
hoje**, independente da camada.

| Arquivo                                | Quantidade               | Conteúdo                                     |
| -------------------------------------- | ------------------------ | -------------------------------------------- |
| `00-plano-{id}-{assunto}.md`           | 1                        | visão geral, ordem, dependências, riscos     |
| `01-{id}-backend-{assunto}.md`         | 1, **se tocar backend**  | criação, spec, prompt CLI                    |
| `02-{id}-frontend-{assunto}.md`        | 1, **se tocar frontend** | idem                                         |
| `99-merge-e-limpeza-{id}-{assunto}.md` | 1                        | merge (pelo usuário) e remoção das worktrees |

Sem ID vinculado, os nomes perdem o segmento `{id}-` (§1.3).

`<obrigatório>` **`01` é sempre backend, `02` é sempre frontend.** Nunca gere `03-` ou maior (§1.1).
Feature de uma camada só gera um arquivo de worktree, e o do frontend continua sendo `02`.
`</obrigatório>`

**Liste a pasta do dia antes de escrever.** Se já existir arquivo com o mesmo `{id}-{assunto}`, ele
é de outro plano — escolha um slug mais específico. Nunca sobrescreva plano anterior. Nunca use
`mkdir` antes de Write — Write cria a pasta.

**No chat, ao final, retorne apenas:** o ID do ClickUp (ou "não possui ID vinculado"), a tabela de
worktrees, a ordem de merge em uma linha e os caminhos dos arquivos. Nada do conteúdo.

---

## 5. Conteúdo de `00-plano-{id}-{assunto}.md`

Nesta ordem:

1. `# {título}` e, logo abaixo, uma linha com a data, **`Tarefa ClickUp: {id}`** (com o link,
   quando houver; ou `Tarefa ClickUp: não possui ID vinculado`), o identificador do orquestrador
   quando vier do modo batch, e os repositórios tocados.
2. `## Contexto` — o problema, o que motivou, o resultado esperado. Inclua o que **já existe** no
   código e não precisa ser construído: é o que impede o agente de reimplementar.
3. `## Especificação consolidada` — objetivo geral e os critérios de aceite de nível sistema.
4. `## Worktrees` — tabela com **no máximo duas linhas**:
   `# | Worktree | Repositório | Branch do orca | Branch final | Branch base | Tarefas | Arquivo`.
   O usuário digita no app orca só `Repositório` e `Worktree` (§6.1) — `Branch do orca` é
   consequência do nome da worktree e `Branch final` é o nome para o qual o agente renomeia
   (§1.1.1). As duas colunas de branch são obrigatórias; tabela com uma coluna `Branch` só é plano
   da versão antiga e produz o erro de branch divergente. Três linhas = plano errado; junte por
   camada e refaça.
5. `## Dependências e ordem de execução` — paralelo ou sequencial, com o motivo. Dependência de
   símbolo (§8.2) se declara aqui.
6. `## Contrato de API` — quando a feature cruza as camadas.
7. `## Ordem de merge` — numerada, por repositório, **executada pelo usuário**, nunca para a `main`.
8. `## Riscos e pontos de atenção` — migration pendente, breaking change, conflito provável com
   outras entregas em curso, o que precisa de teste manual.
9. `## Índice de arquivos` — link para cada arquivo gerado.

---

## 6. Conteúdo de `01-{id}-backend-{assunto}.md` / `02-{id}-frontend-{assunto}.md`

No máximo dois arquivos, um por camada. Cada um é autossuficiente para criar a worktree, rodar as
tarefas daquela camada e fechar.

### 6.1 Cabeçalho e criação da worktree

Abra com uma tabela: **tarefa ClickUp** (`{id}` ou "não possui ID vinculado"), repositório,
**branch do orca**, **branch final**, branch base, caminho da worktree, depende de, roda em paralelo
com, ordem de merge. As duas branches sempre, nunca só uma (§1.1.1).

`<obrigatório>` **A worktree é criada pelo usuário no app orca, não por comando.** No app orca ele
escolhe o **repositório** e dá **nome à worktree**; a pasta nasce automática dentro de
`orca\workspaces\{app|intranetNova}\`. Documente os campos: `</obrigatório>`

| Campo                                | Valor                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Repositório                          | `{repo}`                                                                                         |
| Nome da worktree (o que você digita) | `{id}-{backend\|frontend}-{assunto}`                                                             |
| Pasta (automática, orca)             | `C:\Users\vinicius.silva\orca\workspaces\{app\|intranetNova}\{id}-{backend\|frontend}-{assunto}` |
| Branch que o orca cria               | `{id}-{backend\|frontend}-{assunto}` — o orca não pergunta, repete o nome da worktree            |
| Branch final                         | `{feat\|fix\|refactor}/{id}-{assunto}` — o **agente** renomeia no passo 1 do prompt (§8.3)       |
| Derivada de                          | `origin/{branch-base}` — **nunca** da branch ativa                                               |

`<obrigatório>` Nada aqui pede que o usuário renomeie a branch à mão. Ele digita o nome da worktree
no orca e pronto; o renomeio é passo do agente, já escrito no prompt (§8.3). `</obrigatório>`

Depois, a conferência:

```bash
git -C "C:/Users/vinicius.silva/orca/workspaces/app/{id}-backend-{assunto}" worktree list
git -C "C:/Users/vinicius.silva/orca/workspaces/app/{id}-backend-{assunto}" branch --show-current
```

Esperado em `branch --show-current`: **`{id}-backend-{assunto}`** (antes de o agente rodar) ou
`{feat|fix|refactor}/{id}-{assunto}` (depois). Se devolver `main`, `master` ou qualquer outra coisa,
**pare**: worktree criada da branch errada.

Acrescente, num `<details>`, a alternativa por terminal (`fetch` + `worktree add ... -b {branch}
origin/{base}`), com o aviso de shell da §1.2 no topo. Nessa via o `-b` já recebe a **branch final**
`{feat|fix|refactor}/{id}-{assunto}` — e aí o renomeio do §8.3 vira no-op, que é justamente como ele
foi escrito.

Feche lembrando que **nada foi preparado por script** — a âncora, o `npm install` (frontend) e a
cópia dos arquivos gitignorados (frontend, §8.3.1) são o primeiro passo do agente, por extenso no
próprio prompt (§8.3).

### 6.2 Abrir o Claude CLI

```bash
cd "C:/Users/vinicius.silva/orca/workspaces/app/{id}-backend-{assunto}"
claude
```

### 6.3 `## 3. Prompt para o Claude CLI` ← seção principal

`<obrigatório>` Um único bloco ` ```text ` fechado, **colável sem nenhuma edição**. Proibido
`{placeholder}` pendente: todo caminho, branch, nome de arquivo, campo, ID do ClickUp e valor de
exemplo **resolvido** com o valor real da pesquisa. Sem esse bloco, o plano está incompleto.
`</obrigatório>`

Ordem obrigatória das partes:

1. **`ÂNCORA DE WORKTREE`** (bloco fixo, §8.1) — curto: onde você está, o que pode ler e escrever,
   e a tarefa do ClickUp.
2. **`REGRAS FIXAS`** (bloco fixo, §8.3) — REGRA GIT e PREPARAÇÃO DA WORKTREE **por extenso**,
   incluindo a cópia dos arquivos gitignorados necessários (§8.3.1). Não depende de nenhum arquivo
   existir fora do que o `git worktree add` já trouxe.
3. **`ESPECIFICAÇÃO E PLANO`** (bloco fixo, §8.4) — os dois caminhos absolutos, para o agente ler a
   visão geral. É a única exceção de leitura fora da worktree, e é read-only.
4. `PRÉ-REQUISITO` (§8.2) — só quando depende de símbolos de outra branch.
5. `LEITURA OBRIGATÓRIA ANTES DE CODIFICAR` — o `CLAUDE.md` da raiz da worktree, o contrato em
   `.claude/context/api-contracts/` quando existir, e os arquivos de referência da parte 8.
6. `OBJETIVO` — uma frase, resultado observável.
7. `CRITÉRIOS DE ACEITE` — numerados, `Dado / Quando / Então`, com os casos de borda e erro.
8. `CONTRATO DE API` — quando houver, campo a campo.
9. `CONTEXTO ARQUITETURAL` — `Arquivos a CRIAR`, `Arquivos a MODIFICAR`, `Referência (LER ANTES,
read-only)`.
10. `TAREFA N — {nome}` — **todas** as tarefas daquela camada, numeradas na ordem de execução, cada
    uma com objetivo e critérios de aceite.
11. `REGRAS DE NEGÓCIO` — lista numerada.
12. `FORA DO ESCOPO` — não-objetivos explícitos.
13. `RESTRIÇÕES` — o que não fazer, com o motivo quando não for óbvio.
14. **`REGISTRO DE ENTREGA`** (bloco fixo, §8.6) — onde gravar, nome, seções, o resumo marcado
    para o ClickUp e a linha do índice diário. Por extenso, nunca "invoque a `fechar-entrega`".
15. **`COMMIT DESTA ENTREGA`** (§8.5) — a lista de arquivos e a mensagem já escrita. O procedimento
    (branch, `add` explícito, mensagem — **sem push**) está por extenso na REGRA GIT do §8.3.
16. **`CODE REVIEW`** (bloco fixo, §8.7) — roda o agente `code-reviewer` **depois** do commit da
    entrega, commita só o relatório num segundo commit, e só então vem a linha do índice.
17. `DEFINIÇÃO DE PRONTO` — derivada 1:1 dos critérios de aceite, terminando **sempre** com:
    `Branch renomeada para {feat|fix|refactor}/{id}-{assunto} no passo 2 da preparação`,
    `Registro de entrega gravado em docs\historico\entregas\, com a seção Resumo para o ClickUp
    entre os marcadores clickup-resumo`,
    `Commit da entrega feito na branch {feat|fix|refactor}/{id}-{assunto}, com mensagem de uma
    linha, incluindo o registro de entrega`,
    `Code review rodado DEPOIS desse commit, relatório em docs\historico\reviews\ commitado
    sozinho no segundo commit — e NENHUMA correção aplicada`,
    `Linha acrescentada no índice diário D:\Documentos\00 - Dev\docker-intranet\.claude\entregas\<data de hoje>.md,
    com o hash do último commit (o do relatório)`,
    `Nenhum git push foi rodado — publicar no remoto fica para o usuário` e
    `Nenhum commit ou merge tocou a main; nenhum PR foi aberto`.

`<obrigatório>` As partes 2 e 3 vêm **antes** de qualquer leitura de código, nessa ordem. Invertê-las
faz o agente editar arquivo sem saber em que branch está. `</obrigatório>`

### 6.4 Fechar a worktree

O commit **já foi feito pelo agente, mas o push não** — isso é manual, por enquanto. Esta seção
traz a conferência do usuário (`status`, `branch --show-current`, `log --oneline -3`) e o comando de
push que falta rodar, mais o lembrete de que **push, merge e PR são dele**, com link para o `99-`.

`<obrigatório>` Nesta altura a branch já foi renomeada pelo agente (§8.3): `branch --show-current`
devolve `{feat|fix|refactor}/{id}-{assunto}`, **não** o nome que o orca deu. O push é
`push -u origin {feat|fix|refactor}/{id}-{assunto}` — o `-u` é necessário porque a branch renomeada
nunca teve upstream. A pasta da worktree continua com o nome antigo; diga isso explicitamente, senão
o usuário acha que rodou no lugar errado. `</obrigatório>`

---

## 7. Conteúdo de `99-merge-e-limpeza-{id}-{assunto}.md`

`<obrigatório>` **Todo comando deste arquivo é executado pelo usuário**, e nenhum pode ter a `main`
como destino. Abra o arquivo com essa frase, seguida da linha `Tarefa ClickUp: {id}` (ou "não possui
ID vinculado"). `</obrigatório>`

1. `## Pré-condições` — `log --oneline -3` em cada worktree (esperado: o commit `feat:`/`fix:` da
   entrega e, acima dele, o `docs: code review ...`); conferir as linhas no índice diário; ler o
   relatório do `code-reviewer`, que **já rodou** na worktree (§8.7), sem nenhuma correção
   aplicada; rodar os **outros dois** revisores (`security-reviewer` e `clean-code-reviewer`, §7 do
   `CLAUDE.md`), com a prioridade específica desta entrega quando houver.
2. `## Ordem de merge` — numerada, um repositório por vez, com o comando resolvido. Não existe branch
   de integração nestes repositórios hoje: escreva o comando como **modelo** com
   `{sua-branch-de-destino}` e diga que o destino é decisão do usuário.
3. `## Conflitos esperados` — tabela `arquivo | risco | como resolver`, incluindo conflito com
   **outras entregas em curso**, não só entre as duas worktrees deste plano.
4. `## Migration pendente`, quando houver — o procedimento de prova de conexão (§2 do `CLAUDE.md`),
   `migrate:status`, e o que fazer se abortar.
5. `## Pós-merge` — o que rodar, o que testar à mão contra os critérios de aceite.
6. `## Limpeza` — `worktree remove`, `worktree prune`, `branch -d`, mais o `checkout --
CLAUDE.local.md` para o caso de o remove reclamar da âncora.
   `<obrigatório>` `worktree remove` recebe o **caminho da pasta**
   (`.../orca/workspaces/{app|intranetNova}/{id}-{camada}-{assunto}`) e `branch -d` recebe a
   **branch final** (`{feat|fix|refactor}/{id}-{assunto}`). Os dois nomes são diferentes de
   propósito — a pasta guarda o nome do orca, a branch foi renomeada (§1.1.1). Trocar um pelo outro
   dá `is not a working tree` ou `branch not found`. `</obrigatório>`

---

## 8. Blocos fixos — copie literalmente, só troque os valores

### 8.1 Âncora de worktree

```text
ÂNCORA DE WORKTREE — LEIA ANTES DE QUALQUER AÇÃO
- Tarefa ClickUp: {id}   (ou: não possui ID vinculado)
- Worktree ativo: C:\Users\vinicius.silva\orca\workspaces\{app|intranetNova}\{id}-{backend|frontend}-{assunto}
- Repositório de origem: {repo} ({Laravel|Angular})
- Branch como o orca a criou: {id}-{backend|frontend}-{assunto} (o orca não pergunta o nome da
  branch, ele repete o nome da worktree — é normal e é o que você vai encontrar)
- Branch final: {feat|fix|refactor}/{id}-{assunto} — VOCÊ renomeia para esse nome no passo 1 das
  REGRAS FIXAS, com git branch -m. Encontrar a branch com o nome antigo NÃO é erro e NÃO é motivo
  para parar; parar só se for main, master ou um nome sem relação nenhuma com {id}-{assunto}
- A PASTA continua com o nome antigo depois do renomeio. Todo git -C usa o caminho acima
- Glob/leitura/escrita permitidos SOMENTE dentro deste worktree
- Exceção de LEITURA, só estes arquivos, nunca por Glob:
  D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\{AAAA-MM-DD}\{01|02}-{id}-{backend|frontend}-{assunto}.md
  D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\{AAAA-MM-DD}\00-plano-{id}-{assunto}.md
  D:\Documentos\00 - Dev\docker-intranet\.claude\agents\code-reviewer.md          (só no bloco CODE REVIEW)
  D:\Documentos\00 - Dev\docker-intranet\.claude\agents\_shared\escopo-revisao.md (só no bloco CODE REVIEW)
- Exceção de ESCRITA, só ACRESCENTAR (cat >>), só este arquivo, só no fim, depois do commit:
  D:\Documentos\00 - Dev\docker-intranet\.claude\entregas\<data de hoje>.md   (índice diário, §REGISTRO)
  Nunca edite nem apague linhas que já estão lá: são de outras entregas
- Se um arquivo não existir nesse path, PERGUNTE. Não busque fora do worktree.
```

### 8.2 Dependência de símbolo entre branches do mesmo repositório

Quando a worktree B consome tipos ou classes **criados** pela branch A, ordem de merge não basta — o
agente de B quebra antes de qualquer merge. Nesse caso a branch base de B é a branch de A, e o
prompt abre com:

```text
PRÉ-REQUISITO — CONFIRME ANTES DE COMEÇAR
- Esta worktree depende de símbolos criados na branch {branch-a}
- Confirme que estes existem: {símbolo} em {arquivo}
- Se algum não existir, PARE e avise. Não recrie o símbolo, não improvise stub.
  A worktree provavelmente nasceu de main por engano e precisa ser recriada.
```

No `git diff` do registro de entrega, B usa `git diff {branch-a}` para isolar o que é seu.

### 8.3 Regras fixas — REGRA GIT, PREPARAÇÃO DA WORKTREE e COMMIT, por extenso

`<obrigatório>` Obrigatório em **todo** prompt, por extenso — não delegue para um arquivo externo
(§2). Preencha `{ID}`, `{WORKTREE}`, `{BRANCH_ORCA}`, `{BRANCH}`, `{assunto}` e o repositório de
origem com os valores reais antes de colar. Como o bloco tem comandos ```bash aninhados, a cerca
externa usa 4 crases (````text / ````), igual ao bloco final do prompt (§6.3) — nunca feche com 3.
`</obrigatório>`

````text
REGRAS FIXAS DESTA WORKTREE — LEIA E CUMPRA ANTES DE QUALQUER AÇÃO

{ID}          = {id}   (ou: não possui ID vinculado)   <- tarefa do ClickUp desta entrega
{WORKTREE}    = C:\Users\vinicius.silva\orca\workspaces\{app|intranetNova}\{id}-{backend|frontend}-{assunto}
{BRANCH_ORCA} = {id}-{backend|frontend}-{assunto}     <- nome com que a branch NASCE, dado pelo orca
{BRANCH}      = {feat|fix|refactor}/{id}-{assunto}    <- nome FINAL, depois do renomeio do passo 2

O app orca não pergunta o nome da branch: ele cria a branch com o mesmo nome da worktree. Então
ao abrir esta worktree você VAI encontrar {BRANCH_ORCA}, e isso está correto — não é worktree
errada, não pare por causa disso. Quem coloca a branch no padrão do projeto é você, no passo 2.

Todos os blocos de comando abaixo são Git Bash. Caminhos com barra normal e sempre entre aspas
duplas (D:/... ou C:/...) — no bash a barra invertida é escape e o espaço em "00 - Dev" quebra o
caminho se não estiver entre aspas.

REGRA GIT — OBRIGATÓRIA
- NUNCA faça nada na main: sem checkout, commit, push, merge, rebase ou reset na main
- Trabalhe SOMENTE na branch desta worktree. Antes do commit, confirme com:
  git -C "{WORKTREE em forma /}" branch --show-current
- A ÚNICA escrita de branch permitida é o "git branch -m {BRANCH}" do passo 2 da preparação,
  que renomeia a branch desta worktree. Fora dele: nenhum checkout, nenhuma branch nova,
  nenhum rebase, nenhum reset
- Ao terminar TUDO, faça o commit nesta branch, pelo git CLI; depois rode o CODE REVIEW, commite
  só o relatório num segundo commit, acrescente a linha do índice diário, e PARE
- NUNCA rode git push, em nenhuma branch. Publicar no remoto é manual, do usuário, por enquanto
- Poucos commits: um por unidade lógica de entrega. Nunca um por arquivo, nunca "wip",
  nunca "ajuste do ajuste"
- Mensagem curta, uma linha, em português, no formato "{tipo}: {o que mudou}" — sem o ID do
  ClickUp na mensagem
- NUNCA coloque o Claude como co-autor: sem Co-Authored-By, sem "Generated with Claude Code",
  sem emoji de assinatura. Nunca passe --author, nunca altere user.name ou user.email
- NUNCA use git add . — adicione explicitamente os arquivos da tarefa
- NUNCA abra Pull Request: nem por gh pr create, nem pela web, nem sugerindo link de push
- Merge, push e PR são do usuário. Você para depois do commit

PREPARAÇÃO DA WORKTREE — PRIMEIRO PASSO, ANTES DE LER QUALQUER CÓDIGO

Esta worktree foi criada no app orca: nenhum script rodou antes de você. Rode isto agora:

```bash
# 1. Descobrir em que branch esta worktree está.
#    ESPERADO: "{BRANCH_ORCA}" (a worktree acabou de nascer) ou "{BRANCH}" (já renomeada
#    numa sessão anterior). Os dois são normais — siga em frente.
#    PARE e avise o usuário SOMENTE se devolver "main", "master", vazio, ou um nome que não
#    tem nada a ver com {id}-{assunto}: aí sim a worktree foi criada errada.
git -C "{WORKTREE em forma /}" branch --show-current

# 2. Renomear a branch para o padrão do projeto. Isto renomeia a branch ATIVA desta worktree:
#    não cria branch nova, não faz checkout, e não toca na main.
#    Se o passo 1 já devolveu "{BRANCH}", PULE este comando — já está renomeada.
git -C "{WORKTREE em forma /}" branch -m "{BRANCH}"

#    Se falhar com "already exists", PARE e avise: já existe outra branch com esse nome, e
#    provavelmente é de outra entrega. Se falhar com "cannot lock ref" ou "is not a valid
#    branch name", PARE também: há conflito entre uma branch chamada "{tipo}" e o caminho
#    "{tipo}/...". Em nenhum dos casos invente nome alternativo nem force com -M.

# 3. Confirmar o renomeio. Daqui em diante a branch desta worktree é "{BRANCH}".
#    A PASTA continua chamando "{id}-{backend|frontend}-{assunto}" — git branch -m renomeia só
#    a branch. Todos os git -C continuam usando o caminho {WORKTREE}. Não "corrija" isso.
git -C "{WORKTREE em forma /}" branch --show-current

# 4. Atualizar ESTA branch com a versão mais recente da main, ANTES de ler ou escrever
#    qualquer código. Isto traz a main PARA DENTRO da sua branch — não é checkout, commit
#    nem push NA main, e continua proibido fazer qualquer uma dessas coisas lá.
git -C "{WORKTREE em forma /}" fetch origin
git -C "{WORKTREE em forma /}" pull origin main --no-edit

#    Se o pull terminar em CONFLITO, PARE e avise o usuário: não resolva conflito de código
#    que não é seu. Se ele terminar com "Already up to date", siga em frente normalmente.
git -C "{WORKTREE em forma /}" status

# 5. Gravar a âncora desta worktree no fim do CLAUDE.local.md.
#    ">>" ACRESCENTA. Nunca use ">": o arquivo pode já trazer conteúdo versionado.
cat >> "{WORKTREE em forma /}/CLAUDE.local.md" <<'EOF'

## Âncora desta worktree

- Tarefa ClickUp: {ID}
- Worktree: {WORKTREE}
- Branch desta worktree: {BRANCH} — trabalhe SOMENTE nela
- A branch nasceu como {BRANCH_ORCA} (nome dado pelo orca) e foi renomeada para {BRANCH}.
  A PASTA continua com o nome antigo: isso é esperado, não é erro, não renomeie a pasta
- Especificação desta worktree: D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\{AAAA-MM-DD}\{01|02}-{id}-{backend|frontend}-{assunto}.md
- Plano geral da feature: D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\{AAAA-MM-DD}\00-plano-{id}-{assunto}.md
- NUNCA faça nada na main: sem checkout, commit, push, merge, rebase ou reset na main
- Antes do commit: registro de entrega em docs\historico\entregas\, terminando na seção
  "Resumo para o ClickUp" entre os marcadores clickup-resumo (bloco REGISTRO DE ENTREGA do prompt)
- Ao terminar tudo: commit da entrega pelo git CLI → code review (agente code-reviewer, sem
  corrigir nada) → commit só do relatório → linha no índice diário
  D:\Documentos\00 - Dev\docker-intranet\.claude\entregas\<data de hoje>.md → PARE
- NUNCA rode git push. Publicar no remoto é manual, do usuário, por enquanto
- Poucos commits: um por unidade lógica de entrega, nunca um por arquivo, nunca "wip"
- Mensagem curta, uma linha, em português: "{tipo}: {o que mudou}"
- NUNCA coloque o Claude como co-autor: sem Co-Authored-By, sem "Generated with Claude Code"
- NUNCA use git add . — adicione explicitamente os arquivos da tarefa
- NUNCA abra Pull Request. Merge, push e PR são do usuário
- NUNCA commite o próprio CLAUDE.local.md: esta âncora é local desta worktree
EOF

# 6. Conferir que a âncora entrou.
cat "{WORKTREE em forma /}/CLAUDE.local.md"
```

SE BACKEND — REGRA DE BANCO — PROIBIDO AO AGENTE
- NUNCA rode php artisan migrate, migrate:fresh, db:wipe, seeders ou tinker
- Você só CRIA o arquivo da migration. Quem executa é o usuário.
- NUNCA rode a suíte de testes: o docker-compose injeta o .env inteiro no container e todo
  processo herda essas variáveis, inclusive os testes. phpunit.xml sozinho não isola nada.
- Toda operação de schema é exclusivamente na conexão sqlsrv_NEW_CRM, declarada
  explicitamente: Schema::connection('sqlsrv_NEW_CRM')
- NUNCA toque em sqlsrv_CRM ou sqlsrv_CorporeRM — são produção
- Migration é imutável após deploy: NUNCA edite uma migration existente. A sua é um arquivo novo.
- Não rode composer install: não há dependência nova e quem roda a aplicação é o container Docker.

SE FRONTEND — ARQUIVOS GITIGNORADOS QUE PRECISAM SER COPIADOS AGORA (§8.3.1)

`git worktree add` só traz arquivo **versionado**. Estes dois são gitignorados de propósito
(config local, por máquina) e por isso NASCEM AUSENTES em toda worktree nova — sem eles
`ng serve` quebra com "Proxy configuration file ... does not exist". Copie do checkout principal
do repositório, não do `.example`, porque o principal já tem o valor que funciona nesta máquina:

```bash
cp "D:/Documentos/00 - Dev/intranetNova/proxy.conf.json" "{WORKTREE em forma /}/proxy.conf.json"
```

`src\app\version.ts` NÃO precisa ser copiado: é gerado sozinho por `scripts/set-version.js` via
`npm run prestart` / `npm run prebuild`, que já rodam antes de `npm start` e `npm run build`. Só dá
problema se alguém rodar `ng serve` direto (pulando o `npm start`) — avise o usuário para preferir
`npm start` na hora de testar, e não `ng serve` cru.

SE FRONTEND — INSTALAÇÃO DE DEPENDÊNCIAS
```bash
cd "{WORKTREE em forma /}" && npm install --legacy-peer-deps
```
(`npm install` puro falha em ERESOLVE por causa do peer `platform-browser-dynamic` do `ngx-charts`.)
````

### 8.4 Especificação e plano — onde o agente lê a visão geral

`<obrigatório>` Obrigatório em todo prompt. Os arquivos do plano vivem fora de qualquer repositório,
e a âncora (§8.1) proíbe buscar fora da worktree — por isso o prompt dá os caminhos absolutos e abre
a exceção. `</obrigatório>`

```text
ESPECIFICAÇÃO E PLANO — LEIA ANTES DE COMEÇAR

Tarefa ClickUp: {id}   (ou: não possui ID vinculado)

Leia estes dois arquivos com Read. São a única leitura permitida fora da worktree, e são
somente leitura — nunca escreva neles.

1. Sua especificação (o que VOCÊ faz, com os critérios de aceite completos):
   D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\{AAAA-MM-DD}\{01|02}-{id}-{backend|frontend}-{assunto}.md

2. Plano geral (o que a outra worktree faz, o contrato de API entre as duas, ordem de merge,
   riscos):
   D:\Documentos\00 - Dev\docker-intranet\.claude\worktrees\{AAAA-MM-DD}\00-plano-{id}-{assunto}.md

Nunca implemente o que o arquivo 2 descreve como sendo da OUTRA worktree, mesmo que pareça
trivial. Se o arquivo 1 divergir deste prompt, PARE e pergunte — não escolha sozinho qual está
certo. Este prompt é a fonte da verdade do que executar.
```

### 8.5 Commit desta entrega

`<obrigatório>` O **procedimento** de commit (branch, `add` explícito, mensagem — **sem push**) está
na REGRA GIT do §8.3, por extenso. O prompt traz aqui só o que é específico da tarefa — a lista de
arquivos e a mensagem, **já resolvidas**. `</obrigatório>`

```text
COMMIT DESTA ENTREGA (sem push — isso é manual, do usuário, por enquanto)
Siga o procedimento da REGRA GIT já lida no início deste prompt. O que é específico desta entrega:

Arquivos a adicionar (um a um, nunca "git add ."):
  {arquivo-1}
  {arquivo-2}
  docs/historico/entregas/<data de hoje>-{id}-{assunto}.md   <- o registro do bloco REGISTRO DE ENTREGA

Mensagem (uma linha, sem co-autoria, sem o ID do ClickUp):
  {tipo}: {descrição curta da entrega}

Branch: {feat|fix|refactor}/{id}-{assunto}
Depois do commit, siga para o bloco CODE REVIEW. Não rode git push.
```

Quando a worktree entrega mais de uma unidade lógica, são no máximo dois ou três commits de
entrega, cada um com sua lista e sua mensagem. Nunca um commit por arquivo, e nenhum push em nenhum
deles. O registro entra no **último** commit de entrega; depois dele vem só o commit do relatório de
code review (§8.7), e a linha do índice leva o hash desse commit do relatório.

`<data de hoje>` é a única coisa do prompt que o plano **não** resolve, porque a entrega pode rodar
dias depois do planejamento: o agente calcula com `date +%F` na hora de gravar. Não é placeholder
pendente — é instrução.

### 8.6 Registro de entrega, resumo para o ClickUp e índice diário

`<obrigatório>` Obrigatório em **todo** prompt, por extenso — é a transcrição da skill
`fechar-entrega`, que o agente da worktree não consegue ler (§2). Preencha `{id}`, `{assunto}`,
`{camada}`, `{WORKTREE}`, `{BRANCH}` e o repositório com os valores reais. Sem ID vinculado: nome do
registro sem `{id}-`, `Tarefa ClickUp: não possui ID vinculado`, marcador `id=nenhum` e coluna do
índice `não possui ID vinculado` (§1.3). A cerca externa usa 4 crases, como no §8.3.
`</obrigatório>`

O **índice diário** mora em `D:\Documentos\00 - Dev\docker-intranet\.claude\entregas\{AAAA-MM-DD}.md`,
com a data **da entrega** (não a do plano). Fica fora do git de propósito: agentes dos dois
repositórios escrevem nele sem conflito de merge, e ele é log operacional entre repositórios — da
mesma natureza dos planos em `.claude\worktrees\`, não documentação de camada. Cada entrega
acrescenta uma linha; a coluna `Resumo ClickUp` nasce `pendente` e é o agente do ClickUp quem a muda
para `publicado`.

````text
REGISTRO DE ENTREGA — ANTES DO COMMIT (passos 1 e 2) E DEPOIS DELE (passo 3)

Este bloco PREVALECE sobre o CLAUDE.md do repositório nestes pontos: NÃO invoque a skill
fechar-entrega (ela não existe dentro desta worktree) e IGNORE qualquer frase do CLAUDE.md que diga
que o resumo do ClickUp vai "só no chat" ou "nunca em arquivo" — aqui ele vai DENTRO do registro.
Se o CLAUDE.md tiver marcadores de conflito (<<<<<<< / >>>>>>>), não tente resolvê-los: siga este
bloco e avise o usuário no fim.

1. GRAVE O REGISTRO no repositório desta worktree, versionado junto do código:
   {WORKTREE}\docs\historico\entregas\<data de hoje>-{id}-{assunto}.md
   (<data de hoje> = saída de: date +%F). Se esta sessão já criou o arquivo, EDITE-O.

   Estrutura:
   # {título da entrega}
   <data de hoje> · Tarefa ClickUp: {id} · repositório: {repo} ({camada}) · branch: {BRANCH}

   Uma entrega só: seções direto abaixo do título. Mais de uma: "## Parte N — {título}", na ordem
   de execução, seções em ###, cada parte completa em si.

   Seções obrigatórias, nesta ordem:
   - Contexto — que problema originou isso e como funcionava antes. Se a feature também tem
     worktree na outra camada, CITE isso aqui, sem copiar nada dela
   - O que foi feito — a solução em prosa, com o PORQUÊ de cada decisão e as alternativas
     descartadas (e por quê)
   - Arquivos alterados — tabela: caminho | criado/alterado/removido | o que mudou
   - Diffs — o diff de TODO arquivo de implementação tocado, um bloco ```diff por arquivo, caminho como cabeçalho.
     Arquivo novo entra inteiro. Proibido "trecho relevante". Fonte:
       git -C "{WORKTREE em forma /}" diff
       git -C "{WORKTREE em forma /}" status
   - Impacto e pontos de atenção — migration pendente, breaking change de contrato, o que testar
     à mão, o que ficou fora do escopo e por quê
   - Resumo para o ClickUp — SEMPRE a última seção, exatamente neste formato, com os marcadores
     nas linhas próprias (outro agente extrai o texto entre eles e publica no card):

## Resumo para o ClickUp

<!-- clickup-resumo:inicio id={id} camada={camada} -->
**{Título — uma linha, o que foi entregue}**

**O que foi feito**
- {3 a 6 bullets em linguagem de PRODUTO: sem nome de classe, caminho de arquivo ou método}

**Como testar**
1. {passo a passo curto, do ponto de vista de quem usa a tela; diga o perfil/permissão quando importa}

**Pontos de atenção**
- {ordem de publicação backend/frontend, migration, risco assumido, fora do escopo — só o que muda
  a decisão de alguém. Risco assumido por decisão do usuário PRECISA aparecer aqui}

**Repositório:** {repo} ({camada})
<!-- clickup-resumo:fim -->

   Dentro dos marcadores: nada de diff, bloco de código, tabela de arquivos ou caminho. Nunca
   altere a grafia dos marcadores. Um único bloco clickup-resumo por registro, mesmo com várias
   Partes — ele resume todas.

2. ADICIONE o registro ao commit (lista do COMMIT DESTA ENTREGA). Registro e código vão no MESMO
   commit.

3. POR ÚLTIMO — depois do commit do relatório de code review (bloco CODE REVIEW, passo 4) —
   acrescente UMA linha no índice diário. É a única escrita permitida fora da worktree, e é só
   acréscimo:

```bash
DATA="$(date +%F)"
INDICE="D:/Documentos/00 - Dev/docker-intranet/.claude/entregas/$DATA.md"
HASH="$(git -C "{WORKTREE em forma /}" rev-parse --short HEAD)"
REGISTRO="docs/historico/entregas/$DATA-{id}-{assunto}.md"
mkdir -p "D:/Documentos/00 - Dev/docker-intranet/.claude/entregas"
if [ ! -f "$INDICE" ]; then
  printf '# Entregas de %s\n\nAntes do merge, o registro só abre com: git -C "<repositório>" show <commit>:<caminho>\n\n| ID ClickUp | Worktree | Camada | Branch | Commit | Registro | Resumo ClickUp |\n| --- | --- | --- | --- | --- | --- | --- |\n' "$DATA" > "$INDICE"
fi
printf '| %s | %s | %s | %s | %s | [%s](%s) | pendente |\n' \
  "{id}" "{id}-{camada}-{assunto}" "{camada}" "{BRANCH}" "$HASH" \
  "{repo}/$REGISTRO" "{link relativo: ../../app/ no backend, ../../../intranetNova/ no frontend}$REGISTRO" >> "$INDICE"
tail -n 3 "$INDICE"
```

   Nunca use ">" no índice depois de ele existir, nunca edite nem apague linha de outra entrega.
   Não faça commit --amend depois deste passo: o hash da linha deixaria de existir.

4. No chat, ao final, repita o conteúdo do bloco clickup-resumo e informe o caminho do registro e
   a linha do índice.
````

No plano gerado, o `{link relativo}` já vem **resolvido**: `../../app/` para o backend e
`../../../intranetNova/` para o frontend (partindo de `docker-intranet\.claude\entregas\`). Ele aponta
para o checkout principal e só abre depois do merge; antes disso vale o hash da coluna `Commit`.

**Ordem de fechamento de toda worktree:** registro (passos 1-2 do §8.6) → `COMMIT DESTA ENTREGA`
(§8.5) → `CODE REVIEW` (§8.7) → commit só do relatório → linha do índice (passo 3 do §8.6) → PARE.

### 8.7 Code review — depois do commit da entrega

Preserve a ordem do perfil: commit da implementação → revisão → commit apenas do relatório → índice diário. Não faça amend nem corrija automaticamente com base no review.

Antes de gerar o prompt, verifique se os arquivos do agente `code-reviewer` e do protocolo compartilhado estão disponíveis. Quando estiverem, use o agente validado e preserve seus critérios, fixando worktree e base da entrega. Quando ausentes, carregue a skill `revisor-de-codigo` no modo correção/performance a partir de uma instalação disponível e transcreva seu protocolo e critérios necessários no prompt. Se nenhuma fonte estiver disponível, registre o bloqueio em vez de inventar o conteúdo. Não gere comandos para ler arquivos inexistentes.

O prompt final deve ser autossuficiente e conter:

1. Worktree e base FIXAS da entrega; hashes e comandos Git de leitura para identificar o escopo commitado. Não revisar checkout principal nem outro repositório. Ler código alterado e contexto, excluindo o registro gerado de entrega.
2. Especificação e critérios de aceite completos ou caminho de leitura previamente autorizado e verificado.
3. Critérios de correção/performance do agente ou da skill, sem executar ambos. Não duplicar revisão por haver duas interfaces.
4. Destino concreto `docs/historico/reviews/code-review-{id}-{assunto}-<data-hora>.md`, calculando a data/hora na execução. A única escrita da revisão é o relatório; nenhum Git de escrita no revisor.
5. Executor independente, quando disponível e autorizado. Se não houver, autorrevisão explicitamente identificada e gate independente pendente, nunca aprovação independente fictícia.
6. Proibição de corrigir código a partir do relatório nesta etapa. Achados seguem para decisão do usuário ou autorização já estabelecida para uma etapa posterior.
7. Após a revisão, o executor de fechamento verifica o índice e commita somente o relatório, em commit separado. Em seguida acrescenta a linha do índice diário com o hash final (§8.6), sem push.
8. Saída: achados por severidade, caminho do relatório, resumo ClickUp, índice e gates pendentes.

Transcreva as invariantes de registro e autorização do início deste perfil também no prompt gerado. O registro não recebe o placar de uma revisão ainda não executada. Revisão com bloqueios não libera merge, mesmo que seu relatório tenha sido commitado.

---

## 9. Checklist de saída

`<obrigatório>` Confira antes de responder no chat. Só itens que **não** se verificam sozinhos ao
seguir as seções acima. `</obrigatório>`

- [ ] O **ID do ClickUp foi reutilizado ou perguntado**, com a opção "Não possui ID vinculado" quando ausente (§3)
      — no modo batch, veio da tarefa ou virou `[PENDENTE-HUMANO]` com bloqueio (§2.1)
- [ ] O `{id}` está **normalizado** (minúsculo, só `[a-z0-9-]`) e é **o mesmo** em todos os nomes
      e arquivos do plano (§1.3)
- [ ] O `{id}` aparece no **nome da worktree** (`{id}-{camada}-{assunto}`), na **pasta**, na
      **branch do orca**, na **branch final** (`{tipo}/{id}-{assunto}`) e no **nome de todos os
      arquivos** do plano — ou, sem ID vinculado, o segmento `{id}-` saiu inteiro, sem hífen sobrando
- [ ] A linha **`Tarefa ClickUp:`** está no `00-plano`, no cabeçalho do `01`/`02`, no `99-`, na
      âncora (§8.1), nas REGRAS FIXAS e no heredoc do `CLAUDE.local.md` (§8.3) e no bloco §8.4
- [ ] A mensagem de commit **não** leva o ID
- [ ] Todo prompt traz o bloco **`REGISTRO DE ENTREGA`** (§8.6) por extenso, antes do `COMMIT DESTA
      ENTREGA` — nenhum passo manda "invocar a `fechar-entrega`"
- [ ] O bloco §8.6 tem o formato do `Resumo para o ClickUp` com os marcadores
      `<!-- clickup-resumo:inicio id=... camada=... -->` / `<!-- clickup-resumo:fim -->` sem
      alteração de grafia, e diz que prevalece sobre o "só no chat" do `CLAUDE.md` do repositório
- [ ] O passo do índice diário tem o `{link relativo}` resolvido (`../../app/` no backend,
      `../../../intranetNova/` no frontend) e a âncora (§8.1) abre a exceção de escrita só-acréscimo
      para `.claude\entregas\<data de hoje>.md`
- [ ] A `DEFINIÇÃO DE PRONTO` inclui registro gravado, resumo marcado e linha no índice
- [ ] Todo prompt traz o bloco **`CODE REVIEW`** (§8.7) **depois** do `COMMIT DESTA ENTREGA`, com
      a base fixa da entrega, o escopo da worktree, sem correção automática, o commit só do relatório e a linha do índice **depois** desse commit
- [ ] A âncora (§8.1) inclui apenas caminhos de revisão existentes; se necessário, o protocolo portátil foi transcrito (§8.7). O relatório não está na lista do commit de implementação
- [ ] Pasta do dia listada antes de escrever (colisão de `{id}-{assunto}`, §4)
- [ ] **No máximo DUAS worktrees**, uma por camada; nenhum arquivo `03-` ou maior (§1.1)
- [ ] **Os DOIS nomes de branch aparecem em todo arquivo** (§1.1.1): a que o orca cria
      (`{id}-{camada}-{assunto}`) e a final (`{tipo}/{id}-{assunto}`). Arquivo que fala em "Branch"
      no singular é da versão antiga e vai travar o agente no primeiro passo
- [ ] A branch **final** é a mesma nos dois repositórios (a do orca nunca é — o segmento da camada
      difere, e isso está certo)
- [ ] O prompt tem o passo `git branch -m "{BRANCH}"` na PREPARAÇÃO (§8.3), com o desvio de
      "já está renomeada" e o PARE em caso de `already exists`
- [ ] A âncora (§8.1) diz **explicitamente** que encontrar a branch com o nome do orca **não** é
      motivo para parar — parar só em `main`/`master`/nome sem relação
- [ ] Nenhum arquivo manda o **usuário** renomear branch à mão, nem pede nome de branch no orca:
      o orca não tem esse campo
- [ ] `worktree remove` usa o **caminho da pasta** e `branch -d` usa a **branch final** (§7)
- [ ] Todo objetivo tem **critério de aceite testável** em `Dado / Quando / Então`
- [ ] Tarefa que cruza as camadas tem **contrato de API campo a campo**
- [ ] Toda worktree tem **`FORA DO ESCOPO`** preenchido
- [ ] Todo prompt está em bloco ` ```text `, **sem nenhum placeholder pendente**
- [ ] Todo prompt traz os blocos §8.3 (`REGRAS FIXAS`) e §8.4 (`ESPECIFICAÇÃO E PLANO`), nessa
      ordem, **antes** de qualquer leitura de código
- [ ] A âncora (§8.1) abre a exceção read-only para os dois caminhos que o §8.4 manda ler
- [ ] REGRA GIT, PREPARAÇÃO DA WORKTREE, o procedimento de commit e o registro de entrega estão
      **por extenso** no prompt (§8.3, §8.6) — nenhum passo manda ler um `CLAUDE.worktree.md`
      externo como pré-requisito (§2)
- [ ] Toda worktree de **frontend** tem o passo de copiar `proxy.conf.json` do checkout principal
      (§8.3.1) — sem isso `ng serve`/`npm start` quebra com "Proxy configuration file ... does not
      exist"
- [ ] **Todo caminho de worktree usa a raiz do app orca** —
      `C:\Users\vinicius.silva\orca\workspaces\app\{id}-backend-{assunto}` ou
      `...\orca\workspaces\intranetNova\{id}-frontend-{assunto}` — nunca `D:\...\worktrees\...`, e
      nenhuma menção a GitKraken sobrou no arquivo gerado
- [ ] **Todo caminho em bloco de comando** usa barra normal **e** aspas duplas; nenhum PowerShell
- [ ] **Todo `git -C` do backend termina em `/app`** — confira um por um, inclusive no `99-`
- [ ] Nenhum comando gerado faz checkout, commit, push ou merge na `main`
- [ ] Nenhum passo do prompt manda rodar `git push`, em nenhuma branch — commit e pare; push é
      manual, do usuário, por enquanto
- [ ] Nenhum arquivo manda abrir Pull Request ou usar `gh pr create`
- [ ] Nenhum prompt manda ler `.claude\skills\` ou `.claude\CLAUDE.md` dentro de uma worktree (§1)
- [ ] `PRÉ-REQUISITO` (§8.2) presente em toda worktree com dependência de símbolo, e a branch base
      dela é a branch de origem do símbolo — não `origin/main`
- [ ] `99-merge-e-limpeza-{id}-{assunto}.md` gravado, deixando explícito que quem executa é o usuário
- [ ] Resposta no chat contém **só** o ID do ClickUp, a tabela, a ordem de merge e os caminhos

---

## 10. Comportamento geral

- Tom direto e técnico, sempre em português.
- Uma fase de entrevista por vez. Inferência: o que o usuário já respondeu, carregue para frente —
  inclusive o ID do ClickUp já fornecido sem ambiguidade.
- A distribuição é sempre por camada (Fase 4b) — não há agrupamento a explicar, e não se negocia
  worktree extra (§1.1).
- Pesquise o repositório para resolver caminhos e nomes reais. Nunca adivinhe; na dúvida, pare e
  pergunte.
- Esta skill **não escreve código de produção** e **não roda git de escrita**. Ela grava apenas os
  arquivos de plano. Quem commita é o agente que roda **dentro** de cada worktree.
