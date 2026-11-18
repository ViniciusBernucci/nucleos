# 18 - Mutações com Server Actions e integridade no PostgreSQL

Criada em 2026-11-02. Última atualização: 2026-11-02 (seção 5: off-canvas com `<dialog>`). Exemplos validados com Node 24.22.2,
TypeScript 5.9.3 (execução direta de `.ts` pelo Node), Next.js 16.4.3, React 19.3.1 e PostgreSQL 18.6
(banco temporário, criado e removido para o teste). Python: não usado nesta lesson.

## Objetivo

Gravar dados a partir de uma página Next.js sem expor a API ao navegador, validando em **três
camadas** (formulário no servidor web, API e banco), e entender por que algumas regras precisam morar
no **PostgreSQL** — não só no código.

**Pré-requisitos:** lessons [00](00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md)
(migrations forward-only) e [17](17%20-%20Painel%20de%20dados%20com%20Server%20Components%20no%20Next.js.md)
(Server Components e a primeira Server Action).
**Posição na trilha:** blocos 5 e 6 (PostgreSQL e Next.js), depois do painel de leitura: aqui a página
passa a **escrever**.

## Modelo mental

```
navegador ──form──▶ Server Action (Next, servidor) ──Bearer──▶ API NestJS ──SQL──▶ PostgreSQL
              valida FormData           valida JSON estrito        CHECK, UNIQUE, FK
```

- **Server Action** é uma função `"use server"` que o formulário chama via POST. Ela roda no servidor
  web, então pode ler a chave de serviço e chamar a API interna; o navegador só vê o resultado.
- **Cada camada valida o que recebe**, porque cada uma pode ser chamada sem a anterior: a action pode ser
  chamada por um POST forjado, a API por `curl`, o banco por um script. O formulário HTML (`required`,
  `min`) é conforto de uso, nunca segurança.
- **Regras de integridade que envolvem concorrência ficam no banco.** "Pagar a conta só uma vez por
  mês" não pode ser só um `SELECT` antes do `INSERT`: dois cliques simultâneos passam pelo `SELECT` juntos.
  Um **índice único** faz o banco recusar o segundo de forma atômica.
- **Dinheiro em centavos inteiros**, convertidos de texto sem passar por `float`.
- **Derivar em vez de materializar**: uma conta mensal não precisa de uma linha por mês. As ocorrências
  saem da vigência (`inicio..fim`) e do dia de vencimento; só o *pagamento* vira linha.

## Conexão com a implementação real

Entrega: [Fluxo de caixa](../documentacoes/financeiro/2026-11-02-fluxo-de-caixa.md).

| Conceito | Arquivo |
| --- | --- |
| Server Actions finas + revalidação | `apps/web/app/(app)/setores/financeiro/fluxo-de-caixa/actions.ts` |
| Regras testáveis das actions (fora do `"use server"`) | `apps/web/lib/fluxo-caixa-acoes.ts` |
| Reais → centavos e leitura do `FormData` | `apps/web/lib/fluxo-caixa-formato.ts` |
| Formulário com `useActionState` | `.../fluxo-de-caixa/_components/FormularioAcao.tsx` |
| Validação estrita do corpo JSON | `apps/api/src/fluxo-caixa/validacao.ts` |
| Ocorrência derivada e saldo corrido (função pura) | `apps/api/src/fluxo-caixa/dominio.ts`, `calendario.ts` |
| CHECK, índice único parcial e FK RESTRICT | `apps/api/migrations/0002_fluxo_caixa.up.sql` |
| Erro do banco → erro de domínio → HTTP 409 | `apps/api/src/fluxo-caixa/repositorio-pg.ts`, `fluxo-caixa.controller.ts` |

## Do exemplo mínimo ao padrão do projeto

### 1. Funções puras: centavos sem float e vencimento derivado

Salve como `ex18.ts` e rode `node ex18.ts`:

```ts
import assert from "node:assert/strict";

/** "1.234,56" | "1234,56" | "1234.56" => 123456; inválido => null. */
function lerValorEmCentavos(texto: string): number | null {
  const t = texto.trim();
  const m =
    /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(t) ?? /^(\d+)(?:[.,](\d{1,2}))?$/.exec(t);
  if (m === null) return null;
  const inteiro = Number((m[1] ?? "").replaceAll(".", ""));
  const centavos = Number((m[2] ?? "").padEnd(2, "0"));
  const total = inteiro * 100 + centavos;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

/** Dia 31 em abril vira 30; em fevereiro, 28 ou 29. */
function vencimentoNoMes(mes: string, dia: number): string {
  const dias = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).getUTCDate();
  return `${mes}-${String(Math.min(dia, dias)).padStart(2, "0")}`;
}

/** A conta vence no mês quando ele está na vigência (inclusive nas pontas). */
const venceNoMes = (c: { inicio: string; fim: string | null }, mes: string): boolean =>
  c.inicio <= mes && (c.fim === null || mes <= c.fim);

assert.equal(0.1 + 0.2 === 0.3, false); // por que não usar float
assert.equal(lerValorEmCentavos("1.234,56"), 123_456);
assert.equal(lerValorEmCentavos("0.1"), 10);
assert.equal(lerValorEmCentavos("1,234"), null); // ambíguo: recusado
assert.equal(vencimentoNoMes("2026-04", 31), "2026-04-30");
assert.equal(vencimentoNoMes("2028-02", 31), "2028-02-29");
assert.deepEqual(
  ["2026-02", "2026-03", "2026-05", "2026-06"].map((m) =>
    venceNoMes({ inicio: "2026-03", fim: "2026-05" }, m),
  ),
  [false, true, true, false],
);
console.log("ok");
```

