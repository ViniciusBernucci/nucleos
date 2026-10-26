// Proposta de politica do servico de storage (ADR-023, DEC-009). Funcoes puras, sem E/S.
// O servidor constroi a chave; nada vindo do cliente ou do LLM vira chave sem passar por aqui.

export const TTL_MAXIMO_SEGUNDOS = 300; // ENT-DAT-006: URL assinada de curta duracao (<= 5 min)
const TENANT = /^[a-z0-9][a-z0-9-]{0,62}$/; // mesma allowlist do ADR-020
const DEPARTAMENTO = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class ChaveInvalida extends Error {}

export function nomeSeguro(bruto) {
  if (typeof bruto !== "string") throw new ChaveInvalida("nome nao e texto");
  const base = bruto.split(/[\\/]/).pop() ?? "";
  const limpo = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 100);
  if (limpo === "" || limpo.includes("..")) throw new ChaveInvalida("nome invalido");
  return limpo;
}

// `tenantId` vem da sessao/identidade ja verificada (nunca do corpo da requisicao).
export function construirChave({ tenantId, departamento, documentId, nome }) {
  if (!TENANT.test(tenantId)) throw new ChaveInvalida("tenant invalido");
  if (!DEPARTAMENTO.test(departamento)) throw new ChaveInvalida("departamento invalido");
  if (!UUID.test(documentId)) throw new ChaveInvalida("document_id invalido");
  return `tenants/${tenantId}/${departamento}/${documentId}/${nomeSeguro(nome)}`;
}

// Valida uma chave ja existente (ex.: lida do banco) contra o tenant autenticado.
export function validarChaveDoTenant(tenantId, chave) {
  if (!TENANT.test(tenantId)) throw new ChaveInvalida("tenant invalido");
  if (typeof chave !== "string" || /[\0\\]/.test(chave) || chave.startsWith("/")) {
    throw new ChaveInvalida("caracteres proibidos");
  }
  const partes = chave.split("/");
  if (partes.length !== 5 || partes.some((p) => p === "" || p === "." || p === "..")) {
    throw new ChaveInvalida("formato");
  }
  const [raiz, dono, dep, doc, nome] = partes;
  if (raiz !== "tenants" || dono !== tenantId) throw new ChaveInvalida("chave de outro tenant");
  if (!DEPARTAMENTO.test(dep) || !UUID.test(doc) || nomeSeguro(nome) !== nome) {
    throw new ChaveInvalida("segmento invalido");
  }
  return chave;
}

export function validarTtl(segundos) {
  if (!Number.isInteger(segundos) || segundos < 1 || segundos > TTL_MAXIMO_SEGUNDOS) {
    throw new ChaveInvalida(`ttl fora de 1..${TTL_MAXIMO_SEGUNDOS}`);
  }
  return segundos;
}

const ARN = (rec) => `arn:aws:s3:::${rec}`;

// Modelo P: bucket dedicado por tenant. Credencial so enxerga o proprio bucket.
export function politicaBucketDoTenant(bucket) {
  return {
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource: [ARN(`${bucket}/*`)] },
      { Effect: "Allow", Action: ["s3:ListBucket"], Resource: [ARN(bucket)] },
    ],
  };
}

// Modelo S/T: bucket compartilhado, escopo por prefixo. A barra final em `tenants/<id>/`
// evita a confusao de prefixo (tenant `a` x tenant `ab`).
export function politicaPrefixoDoTenant(bucket, tenantId) {
  if (!TENANT.test(tenantId)) throw new ChaveInvalida("tenant invalido");
  const prefixo = `tenants/${tenantId}/`;
  return {
    Version: "2012-10-17",
    Statement: [
      { Effect: "Allow", Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], Resource: [ARN(`${bucket}/${prefixo}*`)] },
      {
        Effect: "Allow",
        Action: ["s3:ListBucket"],
        Resource: [ARN(bucket)],
        Condition: { StringLike: { "s3:prefix": [`${prefixo}*`] } },
      },
    ],
  };
}
