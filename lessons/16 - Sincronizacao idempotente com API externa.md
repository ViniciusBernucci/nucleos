# 16 - Sincronização idempotente com API externa

Criada em 2026-11-01. Última atualização: 2026-11-03. Exemplos validados com Node 24.22.2,
TypeScript 5.9.3 (type stripping do Node) e PostgreSQL 18. Python: não usado nesta lesson.

## Objetivo

Entender como trazer dados de um serviço externo (aqui, a API de vendas da Hotmart) para o
nosso banco de forma **segura de repetir**: autenticar (OAuth2 `client_credentials`), paginar,
tentar de novo sem martelar o serviço, gravar sem duplicar e evitar duas execuções ao mesmo tempo.

**Pré-requisitos:** lessons [00](00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md),
[12](12%20-%20Configuracao%20tipada%20com%20falha%20rapida.md) e
[13](13%20-%20Segredos%20por%20arquivo%20e%20verificacao%20de%20vazamento.md); `async/await` em TypeScript.
**Posição na trilha:** bloco 5 (PostgreSQL) e bloco 7 (segurança), depois da configuração tipada.

## Modelo mental

Uma sincronização é uma **cópia que pode falhar no meio**. Três regras fazem ela ser confiável:

1. **Idempotência:** rodar duas vezes deixa o banco igual a rodar uma. Chave natural (`transacao`)
   + `INSERT ... ON CONFLICT DO UPDATE` (upsert).
2. **Janela com sobreposição:** consulta-se um pouco além do último sucesso, porque o status de uma
   venda antiga muda (reembolso). Sem sobreposição, a cópia envelhece.
3. **Exclusão mútua:** um *advisory lock* do PostgreSQL impede duas instâncias de sincronizar juntas.

## Conexão com a implementação real

Entrega: [Painel de vendas Hotmart](../documentacoes/financeiro/2026-11-01-painel-de-vendas-hotmart.md).

| Conceito | Arquivo |
| --- | --- |
| Token, paginação, retentativa | `apps/api/src/vendas/hotmart-client.ts` |
| Janela, lock, estado, falha parcial | `apps/api/src/vendas/sincronizacao.ts` |
| Upsert e advisory lock | `apps/api/src/vendas/repositorio-pg.ts` |
| Agendador sem sobreposição (30 min) | `apps/api/src/vendas/agendador.ts` |
| Tabelas | `apps/api/migrations/0001_vendas.up.sql` |

## Do exemplo mínimo ao padrão do projeto

Exemplo mínimo e executável (`node ex16.ts`, sem dependências): pagina, tenta de novo no `429` e grava
de forma idempotente.

```ts
import assert from "node:assert/strict";

interface Pagina {
  items: { transacao: string; status: string; valor: number }[];
  next?: string;
}

let chamadas = 0;
const respostas: (() => { status: number; corpo: Pagina })[] = [
  () => ({ status: 429, corpo: { items: [] } }),
  () => ({ status: 200, corpo: { items: [{ transacao: "A", status: "APPROVED", valor: 100 }], next: "p2" } }),
  () => ({ status: 200, corpo: { items: [{ transacao: "B", status: "APPROVED", valor: 250 }] } }),
];
async function apiFalsa(): Promise<{ status: number; corpo: Pagina }> {
  const r = respostas[chamadas];
  chamadas += 1;
  if (r === undefined) throw new Error("sem resposta");
  return r();
}

async function comRetentativa(max = 3): Promise<{ status: number; corpo: Pagina }> {
  for (let tentativa = 1; tentativa <= max; tentativa += 1) {
    const r = await apiFalsa();
    if (r.status !== 429 && r.status < 500) return r;
    await new Promise((ok) => setTimeout(ok, 10 * 2 ** tentativa)); // espera exponencial
  }
  throw new Error("esgotou as tentativas");
}

const tabela = new Map<string, { status: string; valor: number }>();
const upsert = (itens: Pagina["items"]): void => {
  for (const i of itens) tabela.set(i.transacao, { status: i.status, valor: i.valor });
};

let pagina = await comRetentativa();
upsert(pagina.corpo.items);
while (pagina.corpo.next !== undefined) {
  pagina = await comRetentativa();
  upsert(pagina.corpo.items);
}
assert.equal(tabela.size, 2);
upsert([{ transacao: "A", status: "REFUNDED", valor: 100 }]); // reexecução com status novo
assert.equal(tabela.size, 2); // continua 2 linhas
assert.equal(tabela.get("A")?.status, "REFUNDED"); // e o status foi atualizado
```

O padrão do projeto acrescenta, em camadas:

- **Token em cache** até 60 s antes de expirar; um `401` renova **uma** vez (não em laço).
- **Erro tipado e mensagem fixa** (`HotmartError`): nunca inclui corpo de resposta, URL ou credencial.
- **Uma consulta por status** da Hotmart e **falha parcial**: se uma consulta falha, as outras
  continuam e o estado fica `parcial`; o "último sucesso" só avança em sucesso total.
- **Gravação por página** (não acumula tudo em memória).
- **Reconciliação diária** de 30 dias para reembolsos tardios, além da janela curta de 2 dias.
- **SQL do upsert em lote** com `unnest(...)` e `ON CONFLICT (transacao) DO UPDATE`.

## Erros comuns e trade-offs

- Usar `INSERT` simples: a segunda execução duplica ou falha. Use chave natural + upsert.
- Esquecer duplicatas dentro do **mesmo lote**: `ON CONFLICT` não pode afetar a mesma linha duas vezes
  (o projeto deduplica por `transacao` antes de gravar).
- Repetir sem espera crescente ou sem limite: vira ataque ao próprio fornecedor. Limite tentativas.
- Guardar o e-mail do comprador "só para contar compradores": guarde um pseudônimo HMAC (lesson de
  segurança abaixo) e descarte o resto.