Comparar `"2026-03" <= "2026-05"` como texto funciona porque o formato `AAAA-MM` tem largura fixa e
vai do mais significativo ao menos significativo.

### 2. Integridade no banco: índice único parcial e FK RESTRICT

Execute num PostgreSQL **descartável** (por exemplo
`docker run --rm -d --name pg18 -p 127.0.0.1:55499:5432 -e POSTGRES_PASSWORD=descartavel postgres:18`
e depois `docker exec -i pg18 psql -U postgres`; ao final, `docker stop pg18`):

```sql
CREATE TABLE contas (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, descricao text NOT NULL);
CREATE TABLE lancamentos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo        text   NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  valor       bigint NOT NULL CHECK (valor > 0),
  conta_id    bigint REFERENCES contas (id) ON DELETE RESTRICT,
  competencia date,
  CHECK ((conta_id IS NULL) = (competencia IS NULL)),
  CHECK (conta_id IS NULL OR tipo = 'saida')
);
-- Único só entre pagamentos de conta; lançamentos avulsos (conta_id NULL) ficam de fora.
CREATE UNIQUE INDEX pagamento_unico ON lancamentos (conta_id, competencia) WHERE conta_id IS NOT NULL;

INSERT INTO contas (descricao) VALUES ('Aluguel');
INSERT INTO lancamentos (tipo, valor, conta_id, competencia) VALUES ('saida', 200000, 1, '2026-11-01');
INSERT INTO lancamentos (tipo, valor, conta_id, competencia) VALUES ('saida', 200000, 1, '2026-11-01');
-- ERROR: duplicate key value violates unique constraint "pagamento_unico"   (SQLSTATE 23505)
INSERT INTO lancamentos (tipo, valor, conta_id, competencia) VALUES ('entrada', 5, 1, '2026-12-01');
-- ERROR: new row violates check constraint                                 (SQLSTATE 23514)
DELETE FROM contas WHERE id = 1;
-- ERROR: violates RESTRICT setting of foreign key constraint                (SQLSTATE 23001)
```

Atenção ao último código: `ON DELETE RESTRICT` falha com **23001** (`restrict_violation`); a FK padrão
(`NO ACTION`) falha com **23503**. A primeira versão do repositório do fluxo de caixa só tratava 23503 e
o teste de integração com PostgreSQL real pegou o erro — mock nenhum teria pego.

### 3. Do erro do banco ao HTTP 409 (padrão do projeto)

O repositório traduz o código SQLSTATE num erro de domínio; o controller o converte em HTTP com
mensagem fixa:

```ts
// apps/api/src/fluxo-caixa/repositorio-pg.ts (trecho)
} catch (e) {
  if (codigo(e) === "23505") throw new PagamentoDuplicado();
  throw e;
}
// apps/api/src/fluxo-caixa/fluxo-caixa.controller.ts (trecho)
if (e instanceof PagamentoDuplicado) throw new ConflictException("a conta ja esta paga nessa competencia");
```

### 4. A Server Action (esqueleto; **não executável isolado**, precisa do Next)

```tsx
// actions.ts
"use server";
import { revalidatePath } from "next/cache";
export async function pagarConta(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  const estado = await regras.pagarConta(f); // valida o FormData e chama a API com o Bearer
  if (!estado.erro) revalidatePath("/setores/financeiro/fluxo-de-caixa");
  return estado; // só mensagens fixas voltam ao navegador
}

// FormularioAcao.tsx
"use client";
const [estado, enviar, pendente] = useActionState(acao, { erro: false, mensagem: "" });
return <form action={enviar}>{children}<button disabled={pendente}>…</button></form>;
```

O padrão do projeto mantém o arquivo `"use server"` fino e põe as regras em `lib/*.ts`, que o
`node --test` importa sem Next; o `fetch` é simulado com `t.mock.method(globalThis, "fetch", …)`.

