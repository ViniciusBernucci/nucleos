# Execução — lote financeiro e funcionários

Data inicial: 2026-11-02 (America/Sao_Paulo).
Manifesto: [plano](lote-2026-11-02-financeiro-funcionarios.md).
Especificação: [referência](lote-2026-11-02-financeiro-funcionarios-especificacao.md).

## Autorizações e base

Pedido: aplicar os três planos avulsos. Usuário autorizou explicitamente em seguida:
P0, commits locais das frentes e integração, cron-parser, @aws-sdk/client-s3 e anthropic
com versões fixadas. Sem push, PR, publicação ou merge em main.
Fluxo avulso: execução direta, sem conversão para compilador nem Node legado.

Checkout principal: developer; HEAD inicial c5427047db13c8bb84e3a635298e94e89105caea.
Árvore inicial suja: implementação do fluxo de caixa, regras/skills avulsas e backlogs/planos.
Alterações de regras/skills e outros backlogs foram preservadas fora do commit P0.

P0: commit a2aa0cc (`feat(financeiro): concluir base de fluxo de caixa para lote 1102`).
Escopo e verificações: [registro P0](../financeiro/2026-11-02-fluxo-de-caixa.md#verificação-de-p0-para-o-lote-financeirofuncionários-2026-11-02).

## Estado

- P0: commit criado; checks focais PASS; checks gerais com limitações de Windows abaixo.
- Frente A (FUN-001…006): EM_IMPLEMENTACAO na branch feat/lote-1102-a-funcionarios,
  worktree ../nucleos-worktrees/feat/lote-1102-a-funcionarios, base a2aa0cc.
- Frentes B, M, C e D: NÃO INICIADAS, aguardam dependências do manifesto.
- Revisão corretiva independente: NÃO EXECUTADA.
- Integração e checks integrados: NÃO EXECUTADOS.
- Testes manuais/aceite visual: PENDENTES conforme manifesto §8.

## Verificações da preparação

Logs locais ignorados em `.run/lote-1102-p0-*.log`:

| Comando | Resultado |
| --- | --- |
| pnpm run build | PASS (7 tarefas) |
| pnpm run lint | PASS (10 tarefas, checagem de tipos) |
| node --test apps/api/dist/fluxo-caixa/*.test.js | PASS (19 testes) |
| node --test app/fluxo-caixa.test.ts, em apps/web | PASS (6 testes) |
| make lint | FAIL antes dos checks: invocação de shell/caminho com espaços no Windows |
| pnpm run lint:quality | FAIL: EPERM ao percorrer .pytest_cache preexistente |
| pnpm run test | FAIL: testes de caminhos/permissões Unix em packages/config no Windows |

Não há PASS da suíte geral nem aprovação técnica/visual do lote.
Docker observado: nucleos-dev-postgres-1 em 127.0.0.1:15432.
Nenhuma migration nova do lote aplicada no banco de desenvolvimento.
Não copiar variáveis/segredos para este documento.