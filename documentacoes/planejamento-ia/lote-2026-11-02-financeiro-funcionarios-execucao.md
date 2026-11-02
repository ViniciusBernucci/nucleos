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
## Atualização de preparação

- Caminho curto 8.3 resolve a invocação de make: `make -C C:/Users/VINICI~1.SIL/DOCUME~1/DOCUME~1/PROJET~1/nucleos check-env` PASS.
- `make ... lint` iniciou os checks e falhou por EPERM em `.pytest_cache` preexistente.
- ESLint focal do P0 PASS (0 erros, 12 avisos); Prettier focal PASS.
- Integração PG do P0 PASS: 6 testes; banco temporário criado e removido.
- Configuração TypeScript do build atual em Docker Linux, Node 24.22.1: PASS, 20 testes.
- `uv run --frozen --all-packages pytest` no Windows: 370 passed, 9 errors nos
  cenários de arquivos/temporários/permissões de config-py. Ensaio Linux em andamento.
- Integração criada na worktree `../nucleos-worktrees/revisao/2026-11-02-financeiro-funcionarios`.
  Commit de registro de P0: d344146. Ainda não contém código da frente A.
- [Fontes oficiais para Hotmart/Meta](../financeiro/2026-11-02-fontes-integracoes-lote.md)
  consultadas sem credenciais, para orientar FIN-101/102/301. Material de apoio,
  sem mudança de código ou conceito didático novo: lessons NA para esta consulta.
- Frente A informa checks focais PASS (tipos, 4 unitários, 15 HTTP/PG) e conclui
  regressões/documentação; esses resultados ainda aguardam revisão independente.
## Verificações adicionais e integridade

- `uv build --all-packages --out-dir .run/lote-1102-p0-py-dist`: PASS.
- `node node_modules/eslint/bin/eslint.js . --ignore-pattern **/.pytest_cache/** --ignore-pattern **/.venv/**`:
  PASS (0 erros, 49 avisos). É equivalente de varredura da fonte, com caches gerados ignorados
  por argumento; não houve alteração da configuração de lint nem remoção de cache alheio.
- Docker Linux Python 3.13 com uv e `pytest -p no:cacheprovider`: 378 PASS, 1 FAIL por
  ausência do binário Node na imagem. O único teste falho, paridade de padrões TS/Python,
  foi repetido com Node Linux 24.22.1 montado em `/usr/local/bin/node`: PASS (1 teste).
  Não houve mudança na fonte entre as execuções. Não declarar que uma única execução
  completa teve 379 PASS: os resultados foram uma rodada e uma revalidação focal.
- Risco demonstrado: `core.autocrlf=true`, sem `.gitattributes`; migrations 0002 e 0003
  têm bytes diferentes entre checkout principal e worktree (LF vs CRLF). O runner
  calcula SHA sobre SQL bruto. Frente A orientada a fixar `eol=lf` para migrations SQL,
  preservando o conteúdo das já aplicadas, e verificar novamente os checks afetados.
- Binário Node Linux extraído da imagem oficial apenas para o ambiente de testes;
  container auxiliar removido. Execuções de teste usam `--rm`; imagens ficam em cache.