### 5. Formulário em painel lateral (off-canvas) com `<dialog>` nativo

Para tirar um formulário da página e abri-lo à direita, o elemento `<dialog>` com `showModal()` já
entrega o que uma biblioteca de modal faria: foco preso dentro do painel, `Esc` fecha, o resto da página
fica inerte e há um `::backdrop` para escurecer o fundo. O CSS só posiciona:

```css
/* fluxo-de-caixa.module.css (trecho) */
.painelLateral {
  margin: 0 0 0 auto; /* encosta na direita */
  height: 100dvh;
  max-height: 100dvh;
  width: min(30rem, 100vw);
}
.painelLateral::backdrop {
  background: rgb(0 0 0 / 0.45);
}
/* Em CSS Modules toda classe vira local; classes globais precisam de :global(). */
.formularioPainel :global(.control-input) {
  width: 100%;
}
```

Como o painel sabe que o cadastro deu certo, se o formulário e o painel são componentes separados? O
formulário dispara um **evento DOM que borbulha** e o painel o escuta no `<dialog>`, sem passar funções
entre Server e Client Components (o que não é permitido):

```tsx
// FormularioAcao (cliente): no sucesso
formulario.current?.dispatchEvent(new Event("fluxo:acao-concluida", { bubbles: true }));
// PainelLateral (cliente): fecha ao receber
dialogo.addEventListener("fluxo:acao-concluida", () => dialogo.close());
```

Trocar a `key` do conteúdo a cada abertura remonta o formulário: ele volta limpo e sem a mensagem do
envio anterior.

## Erros comuns e trade-offs

- **"Checar antes de inserir"** (`SELECT` e depois `INSERT`) para unicidade: corrida entre requisições.
  Use restrição no banco e trate o erro.
- **Confiar no `<input required min>`**: um POST forjado ignora o HTML. Valide na action e na API.
- **Ecoar a mensagem do erro** (do banco ou da API) para o usuário: vaza estrutura interna. Use textos fixos.
- **Aceitar campos extras no JSON**: deixe a validação recusar chaves desconhecidas, para um cliente não
  conseguir gravar o que o contrato não prevê.
- **`parseFloat("19.90") * 100`**: dá `1989.9999…` em alguns valores. Leia inteiro e centavos como texto.
- **Server Action sem autorização**: ela é um endpoint POST público do servidor web. Sem login real,
  mantenha o servidor só em `127.0.0.1`; com login, verifique sessão e papel **dentro** da action.
- **Formulário apaga o que foi digitado**: no React 19 o `<form action>` é resetado ao fim da ação, até
  em erro. Por isso a validação HTML evita a maior parte dos erros antes do envio; se precisar preservar
  campos, devolva os valores no estado e use `defaultValue`.
- **Quando materializar ocorrências** em vez de derivar: quando cada parcela tem vida própria (valor
  negociado por mês, anexos, aprovação). Para "mesma conta todo mês", derivar evita jobs e reconciliação.

## Verificação

```bash
cd apps/web && node --test app/fluxo-caixa.test.ts
pnpm --filter @nucleos/api build && node --test apps/api/dist/fluxo-caixa/*.test.js
# Integração (servidor local DESCARTÁVEL; cria e apaga um banco temporário próprio):
TEST_DATABASE_URL="postgres://nucleos_dev:<senha>@127.0.0.1:15432/postgres" node --test apps/api/dist/integracao-pg.test.js
```

## Exercícios

1. Retire o índice `pagamento_unico` no exemplo 2 e dispare dois `INSERT` iguais em sessões `psql`
   diferentes dentro de transações abertas. O que acontece? E com o índice?
2. Por que o índice é **parcial** (`WHERE conta_id IS NOT NULL`)? O que mudaria sem o `WHERE`, sabendo
   que em PostgreSQL `NULL` não colide com `NULL` em índices únicos por padrão?
3. Acrescente periodicidade anual a `venceNoMes`. Que coluna nova a tabela precisaria e qual `CHECK`?
4. A conta de outubro foi paga em 2 de novembro. Em qual mês ela aparece como *Paga*? Em qual mês a
   saída entra no saldo? Por que essa separação (competência × caixa) é útil?
5. Escreva um teste para a action `excluirConta` que garanta que um `id` como `../contas` nunca gera
   chamada à API.

## Parcelas, recorrências materializadas e conciliação

Atualização: 2026-11-03, Node 24.22.2, TypeScript 5.9.3.
Quando cada ocorrência ganha estado próprio, fornecedor, centro de custo e anexo,
uma linha por competência simplifica o histórico. A frente B evolui o caso mensal
derivado para materialização idempotente, preservando o aprendizado anterior.

Para dividir 10.001 centavos em três parcelas, use inteiros:

