// Cliente S3 minimo (AWS Signature V4) sem dependencias, so para o PoC DEC-009.
// Suporta PUT/GET/DELETE/HEAD/LIST, URL pre-assinada, credencial temporaria (session token)
// e o STS AssumeRole do MinIO. Nao e codigo de producao: producao usa SDK mantido.
import { createHash, createHmac } from "node:crypto";
import { validarTtl } from "./politica.mjs";

const sha256 = (dados) => createHash("sha256").update(dados).digest("hex");
const hmac = (chave, dados) => createHmac("sha256", chave).update(dados).digest();
const enc = (s) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encCaminho = (p) => p.split("/").map(enc).join("/");

function stamp(agora = new Date()) {
  const amz = agora.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz, dia: amz.slice(0, 8) };
}

function chaveAssinatura(secret, dia, regiao, servico) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, dia), regiao), servico), "aws4_request");
}

function consultaCanonica(params) {
  return Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
}

export class S3 {
  constructor({ endpoint, accessKey, secretKey, sessionToken, regiao = "us-east-1" }) {
    this.url = new URL(endpoint);
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.sessionToken = sessionToken;
    this.regiao = regiao;
  }

  // Assinatura por cabecalhos (Authorization). `anonimo` envia sem assinar (caso negativo).
  async pedido(metodo, caminho, { consulta = {}, corpo, anonimo = false, servico = "s3", cabecalhos = {} } = {}) {
    const dados = corpo === undefined ? "" : corpo;
    const { amz, dia } = stamp();
    const hash = sha256(dados);
    const h = { host: this.url.host, "x-amz-content-sha256": hash, "x-amz-date": amz, ...cabecalhos };
    if (this.sessionToken) h["x-amz-security-token"] = this.sessionToken;
    const nomes = Object.keys(h).map((k) => k.toLowerCase()).sort();
    const canonCab = nomes.map((k) => `${k}:${String(h[Object.keys(h).find((x) => x.toLowerCase() === k)]).trim()}\n`).join("");
    const assinados = nomes.join(";");
    const canon = [metodo, encCaminho(caminho), consultaCanonica(consulta), canonCab, assinados, hash].join("\n");
    const escopo = `${dia}/${this.regiao}/${servico}/aws4_request`;
    const aAssinar = ["AWS4-HMAC-SHA256", amz, escopo, sha256(canon)].join("\n");
    const assinatura = createHmac("sha256", chaveAssinatura(this.secretKey, dia, this.regiao, servico))
      .update(aAssinar)
      .digest("hex");
    const cab = { ...h };
    delete cab.host;
    if (!anonimo) {
      cab.authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${escopo}, SignedHeaders=${assinados}, Signature=${assinatura}`;
    }
    const q = consultaCanonica(consulta);
    const alvo = `${this.url.origin}${encCaminho(caminho)}${q ? `?${q}` : ""}`;
    return resposta(await fetch(alvo, { method: metodo, headers: cab, body: dados === "" ? undefined : dados }));
  }

  put(bucket, chave, corpo) {
    return this.pedido("PUT", `/${bucket}/${chave}`, { corpo });
  }
  get(bucket, chave) {
    return this.pedido("GET", `/${bucket}/${chave}`);
  }
  head(bucket, chave) {
    return this.pedido("HEAD", `/${bucket}/${chave}`);
  }
  del(bucket, chave, versionId, cabecalhos = {}) {
    const consulta = versionId ? { versionId } : {};
    return this.pedido("DELETE", `/${bucket}/${chave}`, { consulta, cabecalhos });
  }
  list(bucket, prefixo = "") {
    return this.pedido("GET", `/${bucket}`, { consulta: { "list-type": "2", prefix: prefixo } });
  }
  listarBuckets() {
    return this.pedido("GET", "/");
  }

  // URL pre-assinada (query string). Retorna a URL completa.
  presign(metodo, bucket, chave, expiraSegundos, agora = new Date()) {
    validarTtl(expiraSegundos); // politica do servidor (ADR-023): recusa antes de assinar
    const { amz, dia } = stamp(agora);
    const escopo = `${dia}/${this.regiao}/s3/aws4_request`;
    const consulta = {
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.accessKey}/${escopo}`,
      "X-Amz-Date": amz,
      "X-Amz-Expires": String(expiraSegundos),
      "X-Amz-SignedHeaders": "host",
    };
    if (this.sessionToken) consulta["X-Amz-Security-Token"] = this.sessionToken;
    const caminho = `/${bucket}/${chave}`;
    const canon = [metodo, encCaminho(caminho), consultaCanonica(consulta), `host:${this.url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
    const aAssinar = ["AWS4-HMAC-SHA256", amz, escopo, sha256(canon)].join("\n");
    const assinatura = createHmac("sha256", chaveAssinatura(this.secretKey, dia, this.regiao, "s3"))
      .update(aAssinar)
      .digest("hex");
    return `${this.url.origin}${encCaminho(caminho)}?${consultaCanonica(consulta)}&X-Amz-Signature=${assinatura}`;
  }

  // MinIO STS AssumeRole com politica de sessao (reduz, nunca amplia, as permissoes do chamador).
  async assumirPapel(politicaSessao, duracaoSegundos = 900) {
    const corpo = new URLSearchParams({
      Action: "AssumeRole",
      Version: "2011-06-15",
      DurationSeconds: String(duracaoSegundos),
      Policy: JSON.stringify(politicaSessao),
    }).toString();
    const r = await this.pedido("POST", "/", {
      corpo,
      servico: "sts",
      cabecalhos: { "content-type": "application/x-www-form-urlencoded" },
    });
    if (r.status !== 200) return { erro: r };
    const tag = (n) => new RegExp(`<${n}>([^<]+)</${n}>`).exec(r.texto)?.[1];
    return new S3({
      endpoint: this.url.origin,
      accessKey: tag("AccessKeyId"),
      secretKey: tag("SecretAccessKey"),
      sessionToken: tag("SessionToken"),
      regiao: this.regiao,
    });
  }
}

export async function pegarUrl(url, metodo = "GET", corpo) {
  return resposta(await fetch(url, { method: metodo, body: corpo }));
}

async function resposta(r) {
  const texto = await r.text();
  const codigo = /<Code>([^<]+)<\/Code>/.exec(texto)?.[1] ?? null;
  return { status: r.status, texto, codigo, cab: Object.fromEntries(r.headers) };
}
