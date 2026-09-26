# Regra permanente do projeto

Esta e uma regra de workspace do Antigravity e deve permanecer configurada como
**Always On**. Ela se aplica a todas as tarefas e agentes deste repositorio.

## Forma de trabalho

- Antes de alterar codigo, leia a estrutura, os arquivos `.sln`, `.csproj`,
  `global.json`, `Directory.Build.*`, o README e os testes relacionados.
- Preserve arquitetura, limites de dominio, convencoes e estilo existentes.
  Nao faca refatoracoes alheias a tarefa.
- Para C#/.NET, respeite `TargetFramework`, versao da linguagem, nullable
  reference types, analisadores e formatadores configurados.
- Implemente ou atualize testes proporcionais ao risco. Execute build, testes,
  lint e formatacao aplicaveis; informe exatamente o que foi ou nao executado.
- Nao exponha segredos, tokens, dados pessoais ou valores de `.env` em codigo,
  saidas, diffs ou documentacao.
- Nao crie, reescreva, faca amend ou envie commits sem pedido explicito. Mesmo
  sem commit, registre o diff da tarefa.

## Definicao obrigatoria de pronto

Uma entrega que mude codigo, testes, configuracao, banco, infraestrutura ou
comportamento so termina quando o agente tambem:

1. cria ou atualiza `documentacoes/<dominio>/`;
2. cria ou atualiza as lessons aplicaveis;
3. atualiza `lessons/README.md` e os links afetados;
4. registra verificacoes, commits e diffs reais da tarefa;
5. garante que os documentos representam o estado final.

Nao adie a documentacao. Analises e revisoes sem alteracao no repositorio nao
exigem artefatos de entrega, salvo pedido do usuario.

## Documentacao por entrega

### Local e nome

- Salve em `documentacoes/<dominio>/YYYY-MM-DD-titulo-breve.md`, usando a data
  local ISO da implementacao.
- Escolha um dominio de negocio em kebab-case, como `usuarios`, `faturamento` ou
  `estoque`, e nao uma camada tecnica.
- Use `documentacoes/transversal/` somente para mudancas transversais.
- Crie a pasta ausente. Atualize o documento da tarefa existente em vez de
  duplicar.

### Conteudo minimo

Inclua em cada documento:

1. titulo breve e data;
2. dominio, tarefa/issue ou solicitacao, branch, base/commit inicial, estado e
   autores conhecidos;
3. objetivo, contexto, escopo e fora de escopo;
4. resumo e alteracoes por arquivo, incluindo testes, configuracao e migracoes;
5. decisoes, alternativas e consequencias relevantes;
6. validacoes com comandos e resultados reais;
7. impactos, riscos, compatibilidade, observabilidade e rollback aplicaveis;
8. commits e diffs da branch pertencentes a tarefa;
9. links relativos para lessons criadas ou atualizadas;
10. pendencias reais ou declaracao de que nao ha pendencias conhecidas.

### Commits e diffs

- No inicio, registre branch, `HEAD`, arvore de trabalho e base. Use a base
  informada; senao o merge-base da branch padrao remota; se indisponivel,
  documente a referencia escolhida.
- Liste apenas commits e mudancas desta tarefa.
- Para cada commit, registre SHA, mensagem e diff unificado textual em bloco
  cercado `diff`.
- Se nao houver commit novo, declare `Nenhum commit criado nesta tarefa` e
  inclua os diffs staged e unstaged correspondentes.
- Inclua patches de codigo, testes e configuracao. Para patches grandes, crie
  `YYYY-MM-DD-titulo-breve-diffs.md` na mesma pasta, com resumo no documento
  principal e links nos dois sentidos.
- Para binarios, liste caminho, tipo, tamanho e hash quando util; nao fabrique
  diff textual.
- Troque somente segredos ou dados pessoais por `[REDACTED]`, marcando a
  remocao. Nunca invente trechos.
- Evite recursao: nao inclua no patch o diff produzido apenas ao escrever em
  `documentacoes/` e `lessons/`; liste esses arquivos na entrega.

## Base didatica viva em lessons

`lessons/` e uma trilha progressiva de C#/.NET, nao um changelog. Toda
implementacao deve identificar os conceitos usados e criar ou melhorar as
lessons correspondentes.

### Indice e ordem

- Mantenha `lessons/README.md` como indice canonico, com descricao da trilha,
  pre-requisitos e links para todas as lessons.
- Nomeie arquivos como `NN - Nome do conceito.md`, iniciando em `00` e com zeros
  a esquerda.
- Ordene por dependencia pedagogica, nao por data.
- Antes de criar, procure assunto equivalente e atualize-o para evitar
  duplicidade.
- Se um conceito precisar mudar de posicao, renomeie os arquivos afetados,
  recalcule a numeracao e atualize o indice e todos os links relativos na mesma
  entrega. Confirme que nao restaram referencias aos nomes antigos.
- Preserve conteudo conceitual correto ao reorganizar.

### Conteudo de uma lesson

Cada lesson criada ou atualizada deve conter, quando aplicavel:

1. objetivo, pre-requisitos e posicao na trilha;
2. explicacao simples e modelo mental;
3. relacao com a implementacao e link para a documentacao da entrega;
4. exemplos validos em C#/.NET, com `using`, tipos e configuracao necessarios;
5. progressao do exemplo minimo ao padrao do projeto;
6. erros comuns, trade-offs e quando nao usar;
7. verificacao ou testes e exercicios/perguntas de revisao;
8. data de criacao, ultima atualizacao e versao de .NET dos exemplos.

Use o framework e as convencoes do repositorio. Exemplos devem compilar ou ser
marcados como pseudocodigo. Nao copie segredos nem regras sensiveis. Se nao
houver conceito C#/.NET relevante introduzido, alterado ou exercitado, nao crie
conteudo artificial; justifique no documento da entrega por que `lessons/` nao
mudou.

## Conferencia final

- Revise o estado e o diff final do repositorio.
- Confirme que o escopo foi implementado e validado.
- Valide datas, nomes, links e ordem de `documentacoes/` e `lessons/`.
- Garanta que commits e diffs documentados sao reais e pertencem a tarefa.
- Resuma ao usuario a entrega, os testes e os caminhos dos documentos.
