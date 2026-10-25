# PoC DEC-004 — identidade de serviço do runtime (descartável)

Runtime falso, Control Plane falso e validadores locais. Sem rede, sem banco, sem segredos reais, sem dependência de produção. **Não faz parte do workspace pnpm**; pode ser apagado a qualquer momento.

- Ambiente: Node 24.22.1 (`~/.local/opt/node-v24.22.1-linux-x64`), `node:crypto` (Ed25519). Dependências de desenvolvimento (somente validação dos esquemas): `ajv` 8.17.1 e `ajv-formats` 3.0.1, travadas em `package-lock.json` (instaladas com `npm install` do registro npm).
- JWT implementado à mão de propósito, para tornar o formato visível. **Não usar em produção.**

```bash
export PATH="$HOME/.local/opt/node-v24.22.1-linux-x64/bin:$PATH"
cd documentacoes/arquitetura/poc/dec-004
npm ci            # reproduz as dependências do lock file
npm test          # 17 testes (casos negativos, rotação, revogação)
npm run demo      # narrativa: negativos, rotação, revogação de emergência
npm run bench     # latência da validação local
```

Saídas registradas em `saida/` (`test.txt`, `demo.txt`, `bench.txt`). Esquemas validados: [../../contratos-propostos/](../../contratos-propostos/). Decisão: [ADR-018](../../adr/0018-identidade-de-servico-runtime-control-plane-gateways.md).

Estrutura: `lib/jwt.mjs` (Ed25519/JWT), `lib/control-plane.mjs` (enrollment, emissão, JWKS, rotação, revogação), `lib/validator.mjs` (validação local), `lib/fake-runtime.mjs`, `lib/schemas.mjs` (ajv), `lib/env.mjs` (cenário), `test/poc.test.mjs`.
