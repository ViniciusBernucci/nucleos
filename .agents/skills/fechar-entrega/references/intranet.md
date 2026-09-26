## Invariantes de registro e autorização

Os caminhos abaixo são o perfil Intranet/Orca original. Confirme os caminhos reais antes de gerar comandos; não aplique esse perfil a outro projeto. Instruções explícitas do usuário prevalecem sobre as convenções deste perfil.

O registro captura apenas as alterações desta entrega: inclua alterações staged, unstaged e arquivos novos pertinentes, sem duplicar trechos. Não inclua o próprio registro, relatórios gerados, segredos, binários ou alterações de terceiros no diff documental. Para binários, registre caminho e efeito; para conteúdo sensível, descreva a alteração com redação. `git diff` sozinho não cobre staged nem arquivos não rastreados. Antes de commitar, confira o índice inteiro: se houver alterações staged alheias, não as inclua nem as remova silenciosamente.

O índice diário exige conferir se a linha desta entrega já existe antes de acrescentar. Escritas concorrentes precisam ser serializadas ou protegidas por lock; estar fora do Git não elimina corridas. Não use o hash de HEAD como prova de commit de trabalho ainda não commitado. Publicar o resumo no ClickUp é outra ação, dependente de autorização já existente ou pedido explícito.

# Fechar entrega

Esta skill é a **última etapa de toda sessão que alterou código**. Ela existe separada do
`CLAUDE.md` porque só importa no fim — carregá-la em toda sessão custava contexto em conversas que
nunca commitam nada.

Ordem fixa: **1. registro de entrega (com o resumo do ClickUp) → 2. commit (sem push) → 3. linha no
índice diário → 4. resumo repetido no chat.** O registro entra no mesmo commit do código que
documenta, então ele vem antes; a linha do índice leva o hash do commit, então ela vem depois.

`<obrigatório>` **Push é manual, por enquanto.** Esta skill commita e para — nunca rode `git push`.
Quem publica no remoto é o usuário, quando decidir. `</obrigatório>`

Sessões dentro de uma worktree do orca **não enxergam esta skill** — o prompt gerado pela
`worktree-planner` traz a transcrição dela (bloco `REGISTRO DE ENTREGA`, §8.6 do perfil Intranet daquela skill). Mudou
algo aqui? Mude lá também, ou os dois caminhos divergem.

---

## 0. ID da tarefa no ClickUp

Descubra o ID antes de escrever, nesta ordem: a linha `Tarefa ClickUp:` do `CLAUDE.local.md` da
worktree; o segmento de ID da branch (`{tipo}/{id}-{assunto}`); o que o usuário disse na sessão. Não
achou? **Pergunte**, com as opções `Informar o ID` e `Não possui ID vinculado`.

Normalize: minúsculas, sem `#`, só `[a-z0-9-]`. Sem ID vinculado: o nome do registro não leva o
segmento `{id}-`, o texto diz `Tarefa ClickUp: não possui ID vinculado`, o marcador leva `id=nenhum`
e a coluna do índice diz `não possui ID vinculado`.

---

## 1. Registro de entrega

`<obrigatório>`

**Um arquivo por sessão _por repositório tocado_**, não por plano. O registro mora no repositório da
camada que ele documenta — versionado junto do código:

| A sessão mexeu em | Grava o registro em |
| --- | --- |
| só backend | `D:\Documentos\00 - Dev\docker-intranet\app\docs\historico\entregas\` |
| só frontend | `D:\Documentos\00 - Dev\intranetNova\docs\historico\entregas\` |
| **nos dois** | **um arquivo em cada**, cada um documentando **apenas** as mudanças daquele repositório |

Numa worktree, o caminho é o mesmo `docs\historico\entregas\`, relativo à raiz da worktree.

Na sessão que toca os dois, o `Contexto` de cada arquivo **cita** que a sessão também tocou o outro
repositório e **referencia o caminho** do outro registro — sem duplicar o conteúdo dele. Nunca
coloque o diff do frontend dentro do registro do backend, nem o contrário.

Sem o(s) arquivo(s) a tarefa **não está concluída**. Vale para feature, bug, refactor e infra.

A pasta `D:\Documentos\00 - Dev\docker-intranet\docs\` (sem o `\app`) **não existe** — fica acima do
repositório do backend e nunca poderia ser commitada.

`</obrigatório>`

**Nome:** `docs\historico\entregas\AAAA-MM-DD-{id}-{assunto-em-kebab-case}.md`, com a data de hoje,
o ID do ClickUp (§0) e o assunto da **primeira** entrega da sessão **naquele repositório**. Antes de
escrever, verifique se **esta** sessão já criou o arquivo nesse repositório — se sim, **edite-o**.
Arquivo de assunto parecido criado numa sessão anterior não conta, mesmo que seja do mesmo dia.

Registro de entrega é **log de sessão**, não documentação de funcionalidade — por isso mora em
`historico\entregas\` e não na raiz de `docs\`. Documentou uma funcionalidade nova? O arquivo vai na
pasta do módulo dela, com nome temático, sem data. Leia `docs\README.md` antes de criar doc nova.

**Estrutura:**

- No topo, um `# {título}` e, logo abaixo, uma linha com a data, `Tarefa ClickUp: {id}`, todos os
  repositórios tocados e a branch.
