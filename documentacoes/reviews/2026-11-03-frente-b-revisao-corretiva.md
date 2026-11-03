# Revisão corretiva independente — frente B

Data: 2026-11-03, America/Sao_Paulo. Revisor: Codex `/root/retomar_m`, independente
do implementador B. Branch: `feat/lote-1102-b-base-financeira`.
Base B: `a1a0b0e`; código congelado: `c5da47f640eb2204cc8bab9d5566fff6ae73ddbd`;
HEAD documental recebido: `0604d25a776ec8493e0e1c41bee1e7c641e0cf05`.
Modo: uma revisão corretiva autorizada do plano avulso; sem QA visual, auditor ou subagente.

**Resultado: correções aplicadas e simulações aprovadas; validação essencial PostgreSQL
PENDENTE. Não há PASS final da revisão, da persistência ou do lote.**

## Escopo e cobertura

FIN-103/101/102/104/105/106: limites do webhook e autenticação, descarte de PII,
reconsulta Hotmart, comissões/moeda e desconto desconhecido, migrations do legado,
parcelamento/recorrências, anexos privados e MIME, extratos idempotentes,
transações/eventos, sugestões/aceitação/desfazer e rotas/telas financeiras.
A leitura preparatória ocorreu sem escrita enquanto B implementava; correções e
testes começaram somente após o coordenador liberar ownership da candidata.

Não foram encontrados novos achados demonstrados de impacto médio/alto/crítico nas
partes lidas de credenciais, normalização compartilhada, anexos ou imports. Isso não
substitui comprovação SQL: checks de banco abaixo permanecem não executados.

## Achados e correções no mesmo ciclo

### RB-01 — Alto: rota legada apagava metade de transferência ou pagamento conciliado

Na candidata, `RepositorioFluxoCaixaPg.excluirLancamento` executava DELETE por id
sem verificar os vínculos novos. A rota de caixa exibe esses lançamentos; apagar a
saída de transferência deixa a entrada e o registro do saque. Apagar pagamento
usado numa conciliação aceita reabre a conta por trigger e deixa a conciliação aceita.
Evidência: `fluxo-caixa/repositorio-pg.ts`, método `excluirLancamento`; criação do
par em `financeiro/repositorio-pg.ts`, método `transferencia`.

A regressão antes da correção falhou com `Missing expected rejection`: o mock permitiu
o DELETE de registro protegido. Agora a exclusão toma o mesmo advisory lock transacional
de aceitar/desfazer, trava o lançamento e rejeita transferência ou conciliação aceita
por lançamento/conta paga. O domínio retorna conflito HTTP 409 com mensagem fixa;
lançamento comum e pagamento cuja conciliação foi desfeita continuam excluíveis.
Testes simulados/HTTP: PASS. SQL real, concorrência e trigger de reabertura: NÃO VALIDADOS.

### RB-02 — Médio: variantes de rota ignoravam limite bruto do webhook

O `verify` de `main.ts` comparava somente `/v1/webhooks/hotmart`, embora Express/Nest
também aceite barra terminal e letras maiúsculas. JSON precedido por mais de 64 KB
de espaços passava pela variante e encolhia ao ser serializado no receptor.
Reprodução HTTP antes da correção: `/v1/webhooks/hotmart/` respondeu **200**, esperado **413**.

O verificador foi extraído para `financeiro/corpo-webhook.ts`, compartilhado com main
e teste HTTP, cobrindo as variantes de rota aceitas. Teste com rota exata, barra final
e maiúsculas: corpo pequeno recebe 200; corpo bruto excessivo recebe 413 sem chegar
ao pool simulado. Não houve acesso a banco nem provedor externo.

### RB-03 — Médio: mutações financeiras confirmavam sem notificar projeções

`cadastro` (fornecedor, centro, conta e regra), `cancelar`, `saldoInformado` e
`receberManual` escreviam com `pool.query`, sem `financeiro.dados.alterados`.
As projeções/indicadores previstos no lote dependem desse evento; a atualização ficaria
defasada até outra rotina. O legado já tinha publicação transacional na candidata e
foi preservado.

Agora os sete caminhos usam gravação e publicação na mesma transação. A regressão
simulada percorre todos com sucesso e falha do publicador: um evento por mutação,
mesma conexão, e falha impede COMMIT/termina em ROLLBACK. PASS nas simulações.
A durabilidade/atomicidade PostgreSQL ainda NÃO FOI VALIDADA.

### RB-04 — Médio: falha de setup/fechamento podia abandonar banco de teste e conexões

O teardown original começava com `pool.end()` sem comprovar que pool já existia.
Se CREATE DATABASE falhasse, perdia o fechamento admin; se o fechamento do pool
falhasse depois de criar o banco, não tentava DROP nem admin.end.