```ts
export function dividir(total: bigint, parcelas: number): bigint[] {
  if (!Number.isInteger(parcelas) || parcelas < 1 || total < BigInt(parcelas)) {
    throw new Error("parcelamento invalido");
  }
  const n = BigInt(parcelas);
  return Array.from({ length: parcelas }, (_, i) =>
    total / n + (BigInt(i) < total % n ? 1n : 0n));
}
// dividir(10001n, 3) => [3334n, 3334n, 3333n]
```

Criar todas as parcelas numa transação impede que a segunda falha deixe só a
primeira conta. Pagar exige lock na conta, estado aberto e lançamento vinculado
único; a checagem da interface não substitui essa exclusão.

Em conciliação, valor igual não elimina ambiguidade. Duas entradas idênticas num
intervalo de três dias exigem escolha explícita. Na confirmação, revalide se
outro processo já usou o mesmo item. Desfazer libera o vínculo e preserva a
conciliação anterior, em vez de apagar o histórico.

As Server Actions usam mensagens fixas e só o servidor lê a chave da API. Upload
e download de anexo também passam pelo servidor: não envie chave MinIO nem URL
pública ao componente. A compensação de upload remove o objeto se os metadados
falham; isso exige monitorar uma eventual falha de compensação em produção.

Na [entrega B](../documentacoes/financeiro/2026-11-03-base-financeira-b.md), testes
simulados comprovam distribuição de centavos e tentativa de rollback, enquanto
as provas PostgreSQL continuam um gate separado. Exercício: force dois pagamentos
concorrentes e verifique uma única saída, depois force rollback da segunda parcela.

### Integridade também nas rotas antigas

Quando uma nova transferência grava duas linhas, uma rota antiga que apaga qualquer
lançamento pode deixar apenas uma perna. O vínculo precisa ser validado no servidor
em todos os caminhos de escrita. Na exclusão legada, o projeto bloqueia transferência
e lançamento/conta paga já usados em conciliação aceita. Desfazer a conciliação libera
o pagamento para exclusão; uma transferência não é apagada pela rota de lançamento.

A checagem e a exclusão compartilham transação e o mesmo advisory lock da aceitação
de conciliação. Sem essa coordenação, aceitar e apagar poderiam passar em checagens
separadas. O conflito retorna HTTP 409 com mensagem fixa.

Publicar `financeiro.dados.alterados` também faz parte da mutação. Se a gravação
confirmar e a publicação falhar depois, projeções e indicadores ficam desatualizados.
O evento deve usar a mesma conexão e ser confirmado ou desfeito com a operação.
Os testes simulados de `repositorio.test.ts` forçam falha do evento e comprovam que
o caminho termina em rollback; a garantia SQL real depende do teste PostgreSQL.

Veja a [revisão corretiva B](../documentacoes/reviews/2026-11-03-frente-b-revisao-corretiva.md).
Exercício: execute aceitar conciliação e excluir pagamento concorrentemente em um
ambiente isolado autorizado. Por que somente uma ordem compatível deve confirmar?

Uma conta paga e seu lançamento são duas representações do mesmo pagamento. Para
conciliar, use uma identidade comum: `conta_pagar:<id>` nas duas formas. Compare essa
identidade tanto dentro da sugestão manual quanto contra conciliações já aceitas.
Sem isso, trocar o tipo da origem permite contabilizar o mesmo pagamento duas vezes.

## Competencia, caixa e centavos exatos

Atualizacao: 2026-11-06; Node 24.22.2 e TypeScript 5.9.3. A [gestao financeira](../documentacoes/financeiro/2026-11-06-conclusao-financeiro-funcionarios.md) usa duas datas distintas: competencia da despesa na DRE e pagamento no caixa. A conta a pagar reconhecida nao vira outra despesa quando seu pagamento gera um lancamento. Transferencias entre contas tambem nao criam receita ou despesa.

BigInt calcula centavos sem arredondamento binario; JSON recebe strings, pois nao serializa BigInt diretamente:

```typescript
const receita = 10_000_000_000_000_001n;
const custos = 2_700n;
const resposta = JSON.stringify({ resultadoCentavos: (receita - custos).toString() });
console.log(resposta);
```

Nao converta esses valores para Number antes de somar. Nos indicadores mensais, despesas e midia sem alocacao conhecida nao sao rateadas por produto ou centro. O CSV escapa aspas e prefixos de formula, preserva centavos e usa BOM/UTF-8. Os testes `gestao.test.ts` e `financeiro.pg.test.ts` verificam precisao, competencia, pagamento sem duplicacao e projecao por cenario.

Exercicio: registre uma despesa com competencia em fevereiro e pagamento em marco. Prove que fevereiro muda na DRE e marco muda no caixa, sem duplicar o total de despesas. Depois tente exportar uma categoria iniciada por `=`, verificando que ela nao se torna formula ao abrir o CSV.