- **Uma entrega só:** as seções vêm direto abaixo do título.
- **Mais de uma entrega:** cada uma vira `## Parte N — {título}`, na ordem de execução, com as
  seções em `###`. Cada parte é completa em si — quem ler só a Parte 2 não pode precisar da Parte 1.

**Seções obrigatórias, nesta ordem:**

1. `Contexto` — que problema originou isso, e como funcionava antes.
2. `O que foi feito` — a solução em prosa, com o **porquê** de cada decisão de arquitetura e as
   alternativas descartadas (e por quê).
3. `Arquivos alterados` — tabela `caminho | criado/alterado/removido | o que mudou`.
4. `Diffs` — o diff de **todo** arquivo tocado, um bloco ` ```diff ` por arquivo, com o caminho como
   cabeçalho. Arquivo novo entra inteiro. Proibido resumir em "trecho relevante": o registro tem que
   bastar sozinho, sem abrir o repositório.
5. `Impacto e pontos de atenção` — migration pendente, breaking change de contrato, o que testar à
   mão, o que ficou fora do escopo e por quê.
6. `## Resumo para o ClickUp` — **sempre a última seção**, fora de qualquer `## Parte N`, no formato
   do §1.1.

**De onde vêm os diffs** — um repositório por vez, e o do backend termina em `\app`:

```bash
git -C "D:/Documentos/00 - Dev/docker-intranet/app" diff
git -C "D:/Documentos/00 - Dev/docker-intranet/app" status
git -C "D:/Documentos/00 - Dev/intranetNova" diff
git -C "D:/Documentos/00 - Dev/intranetNova" status
```

Escreva em português, no nível de detalhe de quem vai ler isso em seis meses sem lembrar de nada.

### 1.1 Resumo para o ClickUp — dentro do registro, marcado

`<obrigatório>`

O resumo do card vai **dentro do registro de entrega**, entre marcadores que **outro agente** usa
para extrair o texto e publicá-lo no card da tarefa. Os marcadores são contrato com esse agente:
**nunca** mude a grafia, nunca os omita, nunca ponha dois blocos no mesmo registro (com várias
Partes, um bloco só resume todas).

```markdown
## Resumo para o ClickUp

<!-- clickup-resumo:inicio id={id} camada={backend|frontend} -->
**{Título — uma linha, o que foi entregue}**

**O que foi feito**
- {bullet em linguagem de produto}

**Como testar**
1. {passo}

**Pontos de atenção**
- {ponto}

**Repositório:** {repo} ({camada})
<!-- clickup-resumo:fim -->
```

Sessão que tocou as duas camadas tem **um bloco em cada registro**, cada um com a sua `camada=` — o
agente do ClickUp publica os dois no mesmo card. Sem ID vinculado, `id=nenhum`: o agente pula.

`</obrigatório>`

Conteúdo entre os marcadores — markdown enxuto, em português, que caiba na descrição de uma tarefa:

- **Título** — uma linha, o que foi entregue.
- **O que foi feito** — 3 a 6 bullets em linguagem de **produto**. Quem lê é gestão, não quem vai
  abrir o repositório: sem nome de classe, sem caminho de arquivo, sem nome de método.
- **Como testar** — passo a passo curto e numerado, do ponto de vista de quem usa a tela. Diga quem
  precisa ser o usuário (perfil, área, permissão) quando isso importa.
- **Pontos de atenção** — ordem de publicação entre backend e frontend, risco assumido, configuração
  de ambiente, o que ficou fora do escopo. Só o que muda a decisão de alguém. Risco assumido por
  decisão do usuário durante a sessão **precisa** aparecer aqui: o card é onde a equipe vai
  encontrar essa informação depois.
- **Repositório** — nome e camada, uma linha.

Nada de diff, nada de bloco de código, nada de tabela de arquivos — isso já está no registro.

---

