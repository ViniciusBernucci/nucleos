# Skills para Codex, Claude e Antigravity

A fonte canônica otimizada permanece em `skills/`. As pastas abaixo
contêm cópias completas e idênticas, incluindo `_shared`, referências, scripts e
metadados existentes.

| Agente | Pasta de descoberta no projeto |
| --- | --- |
| Codex | `.agents/skills/` |
| Claude Code | `.claude/skills/` |
| Antigravity (App, CLI e IDE) | `.agents/skills/` |
| Antigravity (compatibilidade legada) | `.agent/skills/` |

Abra este repositório como projeto no agente desejado. Para usar em outro projeto,
copie a pasta de descoberta correspondente para a raiz dele, preservando `_shared`
e os demais recursos. Codex e Antigravity compartilham a mesma pasta padrão.

## Sincronização

Mantenha as skills em `skills/`. Depois de uma alteração futura, atualize as
cópias com Node.js 18 ou superior:

```sh
node scripts/sincronizar-skills.mjs --check
node scripts/sincronizar-skills.mjs --apply
node scripts/sincronizar-skills.mjs --check
```

`--check` compara os bytes de todos os arquivos e retorna código 1 se encontrar
arquivos ausentes, diferentes ou extras. `--apply` copia os arquivos da fonte,
substituindo cópias diferentes; arquivos extras são apontados e preservados.
O script preserva configurações globais e outros projetos. O único espelho gerado dentro de `skills/` é `_shared/observatory/token_observatory.py`, a partir do fonte canônico `observatory/payload/runtime/token_observatory.py`; os demais arquivos em `skills/` são a fonte das cópias.

A organização prepara a descoberta das skills. Ferramentas, integrações e
permissões exigidas pelos fluxos continuam dependendo do ambiente de cada agente.
Os entrypoints antigos de sincronização delegam ao mesmo script. Execute --check
antes de --apply; o apply exige diagnóstico da fonte atual. Dados .contexto não são copiados.

Padrões consultados: [Codex](https://developers.openai.com/blog/skills-agents-sdk),
[Claude Code](https://code.claude.com/docs/en/skills) e
[Antigravity](https://antigravity.google/docs/skills).

## Modelos mínimos de regras por projeto

Use [modelos/CLAUDE.md](modelos/CLAUDE.md) e [modelos/AGENTS.md](modelos/AGENTS.md)
como blocos para incorporar às regras de outro projeto. Se o arquivo já existir,
acrescente o conteúdo sem substituir as regras atuais. Os modelos contêm o mesmo
contrato essencial e ficam separados para não alterar as regras ativas desta distribuição.

Veja [como usar e o que configurar por projeto](modelos/README.md). A instalação das
skills continua igual; os modelos não instalam o Contexto nem ferramentas externas.


## Fluxo V2 integrado

O Contexto agora acompanha `_shared/contexto`, sem instalação de MCP/npm. Requer Node.js >=22.13 e Git no host. O agente prepara o SQLite local automaticamente, e o runtime controla estados/rodadas enquanto o cliente chama agentes independentes. Veja [como aplicar e usar](docs/fluxo-v2.md) e [o protocolo](skills/_shared/protocolo-v2.md).

## Otimização de contexto e QA por risco

Novos planos declaram risk_level R0–R4. QA separado é obrigatório em R3/R4; R0–R2 exigem testes aplicáveis, aceite e review independente, acionando QA condicional para riscos sem cobertura. Dispensa por política é COBERTO_NO_REVIEW, sem fabricar QA PASS. Tarefas históricas preservam seus gates até classificação explícita. Veja [política e diagnóstico](docs/otimizacao-contexto.md).

Todas as skills têm instruções de registro de atividade e handoffs compactos com checkpoints SQLite. Erros do Contexto geram logs saneados com recuperação; timeout Git é configurável, sem retry cego de mutações. O [Observatório](skills/token-observatory/SKILL.md) acompanha a distribuição e o kit instalável em `observatory/`; registra processos, qualidade e contadores nativos sem APIs pagas. Contagens e atribuições ausentes continuam desconhecidas.
