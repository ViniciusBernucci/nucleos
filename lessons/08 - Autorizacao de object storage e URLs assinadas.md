# 08 - Autorizacao de object storage e URLs assinadas

Criada em 2026-10-26. Ultima atualizacao: 2026-10-26.
Versoes: Node 24.22.1, TypeScript 5.9.3 (o exemplo e JavaScript valido em TypeScript), Python 3.13.17 declarado pelo repositorio (nao usado aqui). Numeracao **provisoria**: o coordenador reconcilia a posicao na trilha.

## Objetivo, pre-requisitos e posicao na trilha

Entender como arquivos de varios clientes (tenants) ficam no mesmo servico de object storage sem que a credencial ou a URL de um acesse o objeto de outro. Bloco 7 (seguranca). Pre-requisitos: HTTP, a lesson [01 - Sessao opaca e revogacao](01%20-%20Sessao%20opaca%20e%20revogacao.md) (identidade vem de credencial verificada) e a nocao de container Docker em `127.0.0.1`.

## Modelo mental

Object storage nao tem pastas: a chave `tenants/a/doc/x.pdf` e uma string. Duas camadas protegem:

1. **O servidor monta a chave** a partir da identidade verificada (nunca do que o cliente ou o LLM enviam) e rejeita o que foge do formato antes de falar com o provedor.
2. **O provedor nega** o que a credencial nao cobre (`AccessDenied`), mesmo que a camada 1 falhe.

URL assinada e um "cheque" com o caminho e a validade dentro da assinatura: mudar o caminho invalida a assinatura; quem emitiu so assina o que a propria credencial pode acessar; apagar a credencial invalida as URLs que ela assinou.

## Conexao com a entrega real

PoC do ENT-DEC-009 (ADR-023, **Proposto**): [registro](../documentacoes/dados/2026-10-26-dec-009-object-storage.md) e [ADR-023](../documentacoes/arquitetura/adr/0023-provedor-e-autorizacao-de-object-storage.md). O PoC sobe MinIO efemero e prova, com 73 verificacoes, bucket por tenant, prefixo, credencial temporaria por chamada, revogacao, versionamento/object lock e criptografia em repouso.

## Exemplo minimo executavel (Node 24, sem dependencias)

```js
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const TENANT = /^[a-z0-9][a-z0-9-]{0,62}$/;

// O servidor constroi a chave; o tenant vem da identidade, nunca do corpo do pedido.
function chaveDoTenant(tenantId, documentId, nome) {
  if (!TENANT.test(tenantId)) throw new Error("tenant invalido");
  if (!/^[0-9a-f-]{36}$/.test(documentId)) throw new Error("document_id invalido");
  const base = nome.split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  if (base === "") throw new Error("nome invalido");
  return `tenants/${tenantId}/${documentId}/${base}`;
}

// Politica S3 por prefixo: a barra final evita confundir `a` com `ab`.
const politica = (bucket, t) => ({
  Version: "2012-10-17",
  Statement: [
    { Effect: "Allow", Action: ["s3:GetObject"], Resource: [`arn:aws:s3:::${bucket}/tenants/${t}/*`] },
  ],
});
const permite = (pol, chave, bucket) =>
  pol.Statement.some((s) => {
    const prefixo = s.Resource[0].replace(`arn:aws:s3:::${bucket}/`, "").slice(0, -1);
    return chave.startsWith(prefixo);
  });

const doc = "11111111-1111-4111-8111-111111111111";
const k = chaveDoTenant("a", doc, "../../etc/passwd");
assert.equal(k, `tenants/a/${doc}/passwd`);
assert.ok(permite(politica("b1", "a"), k, "b1"));
assert.ok(!permite(politica("b1", "a"), chaveDoTenant("ab", doc, "x"), "b1")); // prefixo parecido
assert.throws(() => chaveDoTenant("A/../b", doc, "x"));

// A assinatura cobre o caminho: mudar o caminho muda a assinatura (URL de A nao serve para B).
const assina = (segredo, caminho, expira) =>
  createHmac("sha256", segredo).update(`GET\n${caminho}\n${expira}`).digest("hex");
assert.notEqual(assina("segredo-a", `/b1/${k}`, 60), assina("segredo-a", `/b1/outra`, 60));
console.log("ok");
```

Salve como `exemplo.mjs` e rode `node exemplo.mjs` (imprime `ok`). O codigo completo do PoC esta em `infrastructure/docker/poc-object-storage/` (`politica.mjs` e a referencia das guardas; `sigv4.mjs` mostra a assinatura real; `run-poc.sh` executa tudo).

## Do minimo ao padrao do projeto

1. Exemplo acima: chave montada no servidor + politica por prefixo + assinatura que cobre o caminho.
2. PoC: a mesma ideia contra um S3 de verdade (MinIO), com casos negativos: ler, gravar, apagar e listar em outro tenant; chave inexistente (deve dar `AccessDenied`, nao 404, para nao revelar existencia); URL adulterada; URL expirada; confusao de prefixo `a` x `ab`.
3. Padrao proposto: bucket por tenant, credencial so no servico de storage, TTL maximo de 300 s, revogacao apagando a chave.

## Erros comuns, trade-offs e quando nao se aplica

- Prefixo de politica sem a barra final (`tenants/a*` casa com `tenants/ab/...`).
- Aceitar a chave ou o `tenant_id` do cliente; confiar so no `startsWith` sem validar segmentos.
- Achar que `..` e travessia no S3: nao e (a chave e literal), mas o servidor deve rejeitar mesmo assim, porque o armazenamento local, logs e outros componentes podem interpretar o caminho.
- Entregar a credencial ao runtime em vez de URL de curta duracao.
- URL de PUT nao limita tamanho sozinha; exija cota/tamanho no servidor ou POST policy.
- Nao se aplica a dados que cabem no banco do tenant ou a conteudo publico por design.

## Verificacao e exercicios

- Verificacao: `node exemplo.mjs`; para a prova completa, `infrastructure/docker/poc-object-storage/run-poc.sh` (precisa de Docker; termina com `73 OK, 0 FALHA` e remove tudo).
- Exercicio 1: acrescente ao exemplo uma politica que permita `PutObject` e escreva o teste negativo de `ab` gravando em `tenants/a/`.
- Exercicio 2: por que a revogacao da chave do tenant invalida URLs ainda dentro do TTL, e o que isso muda no desenho do TTL?
- Exercicio 3: liste o que o provedor ve e o que so o servidor sabe quando o tenant e deduzido do corpo da requisicao.
