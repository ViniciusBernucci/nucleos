# 00 - Sessao opaca e revogacao

Criada em 2026-10-25. Ultima atualizacao: 2026-10-25. Exemplos testados com Node 24.22.1 (TypeScript executado por remocao de tipos nativa); sem Python.

## Objetivo, pre-requisitos e posicao

Entender por que o projeto propoe sessoes opacas validadas no banco a cada requisicao (ADR-016, status Proposto) e como isso torna a revogacao imediata. Pre-requisitos: TypeScript basico e HTTP. Posicao: primeira lesson da trilha de seguranca (bloco 7 do indice); as lessons de TypeScript e PostgreSQL ainda serao criadas antes dela na ordenacao final.

## Modelo mental

- **Token opaco**: bytes aleatorios sem significado. Quem o apresenta so prova que o conhece; o servidor decide tudo consultando o banco.
- **JWT autocontido**: carrega seus dados e vale ate expirar; revogar exige lista de bloqueio ou espera.
- No banco guarda-se apenas o `sha256` do token: um vazamento do banco nao entrega sessoes validas.
- Revogar = marcar `revoked_at`. Como cada requisicao consulta o banco, a proxima falha.
- O tenant nunca vem do cliente: e resolvido por `memberships` no banco central.

## Exemplo minimo (executavel)

```ts
import { createHash, randomBytes } from 'node:crypto';

type Session = { userId: string; expiresAt: number; revokedAt: number | null };
const store = new Map<string, Session>(); // simula a tabela sessions (chave = sha256)

const sha = (t: string): string => createHash('sha256').update(t).digest('hex');

function login(userId: string): string {
  const token = randomBytes(32).toString('base64url');
  store.set(sha(token), { userId, expiresAt: Date.now() + 3_600_000, revokedAt: null });
  return token;
}
function authenticate(token: string): string | null {
  const s = store.get(sha(token));
  return s && s.revokedAt === null && s.expiresAt > Date.now() ? s.userId : null;
}
function revoke(token: string): void {
  const s = store.get(sha(token));
  if (s) s.revokedAt = Date.now();
}

const t = login('u1');
console.log(authenticate(t)); // 'u1'
revoke(t);
console.log(authenticate(t)); // null: a requisicao seguinte falha
```

## Do minimo ao padrao do projeto

O PoC [`server.mjs`](../documentacoes/arquitetura/poc/dec-002/server.mjs) troca o `Map` por PostgreSQL, adiciona senha `argon2id`, TOTP, seed cifrada (AES-256-GCM) e a regra de membership. A decisao e a evidencia estao na [entrega](../documentacoes/identidade/2026-10-25-dec-002-autenticacao-adr-016.md) e no [ADR-016](../documentacoes/arquitetura/adr/0016-autenticacao-de-usuarios-sessao-opaca-propria-vs-idp.md). Codigo do PoC e descartavel.

## Erros comuns e trade-offs

- Gravar o token em claro no banco.
- Cachear a validacao por tempo longo: reintroduz o atraso de revogacao.
- Confiar em `X-Tenant-Id` sem verificar membership.
- Comparar codigos TOTP sem tempo constante.
- Nao se aplica bem quando ha muitos servicos que precisam validar sem acesso ao banco (tokens assinados de curta duracao, ver DEC-004) ou quando SSO corporativo e exigido (revisar o ADR).
- Custo: uma consulta por requisicao.

## Verificacao e exercicios

Rodar `documentacoes/arquitetura/poc/dec-002/run.sh` (Docker, `127.0.0.1`) e conferir 13/13 PASS. Exercicios: (1) acrescente `revokeAllFor(userId)` ao exemplo; (2) explique por que sha256 simples e aceitavel para token aleatorio de 256 bits mas nao para senha; (3) o que muda se a validacao for cacheada por 60 s?
