# FND-008 — Estrutura documental, templates de ADR e runbooks — 2026-10-25

## 1. Metadados

- **Domínio:** engenharia
- **Tarefa:** FND-008 do lote 2026-10-25-ep00-ep01-fundacao — [ENT-FND-008](../backlog/EP-01-fundacao-monorepo-ambientes-ci/tickets.md#ent-fnd-008)
- **Branch:** `tarefa/fnd-008`
- **Base / commit inicial:** `2cb39dcae2aa0437bd74ad1dc6da9387ef4c2594` (base informada pelo manifesto do lote); `HEAD` inicial igual à base; árvore limpa
- **Estado:** pronta para revisão independente (não revisada pelo autor)
- **Autores conhecidos:** Claude Sonnet 5.5 (executor); solicitante: Vinícius

## 2. Objetivo, contexto e escopo

- **Objetivo:** criar a estrutura documental da fundação: ADRs individuais, template, pastas `seguranca`, `runbooks`, `engenharia`, `_modelos` e notas de substituição de stack.
- **Contexto:** a Especificação Mestra e o backlog de 2026-09-22 assumem .NET 10; o ADR consolidado de 2026-10-25 escolhe NestJS/TypeScript e Python. Q-01 já foi decidida pelo usuário: stack TypeScript + Python.
- **Escopo:** ver seção 4.
- **Fora do escopo:** alterar `CLAUDE.md`, `AGENTS.md` e `lessons/` (tarefa LOC-001); escrever conteúdo de segurança ou runbooks; ADR-016+.

## 3. Resumo da implementação

- Importados ADR-001..015 como arquivos individuais em `documentacoes/arquitetura/adr/`. A fonte traz, por ADR, só decisão, justificativa e consequência (tabela da seção 2.2); esses textos foram copiados literalmente e as demais seções do template foram declaradas ausentes na fonte, sem invenção. O documento original não foi tocado.
- Criados `0000-template.md` (Status, Contexto, Problema, Decisão, Alternativas, Benefícios, Trade-offs, Consequências, Quando revisar) e `README.md` índice dos ADR.
- Criados READMEs de `seguranca`, `runbooks`, `engenharia`, `_modelos` e o modelo de documento de entrega.
- Notas "Substituída em parte" (stack) inseridas, sem remover conteúdo, em `Nucleos-Especificacao-Mestra.md` e `documentacoes/transversal/2026-09-22-backlog-completo.md`.
- Q-01 registrada como decidida (stack TypeScript + Python) no README dos ADR; a atualização de `CLAUDE.md`/`AGENTS.md`/`lessons/` fica com LOC-001.

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `documentacoes/arquitetura/adr/0000-template.md` | doc | template de ADR |
| `documentacoes/arquitetura/adr/0001-...` a `0015-...` (15 arquivos) | doc | ADR-001..015 importados |
| `documentacoes/arquitetura/adr/README.md` | doc | índice, stack vigente, referência a Q-01 |
| `documentacoes/seguranca/README.md`, `runbooks/README.md`, `engenharia/README.md`, `_modelos/README.md` | doc | READMEs das pastas |
| `documentacoes/_modelos/modelo-documento-de-entrega.md` | doc | template de entrega conforme `CLAUDE.md` |
| `Nucleos-Especificacao-Mestra.md` | doc | +2 linhas: nota de substituição |
| `documentacoes/transversal/2026-09-22-backlog-completo.md` | doc | +2 linhas: nota de substituição |
| esta entrega e `-diffs.md` | doc | registro |

Sem código, testes, configuração ou migrações.

## 5. Decisões técnicas

- Importação literal das células da tabela, com cabeçalho de proveniência separado; alternativa (expandir o conteúdo) foi descartada por violar "sem alterar o conteúdo" e exigir inventar texto. Consequência: os ADRs importados são curtos; complementos virão em ADRs novos.
- Status dos importados repete o declarado na fonte (baseline aprovada, sujeita a validação de segurança).
- Nomes dos arquivos: `NNNN-slug-do-titulo.md`, slug truncado em 7 palavras (alguns ficam cortados, ex.: `0001-saas-com-control-plane-central-e-data.md`); o título dentro do arquivo é o completo.

## 6. Validações

Script `val.py` (no scratchpad, fora do repositório), executado em 2026-10-25:

| Verificação | Resultado |
| --- | --- |
| ADRs importados vs. linhas ADR da fonte | 15 = 15 |
| Células de decisão, justificativa e consequência presentes literalmente em cada arquivo | OK (15/15) |
| Documento original inalterado (`git diff 2cb39dc`) | OK |
| Links relativos em todos os `.md` novos/modificados | 63 verificados (excluindo o arquivo de diffs, cujos links são texto de patch), 0 quebrados (após criar esta entrega) |
| Notas de substituição | +2/-0 linhas em cada um dos dois documentos (nada removido) |

Build, lint e testes: não aplicável (não há código; ver `CLAUDE.md`, seção de validação).

## 7. Impactos e rollback

Somente documentação; sem impacto em execução. Rollback: reverter o commit da branch `tarefa/fnd-008`. Compatibilidade: links existentes continuam válidos.

## 8. Commits e diffs

Diffs completos (incluem os arquivos novos): [2026-10-25-fnd-008-estrutura-documental-diffs.md](2026-10-25-fnd-008-estrutura-documental-diffs.md). Este documento e o arquivo de diffs não entram no patch, para evitar recursão. O commit é criado ao final; seu SHA é informado ao coordenador no retorno da tarefa (um documento não pode conter o hash do próprio commit sem amend).

## 9. Lessons

Não criadas nem alteradas: a entrega só cria documentação e não introduz nem exercita conceito de C#/.NET (trilha atual) nem de TypeScript/Python; `lessons/` não existe na base e a adaptação da trilha à stack vigente (Q-01) é da tarefa LOC-001.

## 10. Pendências

- Atualizar `CLAUDE.md`, `AGENTS.md` e `lessons/` para a stack vigente: LOC-001.
- Conteúdo de `seguranca/` e `runbooks/` e ADR-016+: tarefas futuras.
- Revisão e QA independentes: pendentes no fluxo do lote.