- Passar `password` e `connectionString` juntos ao `pg`: a URL sobrescreve a senha. Monte por componentes
  (`apps/api/src/banco.ts`).
- Quando **não** usar: dado que precisa chegar em segundos. Aí o fornecedor deve enviar *webhooks*; esta
  técnica é para "puxar" em intervalos.

## Verificação

```bash
cd apps/api && node --test dist/vendas/hotmart-client.test.js dist/vendas/sincronizacao.test.js
# Integração com Postgres real (container descartável, 127.0.0.1):
TEST_DATABASE_URL="postgres://<usuario>:<senha>@127.0.0.1:<porta>/postgres" node --test dist/integracao-pg.test.js
```

## Exercícios

1. No exemplo, troque o `429` por `500` na primeira resposta. O resultado muda? Por quê?
2. Faça `comRetentativa(1)` e observe o erro. Quando falhar rápido é melhor que insistir?
3. Por que a sincronização incremental começa em `ultimoSucesso - 2 dias` e não em `ultimoSucesso`?
4. O que acontece se duas instâncias rodarem juntas sem o advisory lock? Quais linhas poderiam divergir?

## Credencial Basic e access token

Client Token e uma credencial Basic usada para obter o access_token OAuth2; nao e o bearer
das consultas de vendas. HOTMART_CLIENT_TOKEN e mantido como Secret, removendo apenas o
prefixo Basic na montagem do cabecalho. Nao se aplica Base64 novamente ao token fornecido.
Sem ele, permanece a derivacao Base64 de Client ID:Client Secret por compatibilidade.

A chamada OAuth2 usa POST e os parametros grant_type, client_id e client_secret conforme a
[documentacao oficial](https://developers.hotmart.com/docs/pt-BR/start/app-auth/).
As credenciais na query precisam de URLSearchParams para codificar caracteres reservados;
nao registre a URL da autenticacao ou o erro cru do fetch. O cliente devolve erros fixos.
Vendas usam GET /payments/api/v1/sales/history com Authorization Bearer do access_token,
datas em milissegundos UTC, filtro transaction_status e cursor next_page_token/page_token.
O conjunto de status inclui PRE_ORDER e PROCESSING_TRANSACTION; DELAYED nao esta na lista
de historico documentada. O lock do banco continua impedindo sobreposicao entre agendador
e botao manual; iniciar pelo botao nao altera a janela incremental nem a idempotencia.

Exercicio: teste um Client Token ja prefixado e prove que o cabecalho contem apenas um Basic.
Veja os testes reais em hotmart-client.test.ts e o [registro da entrega](../documentacoes/financeiro/2026-11-01-atualizacao-manual-hotmart.md).

## Janela reimportada e cursores externos: Meta Ads

A [importação Meta Ads](../documentacoes/financeiro/2026-11-03-importacao-meta-ads.md)
reutiliza a idempotência com chave `(campanha_id, dia)`. A cada seis horas reimporta
sete dias, incluindo o dia corrente em `America/Sao_Paulo`. Isso permite corrigir
atribuições que o fornecedor atualiza depois da primeira leitura.

O cursor é dado externo, não uma autorização para visitar outra URL. O cliente
reconstrói a rota fixa `graph.facebook.com/v26.0/act_<id>/insights`, copia somente
`paging.cursors.after` validado, rejeita repetição e não segue `paging.next`.
O bearer fica no cabeçalho; erros têm mensagens fixas, sem corpo da resposta ou URL.

O upsert ocorre em uma transação com advisory lock por conta. Antes e depois das
gravações, verifica-se a lease do motor. Se ela for perdida, a transação inteira
é desfeita. Upsert evita duplicatas; a verificação da lease impede que um executor
antigo confirme dados depois de perder o trabalho para outro consumidor.

Valores monetários devem ser convertidos de texto para centavos com `BigInt`,
sem passar por `Number`. O teste executável abaixo usa a função real:

```typescript
import assert from "node:assert/strict";
import { centavos } from "../apps/api/dist/marketing/meta-client.js";

assert.equal(centavos("19.99"), "1999");
assert.equal(centavos("0.105"), "11"); // arredondamento half-up declarado
assert.equal(centavos("99999999999999.99"), "9999999999999999");
```

Salve o exemplo em `lessons/exemplo-meta.ts`, após o build, e execute com
`node lessons/exemplo-meta.ts`. O arquivo é só uma sugestão para estudo, não parte
dos artefatos da entrega.

As compras `purchase`, `omni_purchase` e `offsite_conversion.fb_pixel_purchase`
podem descrever o mesmo evento. O importador escolhe uma série prioritária e
guarda qual escolheu; não soma as três. Valores reportados pela Meta não são
receita financeira nem lucro. Contas fora de BRL são rejeitadas explicitamente,
sem supor câmbio.

Verifique com `node --test apps/api/dist/marketing/meta-client.test.js`.
Exercício: forneça `paging.next` em um domínio diferente e prove que todas as
requisições continuam no domínio fixo; depois teste um cursor repetido.

Nos testes de integração, uma falha pode acontecer entre criar o banco temporário e
inicializar o servidor HTTP. Registre cada recurso assim que ele existir e faça a limpeza
com `finally`: se fechar o servidor falhar, ainda é necessário fechar o pool, remover o
banco criado pelo teste e encerrar a conexão administrativa. O teste não deve pressupor
que toda a preparação terminou. Veja a [correção da fixture Meta](../documentacoes/reviews/2026-11-03-frente-m-revisao-corretiva.md).
Exercício: identifique quais recursos precisam ser liberados se a primeira migration
falhar. Escrever esse caminho de limpeza não substitui executá-lo em ambiente autorizado.
