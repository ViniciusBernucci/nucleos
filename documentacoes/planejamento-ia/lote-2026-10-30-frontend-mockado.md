# Lote 2026-10-30 — frontend navegável com dados mockados

> **Estado:** PRONTO_PARA_REVISAO_HUMANA · **Identificador:** `lote-2026-10-30-frontend-mockado` · **Fuso:** America/Sao_Paulo · **Publicação:** manual.
> **Especificação:** [LOC-WEB-001](lote-2026-10-30-frontend-mockado-web-001.md) · **Estado:** [estado.json](lote-2026-10-30-frontend-mockado-estado.json) · **Prompt:** [prompt](lote-2026-10-30-frontend-mockado-prompts.md).

## Demanda e decisão

O usuário pausou novas implementações de backend/motor de IA, dispensou revisores de QA e a parte do prédio 3D nesta sessão, e priorizou frontend com dados mockados. O lote contém uma tarefa local preparatória e não altera o estado de conclusão dos tickets canônicos `WEB-001`, `WEB-003` e `WEB-005`.

## Tarefa

| Chave | Camada | Perfil | Dependências | Critérios | Status |
| --- | --- | --- | --- | --- | --- |
| LOC-WEB-001 | `apps/web` + docs | padrão — feature visual isolada, sem contrato/API/auth/dados reais | scaffold FND-001 integrado | `WEB-MOCK-AC-01..07` | INTEGRADA_APROVADA |

Justificativa do perfil: muda a experiência funcional do frontend, mas usa somente fixtures locais, não altera contrato entre camadas e não toca autenticação, autorização, dados ou infraestrutura. Gates: implementação, review independente e QA independente.

## Isolamento e ordem

Uma frente, branch `tarefa/loc-web-001`, worktree `/home/vinicius/nucleos-worktrees/tarefa/loc-web-001`. Base planejada: `revisao/2026-10-25-ep00-ep01-fundacao` em `f322f4b1698f94ae276fdb8838137cd6b7e9cef8`; antes da criação o orquestrador deve confirmar a base real e registrar eventual avanço, sem incorporar trabalho backend novo como requisito. Branch de revisão do lote: `revisao/2026-10-30-frontend-mockado`.

Ordem: criar/preparar worktree → implementar → review → auditoria se houver achados → correções/revalidação → QA → integração local → validação combinada do web app. Não há paralelismo ou contrato externo.

## Riscos e recursos

- Não introduzir dependências silenciosamente; usar Next.js/React/CSS já instalados.
- Marcar dados como demonstração e manter fixtures separadas da apresentação.
- Não simular autenticação/segurança real nem apresentar mock como aceite dos tickets do EP-10.
- Node 24.22.1 e pnpm 12.15.0 são o ambiente declarado; limitações do host devem aparecer na evidência.
- Sem banco ou serviço externo; nenhum teste de dados reais é autorizado ou necessário.

## Autorização

O redirecionamento do usuário autoriza executar esta tarefa depois de estabilizar as frentes já abertas. Push, PR, deploy e publicação continuam proibidos. Para retomada explícita: execute `orquestrador-fluxo-ia` com este manifesto.

