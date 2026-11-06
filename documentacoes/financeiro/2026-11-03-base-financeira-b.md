# Base financeira — frente B

Data: 2026-11-03, America/Sao_Paulo. Domínio: financeiro.
Tickets: FIN-103, FIN-101, FIN-102, FIN-104, FIN-105 e FIN-106.
Branch: `feat/lote-1102-b-base-financeira`. Base: `a1a0b0e` (A integrada/revisada).
Estado: candidata congelada para revisão, **sem aprovação de persistência nem aceite visual**.
Revisão corretiva aplicada em `ecb94e7`; aprovação final ainda depende de PostgreSQL.

## Objetivo e estado inicial

Retomar o lote avulso aprovado, preservando o parcial de alertas e as migrations 0008–0009,
e oferecer a base operacional para as próximas frentes de gestão/marketing.
O parcial inicial não continha a frente B concluída: havia alertas, duas migrations de
vendas e integração inicial no main. Esta entrega inclui esse trabalho preservado e a
continuação descrita abaixo; não atribui código da frente A à retomada.

Escopo e critérios: [especificação §4](../planejamento-ia/lote-2026-11-02-financeiro-funcionarios-especificacao.md#4-tickets--onda-b-base-financeira-confiável-etapas-14).
Fora: produção, novas instâncias, migração do banco de desenvolvimento, ativação de
webhook público e consultas autenticadas às contas reais.

## Comportamento e decisões

- Alertas usam chave única enquanto abertos, mensagem fixa e evento na mesma transação.
- Vendas preservam preço efetivo da Hotmart e desconto desconhecido explícito: não se
  desconta cupom duas vezes. Comissões de afiliado/coprodutor são separadas por moeda;
  moeda divergente falha sem conversão. Chargeback/disputa pertencem a `contestada`.
- Importação incremental, reconciliação diária/histórica e webhook usam normalização
  comum e histórico de status. A reconciliação processa páginas sem guardar todas as
  vendas do período na memória. Importação histórica cria execução persistente com
  configuração específica validada, sem editar a atribuição.
- Webhook público exige HOTTOK em tempo constante, corpo limitado e identificador
  idempotente; apenas id/tipo/transação/hash são persistidos. Não persiste payload/PII.
- Despesas parceladas distribuem o resto em centavos, recorrências mensais/anuais
  materializam três meses e preservam os pagamentos legados. A leitura do fluxo
  existente também respeita a periodicidade anual.
- Anexos PDF/JPG/PNG têm limite de 10 MB e assinatura verificada. MinIO precisa de
  bucket privado previamente provisionado; sem configuração a API responde indisponível.
  Não há URL pública. Se metadados falharem, o upload é compensado por remoção.
- Transferências/saques são pares de lançamentos transacionais, identificados por UUID.
  Saldo disponível é informado com data/origem; previsões sem regra não ganham data
  fictícia. CSV de despesas tem prévia e confirmação; extratos OFX/CSV deduplicam por conta.
- Conciliação exige confirmação. Dois candidatos exatos deixam pendência de análise.
  A aceitação revalida os itens e serializa a disputa por itens já usados; desfazer
  preserva o registro da conciliação. Comparação de saldo Hotmart é explícita e parcial.

## Arquivos e contratos

Migrations novas `apps/api/migrations/0007_*` até `0015_*`: alertas, vendas, webhook,
contas a pagar, anexos, contas financeiras, extratos e conciliação. Nenhuma aplicada
ao banco de desenvolvimento por esta sessão.

- `apps/api/src/financeiro/`: serviços, rotas autenticadas, receptor público, rotinas,
  parsers, anexos privados e testes. `RepositorioFinanceiroPg` expõe cadastros,
  contas, movimentos, recebimentos e transações/eventos para as frentes seguintes.
- `apps/api/src/vendas/`: enriquecer por comissões/preços, histórico de status,
  grupos e cálculo do líquido. Sem nomes/e-mails de participantes persistidos.
- `apps/api/src/fluxo-caixa/`: periodicidade anual e publicação transacional de
  `financeiro.dados.alterados` nas mutações do fluxo existente.
- `apps/api/src/funcionarios/motor.ts`: configuração opcional da execução manual,
  validada como o snapshot normal. Configuração da atribuição permanece intacta.
- `apps/api/src/main.ts`: composição financeira, configuração e limite de corpo.
- `packages/contracts/src/{vendas,fluxo-caixa}.ts`: grupo contestada e periodicidade
  opcional compatível com as chamadas existentes.
- `packages/config/src/financeiro*`, `.env.example`: HOTTOK/MinIO por Secret ou arquivo;
  configuração parcial é recusada sem valores no erro.
- `apps/web/app/(app)/setores/financeiro/`: contas a pagar/receber, movimentos,
  conciliação, alertas e detalhe de vendas. Formulários seguem Server Actions/off-canvas.
- `apps/web/app/api/financeiro/anexos/[id]/route.ts`: proxy privado de download.
  `apps/web/next.config.mjs` permite o tamanho de upload previsto; a API mantém seus limites.
- `apps/api/package.json`, `pnpm-lock.yaml`: SDK S3 autorizado e fixado em 3.1161.0.
- Mapa de dados e lessons 16, 18, 20 e índice: documentação associada, excluída do patch recursivo.

As consultas financeiras retornam bigint em texto. A camada histórica de vendas mantém
seus contratos numéricos anteriores; os novos cálculos de parcelas/extratos não usam float.

## Verificações reais

Resultados da candidata de código `c5da47f640eb2204cc8bab9d5566fff6ae73ddbd`.
Logs locais ignorados em `.run/`; não contêm valores de ambiente.

| Check | Resultado comprovado até este registro |
| --- | --- |
| `pnpm run build` final | PASS, 7 tarefas, exit 0 |
| `make build` | PASS, TypeScript/Next e artefatos Python, exit 0 |
| ESLint focal | PASS, 0 erros/16 avisos |
| ESLint geral e arquitetura | PASS, 0 erros/73 avisos; 217 módulos/525 dependências sem violação |
| Testes direcionados de financeiro/vendas/fluxo/config | PASS, 67 testes, sem skips, exit 0 |
| Web: fluxo-caixa, vendas-formato/env/atualizacao | PASS, 17 testes, sem skips, exit 0 |
| `make contracts-check` | PASS, fontes sem drift e 11 contratos compatíveis |
| `make test` | FAIL: 6 testes de configuração de paths/permissões Unix no Windows |
| `make lint` final | FAIL, exit 2: Prettier em NavLink.tsx/layout.tsx, ambos inalterados desde a base |
| Gitleaks 8.30.1 sobre todo o stage de código | PASS, exit 0, sem detecções |
| `git diff --check` / stage | PASS |
| PostgreSQL real / migrations / concorrência | NÃO VALIDADO: ambiente de teste não declarado nas regras canônicas atuais |
| MinIO e Hotmart reais | NÃO EXECUTADO; clientes simulados, sem ativação externa |
| Aceite de tela | PENDENTE, manual conforme manifesto §8, ~400 px e temas claro/escuro |

A fixture PG preservada cria/remove banco temporário apenas quando há
`TEST_DATABASE_URL`. Ela **não foi executada nesta retomada**, pois o harness antigo
aponta para o core e as regras vigentes exigem declaração de ambiente isolado.
Não interpretar mocks de transação como prova de integridade PostgreSQL.

Instrumentação do Context Compiler: NA (execução avulsa direta, sem preparo Node).
Contadores nativos de tokens indisponíveis; não foram estimados.

## Aceites e pendências

FIN-103/101/102: fonte e testes simulados implementados; consistência PG/idempotência
persistida NÃO VALIDADA. FIN-104/105/106: fluxos e fixtures implementados; aplicação
de migrations, preservação de dados e exclusão concorrente em PG NÃO VALIDADAS.
Nenhum desses tickets recebe DONE técnico antes do gate de persistência/revisão.

Também pendem validação manual da igualdade dos totais com Hotmart, configuração de
credenciais/bucket privado, cadastro de URL pública e aceite visual. Não há autorização
para produção, push, PR ou merge em main.

## Riscos, compatibilidade e rollback

Migrations são forward-only: não alterar arquivos após aplicação. Antes de aplicar,
validar a sequência completa e a migração dos pagamentos existentes em ambiente isolado.
Backup/restore do banco único é a reversão de dados; não apagar tabelas para desfazer
a entrega. A reversão do código exige manter compatibilidade com as colunas novas.
Sem credenciais, recursos externos falham fechado; nenhuma disponibilidade financeira
é inferida da importação de anúncios ou das vendas.

## Commits e diffs

Commit de código: `c5da47f640eb2204cc8bab9d5566fff6ae73ddbd`,
`feat(financeiro): implementar base operacional da frente B`.
O [patch completo de código/testes/configuração](2026-11-03-base-financeira-b-diffs.md)
compara a base `a1a0b0e` à candidata, sem diff da documentação dentro dela própria.
O commit documental posterior não altera o código. `apps/web/next-env.d.ts` é saída de geração
preexistente na worktree e não pertence à entrega.

A [revisão corretiva independente](../reviews/2026-11-03-frente-b-revisao-corretiva.md)
registra as correções posteriores à candidata, com
[patch próprio](../reviews/2026-11-03-frente-b-revisao-corretiva-diffs.md): exclusão
legada protegida, limite bruto do webhook nas rotas equivalentes, eventos atômicos
nas mutações financeiras, cleanup de fixture em setup parcial e identidade única do
pagamento exposto como conta paga ou lançamento. Os testes PostgreSQL
continuam NÃO EXECUTADOS, aguardando ambiente autorizado; não há PASS final do lote.

Lessons: [sincronização](../../lessons/16%20-%20Sincronizacao%20idempotente%20com%20API%20externa.md),
[mutações](../../lessons/18%20-%20Mutacoes%20com%20Server%20Actions%20e%20integridade%20no%20PostgreSQL.md),
[webhook seguro](../../lessons/20%20-%20Webhook%20seguro%20e%20idempotencia.md).

## Fontes primárias

Consulta em 2026-11-03: [comissões Hotmart](https://developers.hotmart.com/docs/pt-BR/v1/sales/sales-commissions/),
[webhook Hotmart](https://developers.hotmart.com/docs/pt-BR/2.0.0/webhook/purchase-webhook/) e
[exemplos S3 SDK v3 da AWS](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html).
As páginas Hotmart abertas nesta retomada entregaram apenas shell HTML; o conteúdo
estruturado e a semântica dos preços consultados na preparação constam das
[fontes do lote](2026-11-02-fontes-integracoes-lote.md). Testes usam fixtures fictícias,
sem inferir verificação ao vivo das contas.
