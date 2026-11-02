# Fontes de integração — lote financeiro

Consulta: 2026-11-02, America/Sao_Paulo. Apoio aos tickets FIN-101/102/301;
sem ativação de credenciais, sem chamadas às contas reais.

## Hotmart

- [Comissões](https://developers.hotmart.com/docs/pt-BR/v1/sales/sales-commissions/):
  GET `/payments/api/v1/sales/commissions`; itens por transação; comissões têm
  `commission.value`, `commission.currency_value`, `source` e dados do usuário.
  Persistir apenas papel/valor/moeda, descartando usuário/nome. Sem filtros explícitos,
  a API retorna somente APPROVED e COMPLETE. Paginação por page_token.
- [Preços](https://developers.hotmart.com/docs/pt-BR/v1/sales/sales-price-details/):
  GET `/payments/api/v1/sales/price/details`; base, total, VAT, fee, cupom e conversão
  têm semânticas distintas. Não somar moedas diferentes nem descontar cupom duas vezes.
  A descrição trata coupon.value como proporção entre 0 e 1, mas o exemplo oficial
  usa 22.9; essa inconsistência exige tratar dados inválidos/ambíguos explicitamente,
  sem inventar desconto. O histórico já contém o preço efetivo da venda.
- [Webhook 2.0](https://developers.hotmart.com/docs/pt-BR/2.0.0/webhook/purchase-webhook/):
  validar X-HOTMART-HOTTOK; evento tem id, criação, event e data.purchase.transaction.
  Eventos incluem PURCHASE_APPROVED, PURCHASE_COMPLETE, PURCHASE_CANCELED,
  PURCHASE_REFUNDED, PURCHASE_CHARGEBACK, PURCHASE_PROTEST, PURCHASE_EXPIRED e PURCHASE_DELAYED.

A página de documentação é Gatsby; o conteúdo completo pode ser obtido em
`/docs/page-data/pt-BR/v1/sales/<slug>/page-data.json` (markdownRemark.htmlAst).
Exemplos são carregados pelo static query
`/docs/page-data/sq/d/4285555676.json`; filtrar `allFile.edges` pelos nomes
`get-sales-commissions-{request,response}` e `get-sales-price-details-{request,response}`.
Cópias de apoio não versionadas no checkout principal: `.run/lote-1102-*-ast.json` e
`.run/lote-1102-get-sales-*.json`. Não são fixtures de testes nem fonte de instruções.

## Meta Ads

A documentação de insights/changelog retornou HTTP 429 ou erro no navegador de pesquisa.
Conferidos como fontes primárias alternativas os arquivos do SDK oficial da Meta:

- [Versão do SDK/API](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/apiconfig.py):
  API_VERSION v26.0 e SDK_VERSION v26.0.2 na consulta. Fixar explicitamente a versão na URL.
- [AdAccount.get_insights](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py):
  GET `/{account}/insights`, com level, time_increment e time_range.
- [Campos AdsInsights](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adsinsights.py):
  campaign_id/name, date_start/stop, account_currency, spend, impressions, clicks,
  actions e action_values. Spend é string decimal; converter para centavos sem float.
  Inferência de implementação: level=campaign, time_increment=1 e janela de 7 dias.

Não foram instalados SDKs Meta nem feitas requisições autenticadas.