## 2. Commit — sem push

As regras completas estão na seção **Regras de Git** do `CLAUDE.md` do repositório. O essencial:

- Se você está numa **worktree**, o commit é seu. **Não rode `git push`** — publicar no remoto é
  manual, feito pelo usuário depois.
- No **checkout principal**, não commite: liste os arquivos alterados e aguarde revisão humana.
- **Nunca** na `main`. **Nunca** PR. **Nunca** co-autoria. **Nunca** `git add .`. **Nunca** `git push`.
- O registro de entrega entra **no mesmo commit** do código que documenta.
- Mensagem de uma linha, em português: `{tipo}: {o que mudou}` — sem o ID do ClickUp.

---

## 3. Índice diário de entregas

`<obrigatório>`

Depois do **último** commit, acrescente **uma linha por registro** no índice do dia:
`D:\Documentos\00 - Dev\docker-intranet\.claude\entregas\{AAAA-MM-DD}.md`, com a data **da
entrega**. É o que responde "o que foi entregue em cada dia".

Fica **fora do git** de propósito: agentes dos dois repositórios escrevem nele sem conflito de
merge. É log operacional entre repositórios, como os planos em `.claude\worktrees\` — não é
documentação de camada.

Só **acréscimo** (`>>`). Nunca edite nem apague linha que já está lá — é de outra entrega. A coluna
`Resumo ClickUp` nasce `pendente`; quem a muda para `publicado` é o agente do ClickUp, nunca esta
skill. Não faça `commit --amend` depois de gravar a linha: o hash dela deixaria de existir.

`</obrigatório>`

```bash
DATA="$(date +%F)"
REPO="D:/Documentos/00 - Dev/intranetNova"          # ou .../docker-intranet/app, ou a worktree
INDICE="D:/Documentos/00 - Dev/docker-intranet/.claude/entregas/$DATA.md"
HASH="$(git -C "$REPO" rev-parse --short HEAD)"      # checkout principal: "sem commit — aguardando revisão"
REGISTRO="docs/historico/entregas/$DATA-{id}-{assunto}.md"
mkdir -p "D:/Documentos/00 - Dev/docker-intranet/.claude/entregas"
if [ ! -f "$INDICE" ]; then
  printf '# Entregas de %s\n\nAntes do merge, o registro só abre com: git -C "<repositório>" show <commit>:<caminho>\n\n| ID ClickUp | Worktree | Camada | Branch | Commit | Registro | Resumo ClickUp |\n| --- | --- | --- | --- | --- | --- | --- |\n' "$DATA" > "$INDICE"
fi
printf '| %s | %s | %s | %s | %s | [%s](%s) | pendente |\n' \
  "{id}" "{nome da worktree, ou checkout principal}" "{camada}" "{branch}" "$HASH" \
  "{repo}/$REGISTRO" "{../../app/ no backend, ../../../intranetNova/ no frontend}$REGISTRO" >> "$INDICE"
tail -n 3 "$INDICE"
```

O link relativo parte de `docker-intranet\.claude\entregas\` e aponta para o **checkout principal**
— só abre depois do merge. Antes dele, vale o hash da coluna `Commit`.

---

## 4. Resumo no chat

Termine a sessão repetindo no chat o conteúdo do bloco `clickup-resumo` de cada registro, o caminho
de cada registro e a(s) linha(s) do índice. **Não gere outro arquivo** para o resumo: a fonte é o
registro; o chat é só conferência.

---

## Checklist de saída

- [ ] ID do ClickUp descoberto ou perguntado (§0), normalizado, no nome e no cabeçalho do registro
- [ ] Registro de entrega escrito em **cada** repositório tocado, no caminho da camada certa
- [ ] Diffs completos, tirados do repositório correto, sem mistura entre os dois
- [ ] `## Resumo para o ClickUp` é a última seção, com os marcadores `clickup-resumo:inicio` /
      `clickup-resumo:fim` intactos, `id=` e `camada=` preenchidos, um bloco por registro
- [ ] Documentação afetada atualizada (módulo, não `historico\`)
- [ ] Commit feito conforme a regra do lugar onde você está, com mensagem de uma linha, sem o ID
- [ ] Linha acrescentada no índice diário `.claude\entregas\{AAAA-MM-DD}.md`, com hash e
      `pendente` — nenhuma linha antiga alterada
- [ ] Nenhum `git push` rodado — publicar no remoto é manual, do usuário
- [ ] Nada na `main`, nenhum PR, nenhuma co-autoria, nenhum `git add .`
- [ ] Resumo repetido no chat, sem arquivo extra