A fixture agora registra callbacks somente depois de adquirir cada recurso.
`teste-pg-apoio.ts` tenta pool, remoção e admin em `finally` encadeados. Testes sem
PostgreSQL cobrem setup parcial e falha em cada etapa. PASS. O HTTP local também
passa a proteger `listen` com `finally` de fechamento. Nenhum DROP/CREATE foi executado.

### RB-05 — Médio: o mesmo pagamento podia ser conciliado como conta e como lançamento

Na candidata, a reutilização comparava apenas `(tipo, referencia_id)`. Conta paga e
seu lançamento são expostos na seleção manual, permitindo somar a mesma origem duas
vezes na mesma conciliação ou aceitá-la em conciliações distintas trocando o tipo.

A validação usa a identidade da conta paga para ambas as representações, rejeita
identidade repetida no lote e verifica as duas formas contra conciliações aceitas,
sob o lock existente. A regressão simulada de duplicação na sugestão manual: PASS,
sem inserir conciliação. A regressão PostgreSQL de aceitação posterior pela outra
representação foi escrita/compilada e NÃO EXECUTADA.

## Verificações executadas

- Antes das correções RB-01/02: build API PASS e execução das duas regressões FAIL
  pelos problemas descritos (`.run/review-b-regressao-before.log`).
- Depois das correções: `pnpm --filter @nucleos/api run build`: PASS (compilação/tipos).
- `node --test apps/api/dist/financeiro/financeiro.http.test.js apps/api/dist/financeiro/repositorio.test.js apps/api/dist/financeiro/teste-pg-apoio.test.js apps/api/dist/financeiro/conciliacao.test.js apps/api/dist/fluxo-caixa/eventos.test.js apps/api/dist/fluxo-caixa/fluxo-caixa.http.test.js`:
  **20 testes PASS, zero falhas e zero skips**. Inclui HTTP 409, variantes do webhook,
  publicação/rollback, cleanup e regressões HTTP do fluxo de caixa.
- ESLint nas 15 fontes próprias da correção: PASS, zero erros/avisos.
- Prettier nas mesmas fontes: PASS na invocação final direta do binário Node.
  A tentativa anterior via array PowerShell/pnpm falhou por tratar a lista como
  um único padrão; não foi falha de formatação nem é contada como PASS.
- Gitleaks 8.30.1 no diff próprio tracked + quatro arquivos novos: PASS, nenhuma detecção.
- `git diff --check`: PASS. Patch próprio completo: [diffs](2026-11-03-frente-b-revisao-corretiva-diffs.md).
- Logs locais ignorados: `.run/review-b-{build-final,test-final,eslint-final,prettier-final,gitleaks}.log`.

Checks globais baseline de implementação não foram repetidos: as falhas conhecidas
de Windows/formatação estão no [registro B](../financeiro/2026-11-03-base-financeira-b.md).
Não foram alterados contratos, dependências ou migrations nesta correção.
Instrumentação Node legada não foi utilizada; consumo de tokens por skill desconhecido.

## Gate PostgreSQL e riscos residuais

**NÃO EXECUTADO:** `financeiro.pg.test.js`. O usuário ainda não declarou a exceção
de ambiente solicitada pelo coordenador; as regras vigentes não comprovam o uso
do core para criar bancos temporários. Não foi acessado `nucleos_dev`, core ou novo container.
Não atribuir à revisão resultados de logs antigos nem contar skip como teste aprovado.

A suíte PG ampliada precisa comprovar idempotência, migrations/legado sem perda,
pagamento concorrente, locks/rollback/eventos, par de transferência protegido,
exclusão somente após desfazer e proibição de conciliar o mesmo pagamento por alias.
Essas verificações essenciais impedem PASS final até ambiente autorizado e execução real.
Testes de tela, aceite visual e ativação Hotmart/MinIO real também permanecem pendentes.

## Documentação, commits e rollback

Atualizados registro B, lessons 18 e 20 e índice, com proteção de vínculos,
identidade do pagamento, eventos atômicos e limite sobre os bytes nas rotas equivalentes.
Nenhum commit criado pelo revisor. O coordenador confere e registra commits locais.
Correções registradas pelo coordenador no commit `ecb94e761f6a303bf6a9d518e019d11b911c80b0`,
`fix(financeiro): proteger vinculos conciliados e limites do webhook`.
Diff staged conferido e Gitleaks staged PASS antes desse commit. O patch documental
final usa o diff commitado com contexto zero, excluindo documentação e lessons.
`apps/web/next-env.d.ts` estava modificado na entrada e permanece fora da correção.

Para reverter apenas este conjunto, use o patch próprio inverso após preservar
alterações posteriores; isso reintroduz os problemas acima. Não há migration nem
operação de dados para desfazer. Esta conferência de correções não é uma segunda revisão completa.
