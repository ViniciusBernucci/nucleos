# Núcleos

Monorepositório do MVP: painel Next.js, API NestJS organizada por domínio e gateway
Python para o CFO consultivo. O PostgreSQL é único, com schemas por assunto.

## Estrutura

| Pasta | Responsabilidade |
| --- | --- |
| `apps/web/` | Interface Next.js e chamadas à API pelo servidor |
| `apps/api/` | Negócio, integrações, tarefas duráveis e migrations |
| `services/ai-gateway/` | CFO, provedor de IA e limites de execução/custo |
| `packages/` | Contratos, SDK, configuração e observabilidade compartilhados |
| `infrastructure/docker/` | Compose local e configurações de deploy |
| `scripts/` | Desenvolvimento, verificações e CI |
| `tools/` | Fixtures de qualidade e Contexto legado opcional |
| `documentacoes/` | Decisões, operação, planos e registros de entrega |
| `lessons/` | Material didático da stack |
| `skills/skills/` | Fonte das skills; cópias de descoberta nos diretórios dos agentes |

Consulte o [mapa da arquitetura atual](documentacoes/arquitetura/README.md) e o
[índice da documentação](documentacoes/README.md). A
[Especificação Mestra](Nucleos-Especificacao-Mestra.md) preserva o histórico de produto;
a stack vigente é TypeScript/Python, conforme os ADRs e o código atual.

## Desenvolvimento

Versões em [.nvmrc](.nvmrc), [package.json](package.json),
[.python-version](.python-version) e [pyproject.toml](pyproject.toml).

```sh
make setup
cp .env.example .env
npm run dev
```

Preencha as variáveis necessárias em `.env`. API e Next.js carregam esse arquivo;
variáveis exportadas têm precedência. Web: `127.0.0.1:3000`; API: `127.0.0.1:3001`.
O comando `dev` inicia esses dois processos. O gateway de IA, quando necessário,
roda separadamente com suas variáveis exportadas:

```sh
uv run --frozen --package nucleos-ai-gateway python -m ai_gateway
```

O gateway usa `127.0.0.1:8002`. Sem credenciais, o CFO fica indisponível.
O banco Docker existente usa `127.0.0.1:15432`; a limpeza não altera seus dados.
`DATABASE_URL` não deve embutir senha. Hotmart sem credenciais fica desativada;
credenciais incompletas ou fontes de segredo conflitantes impedem a subida.
Chaves internas ficam somente no servidor, nunca em `NEXT_PUBLIC_*`.
Veja [.env.example](.env.example), [banco único](documentacoes/dados/banco-unico-nucleos.md)
e [gestão de segredos](documentacoes/arquitetura/adr/0020-gestao-de-segredos-do-mvp.md).

## Verificação e ferramentas

`make lint`, `make test`, `make build` e `make contracts-check` são os comandos comuns.
Pré-requisitos e ambientes permitidos estão no
[guia de validação](documentacoes/engenharia/comandos-validacao-ia.md).
Testes visuais são manuais. Convenções e hooks:
[guia de engenharia](documentacoes/engenharia/convencoes-commits-e-branches.md).

Regras de IA: [AGENTS.md](AGENTS.md). As seis skills são descobertas em
`.claude/skills/`, `.agents/skills/` e `.agent/skills/`; veja [skills/README.md](skills/README.md).
Edite a fonte e sincronize com `node scripts/instalar-skills.mjs --apply`;
confira com `node scripts/instalar-skills.mjs --check`.
O [Contexto Node legado](documentacoes/engenharia/contexto-node-legado.md) é opcional,
somente por solicitação explícita. Não integra a inicialização do produto.
