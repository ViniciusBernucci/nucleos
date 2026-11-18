# Webhook seguro e idempotência

Criada/atualizada em 2026-11-03. Node 24.22.2, TypeScript 5.9.3.
Pré-requisitos: lessons 11, 13, 16 e 19. Objetivo: receber uma notificação externa
sem confiar no payload e sem repetir seus efeitos.

Uma notificação avisa que algo mudou. A fonte de verdade continua sendo a consulta
autenticada à plataforma. O receptor confirma rápido depois de gravar um identificador
mínimo e enfileirar o trabalho na mesma transação. O funcionário faz a consulta depois.

## Autenticar sem registrar o segredo

```ts
import { createHash, timingSafeEqual } from "node:crypto";

export function autentica(recebido: string, esperado: string): boolean {
  const digest = (valor: string): Buffer =>
    createHash("sha256").update(valor).digest();
  return timingSafeEqual(digest(recebido), digest(esperado));
}
```

Os hashes têm tamanho fixo, inclusive quando os textos têm comprimentos diferentes.
O segredo esperado vem de configuração `Secret`, nunca do corpo recebido nem do log.
O método evita diferenças óbvias de comparação; não promete eliminar toda diferença
de tempo da rede ou do restante do servidor.

## Duplicata não é outra venda

A Hotmart pode reenviar o mesmo id. Uma chave primária sobre o id permite:

```sql
INSERT INTO financeiro.webhooks_hotmart(id, tipo, transacao, corpo_hash)
VALUES ('evento-ficticio', 'PURCHASE_APPROVED', 'transacao-ficticia', repeat('0', 64))
ON CONFLICT(id) DO NOTHING;
```

O exemplo supõe a migration 0010 já aplicada **em ambiente de teste autorizado**.
No código real, somente uma inserção nova publica o evento interno e ambas as
operações usam a mesma conexão/transação. Uma falha não pode confirmar o recebimento
sem deixar o trabalho durável.

Não copie nome, e-mail ou o payload inteiro para a tabela/evento. O hash não permite
reconstruir o conteúdo, mas continua sendo metadado de auditoria e precisa da mesma
proteção de acesso. O consumidor reconsulta a transação e usa a normalização comum
da sincronização, inclusive quando o evento recebido é antigo.

## Erros comuns e limites

- Comparar HOTTOK com `===`, ou registrar cabeçalhos completos.
- Tratar apenas duplicatas em memória; uma reinicialização perde essa proteção.
- Devolver 200 antes da transação confirmar.
- Confiar no status fornecido no corpo e sobrescrever uma consulta mais recente.
- Limitar o corpo somente depois de persistir ou gravar PII no evento interno.

Esse fluxo cabe em notificações pequenas e processamento assíncrono. Não substitui
um upload de arquivo nem garante entrega de um provedor que nunca reenviou o evento.
Polling e reconciliação continuam cobrindo a janela de inconsistência.

O tamanho deve ser limitado sobre os bytes antes de desserializar o JSON. Muitos
espaços podem desaparecer no objeto, então `JSON.stringify(corpo).length` não é
uma medida do corpo recebido. A verificação também precisa cobrir todas as rotas
equivalentes que o servidor aceita: neste projeto, letras maiúsculas e barra final.
Comparar somente o caminho literal deixava uma variante ignorar o limite de 64 KB.
O mesmo verificador de produção é usado no teste HTTP com JSON pequeno precedido
de mais de 64 KB de espaços; todas as variantes devem responder 413 sem consultar banco.

## Verificar e praticar

`node --test apps/api/dist/financeiro/webhook.test.js` usa pool/motor simulados para
provar autenticação, limite, descarte de PII e uma publicação por id. Isso não prova
a restrição PostgreSQL: a integração real precisa de ambiente isolado declarado.

`node --test apps/api/dist/financeiro/financeiro.http.test.js` verifica também o
limite bruto nas variantes de rota usando somente HTTP local e pool simulado.
Correção e evidência: [revisão B](../documentacoes/reviews/2026-11-03-frente-b-revisao-corretiva.md).

Exercícios: envie o mesmo id com payload distinto; force rollback antes do commit;
compare um evento de reembolso atrasado com a reconsulta atual da transação. Em
cada caso, identifique qual camada garante idempotência e quais dados são descartados.

Código e limites reais: [entrega da frente B](../documentacoes/financeiro/2026-11-03-base-financeira-b.md).
