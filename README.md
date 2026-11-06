# Núcleos

Especificação e documentação do projeto: [Nucleos-Especificacao-Mestra.md](Nucleos-Especificacao-Mestra.md)
e [documentacoes/](documentacoes/). Regras para agentes de IA: [AGENTS.md](AGENTS.md) e [CLAUDE.md](CLAUDE.md).

## Convencoes de engenharia

Lint, formatacao, hooks, commits e branches: [documentacoes/engenharia/convencoes-commits-e-branches.md](documentacoes/engenharia/convencoes-commits-e-branches.md). Comandos: `make lint`, `make format`, `make hooks`.

## Skills de IA (Claude Code, Codex e Antigravity)

As skills do fluxo de desenvolvimento (planejamento, implementação, review, QA e
fechamento) já estão instaladas no repositório. Basta abrir o projeto no agente:

| Agente | Onde as skills ficam | Regras que o agente lê |
| --- | --- | --- |
| Claude Code | `.claude/skills/` | `CLAUDE.md` |
| Codex | `.agents/skills/` | `AGENTS.md` |
| Antigravity | `.agents/skills/` (e `.agent/skills/`, legado) | `.agents/rules/project-instructions.md` (regra Always On) |

A fonte das skills é `skills/skills/`; as pastas acima são cópias. Para alterar uma
skill, edite só a fonte e atualize as cópias:

```bash
node scripts/instalar-skills.mjs --apply
node scripts/instalar-skills.mjs --check
```

O `--check` deve terminar com `0 divergências`. A skill `archify`, instalada por outra
fonte em `.agents/skills/`, é preservada. As regras de uso e os fatos do projeto estão na
seção "Configuracao do fluxo de skills neste projeto" do `CLAUDE.md`, do `AGENTS.md` e da
regra do Antigravity.

No Claude Code, `/simplify` também é o nome de uma skill embutida. Para usar a do projeto,
peça pelo nome e descrição ("use a skill simplify do projeto").

## Ferramentas de IA e contexto

Regras canônicas: [AGENTS.md](AGENTS.md). Não executar indexação/preparação Node
no início da sessão. Para uso antigo explicitamente solicitado, consulte
[Contexto Node legado](documentacoes/engenharia/contexto-node-legado.md).
Não copie o bloco antigo de indexação para CLAUDE.md ou AGENTS.md.

## Configuracao do MVP com .env

Copie [.env.example](.env.example) para `.env` na raiz e preencha `DATABASE_PASSWORD`,
`HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET` e `VENDAS_API_KEY`. A API e o servidor
Next.js carregam esse arquivo; variaveis ja exportadas tem precedencia. Reinicie os processos
apos editar. A URL do banco fica em `DATABASE_URL`, sem senha embutida. No desenvolvimento
fora do Docker, o Postgres do Compose fica em `127.0.0.1:15432`; use a senha ja criada
em `infrastructure/docker/.env.local`. O preenchimento do .env nao modifica o banco.

Hotmart sem as duas credenciais fica desativada; uma credencial isolada e erro. A chave de
vendas deve ser a mesma no servidor web e na API, nunca `NEXT_PUBLIC_*` nem `nextConfig.env`.
`*_FILE` permanece opcional; configurar as duas fontes para a mesma credencial e erro.
Os overlays endurecidos de staging/producao continuam com transporte por arquivo.
Em Docker dev, sobrescreva `DATABASE_URL` com o host interno `postgres:5432` e
`VENDAS_API_URL` com `http://api:3001` (o .env de execucao no host usa loopback).

O .env real e ignorado pelo Git e pelo build Docker. Nao publique seus valores em logs,
capturas de ambiente ou `docker inspect`: o ambiente pode ser lido por administradores.
Veja a [decisao atual](documentacoes/arquitetura/adr/0020-gestao-de-segredos-do-mvp.md)
e o [registro da mudanca](documentacoes/transversal/2026-11-01-configuracao-env-mvp.md).

O painel de vendas oferece **Atualizar agora**: dispara uma sincronizacao imediata e
recarrega os dados ao concluir. HOTMART_CLIENT_TOKEN aceita o token Basic fornecido pela
Hotmart (preferencialmente sem o prefixo Basic); se ausente, mantem a derivacao anterior.
As URLs externas continuam no cliente da integracao. VENDAS_API_URL aponta apenas para
a API interna do NUCLEOS. Veja a [entrega](documentacoes/financeiro/2026-11-01-atualizacao-manual-hotmart.md).
