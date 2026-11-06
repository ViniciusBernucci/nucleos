# Agentes de IA com ferramentas de leitura e orçamento

Criada/atualizada: 2026-11-06. Python 3.13, Node 24.22.2, TypeScript 5.9.3, anthropic 2.6.0.
Pré-requisitos: lessons 11 (fila/lease), 13 (segredos), 19 (agendamento) e 20 (eventos externos).

## Objetivo

Construir um agente consultivo que lê agregados, tem orçamento finito e não pode transformar uma resposta do modelo em uma escrita. A implementação real está no [CFO financeiro](../documentacoes/financeiro/2026-11-06-conclusao-financeiro-funcionarios.md).

O modelo escolhe uma ferramenta; o código decide se ela existe, se a credencial pode executá-la e quanto ainda se pode gastar. Um texto dizendo “somente leitura” no prompt não substitui essas verificações.

No Núcleos, a allowlist tem seis nomes. Cada ferramenta tem schema sem argumentos, e recebe o período validado do pedido original. O modelo não escolhe URL, método HTTP, SQL ou limites. A chave que consulta esses agregados não autentica rotas de pagamento ou de administração. Os agregados conservam centavos textuais e códigos internos, sem nomes de pessoas ou campanhas.

## Do laço mínimo ao código do projeto

Exemplo executável na raiz, depois de `uv sync --frozen --all-packages`. Salve como arquivo temporário e execute com `uv run --all-packages python arquivo.py`. O cliente é simulado: não requer chave nem chama a Anthropic.

```python
from ai_gateway.cfo import AgenteCfo, Limites
from decimal import Decimal

class ModeloLocal:
    def contar(self, mensagens: list[dict[str, object]], modelo: str) -> int:
        return 100

    def responder(
        self, mensagens: list[dict[str, object]], modelo: str, saida: int
    ) -> dict[str, object]:
        return {
            "content": [{"type": "text", "text": "Consulte o caixa antes de investir."}],
            "usage": {"input_tokens": 100, "output_tokens": 20},
            "stop_reason": "end_turn",
        }

def ler(nome: str, periodo: dict[str, str]) -> object:
    if nome != "dre":
        raise ValueError("ferramenta nao autorizada")
    return [{"mes": "2026-11", "resultado": "10000"}]

agente = AgenteCfo(ModeloLocal(), ler, Limites(custo=Decimal("0.25")))
resultado = agente.executar({
    "competencia": "diagnostico", "de": "2026-11-01", "ate": "2026-11-06"
})
assert resultado["status"] == "SUCESSO"
assert resultado["uso"]["entrada"] == 100
print(resultado["status"])
```

O adaptador real conta a entrada antes da chamada e reserva o custo de entrada mais a saída máxima. Depois usa o consumo informado pelo provedor e decide se pode continuar. `Decimal` evita erros de arredondamento binário no cálculo monetário. Uma resposta sem texto não vira sucesso fictício. O teto é uma estimativa operacional por execução, não uma integração com a fatura da Anthropic ou uma cota diária persistente.

## Falhas e retentativas

HTTP tem uma ambiguidade importante: o cliente pode perder a resposta depois de o provedor já ter cobrado. Repetir automaticamente pode duplicar o gasto. O handler grava uma reserva única por `execucao_id` antes da chamada; ao retomar, encontra essa reserva e não chama novamente. Isso troca disponibilidade automática por proteção contra repetição. O operador pede uma nova execução quando decide repetir.

Lease e reserva resolvem problemas diferentes. A lease impede que um trabalhador atrasado finalize trabalho de outro. A reserva impede que uma nova tentativa repita a chamada paga. Nenhuma delas garante que uma requisição já recebida pelo provedor foi cancelada quando o cliente desconectou.

## Verificar e exercitar

`uv run --frozen --all-packages pytest -p no:cacheprovider services/ai-gateway/tests` valida a recusa de ferramentas de escrita, argumentos extras, custo/tokens/passos, autenticação e ausência de segredos em logs, com cliente simulado. O teste PostgreSQL em `financeiro.pg.test.ts` comprova a reserva persistente e a ausência de pseudônimos nos agregados enviados.

Experimente pedir uma ferramenta `pagar`, fornecer `max_custo` no pedido e configurar um teto menor que a reserva. Cada caso deve parar antes de executar a ação não autorizada. Simule também perda da resposta e confira que a mesma execução não chama o gateway duas vezes.

Esse padrão serve para análise consultiva com ferramentas pequenas e previsíveis. Não o use como autorização para pagamentos, alteração de anúncios ou ferramentas arbitrárias. Expor a aplicação a múltiplos usuários/tenants exige identidade e quotas correspondentes, fora do lote local de admin único.
