# Limpeza e simplificação do monorepo do MVP

- Data: 2026-11-06, America/Sao_Paulo.
- Domínio: transversal; solicitação de limpeza/refatoração com a skill arquiteto-de-software.
- Branch: `developer`; HEAD inicial: `8fd672f1c2a9053bc74ac71d841f3329802e9376`.
- Base própria: árvore de trabalho no início desta sessão, não apenas HEAD.
- Autor: Codex; sessão `codex-limpeza-mvp-2026-11-06`; etapa: revisão arquitetural e limpeza autorizada.
- Estado: implementação local concluída; checks e limitações descritos abaixo; sem aceite visual ou de produção.

## Objetivo, evidências e escopo

Reduzir scaffolding sem negócio e tornar a estrutura do monorepo compreensível para
o MVP. A árvore inicial já tinha 809 alterações da instalação anterior de skills;
elas foram preservadas e não são atribuídas a esta entrega. Snapshots dos arquivos
tocados foram guardados em `.run/limpeza-mvp/antes/`, com metadados em `base.json`.
Não houve commit, troca de branch, push, PR, alteração de banco ou migração.

API NestJS, web Next.js e gateway CFO Python têm comportamento implementado.
Provisioner, tenant-runtime, tool-gateway e event-dispatcher só ofereciam probes e
telemetria; os consumidores observados não usavam suas portas para negócio.
As regras de tarefas, fila durável e ferramentas financeiras já estavam na API/gateway.

Foram retirados esses quatro esboços e referências em workspace/lockfiles, Compose,
launcher, CODEOWNERS e checks. Saíram as reservas Terraform/Ansible/Kubernetes,
modelos antigos de regras de IA, dois `.DS_Store` e o `.gitkeep` redundante de lessons.
Contratos, gerados, SDK, migrations, PoCs, históricos e integrações existentes foram
preservados por terem consumidores ou valor de rastreabilidade.

## Decisões e mudanças

O [mapa atual](../arquitetura/README.md) descreve a API como monólito modular dentro
do monorepo. O [ADR-027](../arquitetura/adr/0027-monorepo-enxuto-para-o-mvp-local.md)
explicita o conflito com a árvore futura do baseline e propõe sua revisão.
A retirada de esboços locais foi autorizada pelo pedido; a IA não aceitou em nome
do usuário uma nova política de isolamento/produção.

Mantiveram-se módulos por domínio, stack aprovada, banco único por schemas e pacotes
compartilhados. Não foram criadas abstrações, serviços ou dependências novas.
As regras Python agora impedem pacotes de importar serviços consumidores e contratos
de depender de outros pacotes internos; as fixtures foram ajustadas na mesma entrega.

O instalador opcional de Contexto e sua configuração foram movidos de `scripts/`
para `tools/contexto-legado/`, preservando a integração externa e corrigindo a lista
de fontes do monorepo. O guia histórico acompanha os novos caminhos. Nada foi
instalado, indexado ou alterado na configuração global dos agentes por esse instalador.

A skill de arquitetura já existia nas três cópias de descoberta, mas faltava na
fonte. Seus dois arquivos foram incorporados à fonte sem alteração de conteúdo;
as seis skills agora passam na sincronização. Referências `_shared/` dessa skill
não vieram na distribuição existente: helpers/runtime ausentes não foram inventados
nem executados. O roteiro local e as regras do projeto orientaram a análise.
Registro de início/fim e identidade nesta entrega substitui apenas o registro textual
disponível; não se declara uso de helpers ausentes nem métricas de tokens (desconhecidas).

Corrigiram-se as aspas dos globs do Prettier: antes, parte dos arquivos podia não ser
verificada. Aplicou-se o estilo já configurado, principalmente finais de linha e
quebras, sem refatorar lógica. ESLint passou a ignorar caches Python e `.venv`.
Dois asserts existentes de geração de contratos agora normalizam separadores de
caminho para verificar os mesmos casos no Windows e Linux.
O build do Next.js atualizou automaticamente `apps/web/next-env.d.ts` para os tipos
de rotas de `.next/types/`; essa mudança gerada foi incluída no escopo próprio.

## Verificações reais

| Comando / ambiente | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile --offline --ignore-scripts`; `uv sync --frozen --all-packages --offline` | Dependências preparadas com lockfiles; membros removidos sem atualização de versões |
| `pnpm run build` | Seis unidades TypeScript/Next.js passaram |
| `uv build --all-packages --out-dir .run/py-dist` | Quatro pacotes Python, wheel e sdist, construídos |
| `pnpm run lint` | Typecheck das seis unidades passou (nove tarefas com builds de dependências) |
| `pnpm run lint:quality` | Passou: ESLint sem erros (91 warnings existentes), dependency-cruiser sem violações e Prettier aprovado |
| `pnpm exec turbo run test --filter=!@nucleos/config --continue=always` | 11 tarefas passaram; 355 testes: API 102, web 33, observability 14, SDK 5 e contratos 201 |
| `node --test packages/contracts/scripts/gerar.test.mjs` | Cinco testes de geração/drift passaram após corrigir separadores |
| Configuração TS em container Linux, Node 24.22.1, rede desativada | 25 testes passaram; no Windows seis testes POSIX falham |
| Python em container descartável Linux, Python 3.13 e Node 24.22.1 | 392 testes passaram; mypy e dois contratos import-linter passaram |
| `uv run --frozen ruff check services packages/contracts-py packages/config-py` e `ruff format --check` nos mesmos caminhos | Passaram nos alvos configurados e configuração compartilhada |
| Fixtures negativas import-linter | Ambas rejeitadas, exit 1 e nomes das duas regras `BROKEN` conferidos |
| `node packages/contracts/scripts/gerar.mjs --check`; `node packages/contracts/scripts/compat.mjs` | Sem drift; 11 contratos compatíveis com baseline |
| Compose dev renderizado com valores fictícios e env-file vazio | Web/API/gateway presentes e quatro esboços ausentes; nenhum serviço iniciado |
| `node infrastructure/docker/scripts/verificar-deploy.mjs` | Overlays staging/prod mantêm hardening, digest e ausência de segredo literal |
| `bash -n` nos launchers/smoke/instalador movido | Sintaxe válida |
| `node scripts/instalar-skills.mjs --apply` e `--check` | Seis skills, 13 arquivos por destino, zero divergências e extras |
| `bash scripts/check-no-env.sh` | Nenhum `.env` versionado; arquivo ignorado |
| `git diff --check` no escopo próprio | Passou, sem problemas de whitespace |

As primeiras tentativas Python no Windows tiveram problemas com diretório temporário
e oito falhas por APIs/permissões POSIX; mypy nativo também acusa quatro atributos
POSIX inexistentes. A suíte Linux usou snapshot de fontes sem `.env`, sem banco,
containers descartáveis e nenhum acesso a APIs externas de negócio. A instalação
de dependências nesse ambiente usou as versões travadas. O primeiro container Python
não tinha Node para um teste de paridade; o ensaio final incluiu Node e passou.

Não se executaram testes PostgreSQL reais (`TEST_DATABASE_URL` removida dos processos
de teste), smoke contra o banco dev, subida completa do produto ou QA visual.
`check-secrets.sh` foi tentado e não rodou a varredura: gitleaks não está no PATH.
O runner global `lint-regressao` depende dessa ferramenta e não foi executado;
as fixtures arquiteturais alteradas foram verificadas diretamente.
Uma sondagem ampliada de Ruff em **todos** os packages encontrou 60 problemas
preexistentes em `observability-py`, fora dos alvos Ruff atuais do Makefile; esses
arquivos Python não foram alterados e o lint ampliado não é declarado aprovado.

## Impactos, riscos e rollback

Os launchers locais passam de sete para três componentes e deixam de usar portas
3002, 8001, 8003 e 8004. Nenhuma fronteira de segurança realmente implementada foi
substituída; oferecer isolamento multi-tenant continua exigindo os ADRs e gates.
Os auxiliares Redis/MinIO e overlays existentes permanecem por suportar código/testes.

Reverter somente o [patch próprio](2026-11-06-limpeza-monorepo-mvp-diffs.md), ou usar os
snapshots locais, e restaurar os importers dos lockfiles. Não usar reset/restore
global: perderia a instalação anterior das skills e outros trabalhos preexistentes.
Reinstalar com lockfiles congelados após restaurar os componentes removidos.

A remoção da árvore vazia `Dev/nucleos/.run/bin` foi rejeitada pela revisão automática
com “blocked by policy”. A árvore foi preservada; não participa do build.
Gitleaks indisponível, avisos ESLint, dívida Ruff ampliada, aceite visual manual e
aceitação humana do ADR para produção são limitações/pendências declaradas.

## Commits, diffs e lessons

O fechamento técnico original foi entregue sem commits. Após autorização explícita,
o commit `9cff55f7cea352186f73872e38550353dd90f4bd` reuniu a limpeza do MVP. As mudanças de
distribuição das skills foram agrupadas no commit anterior, como explicado no
[registro de publicação](2026-11-06-publicacao-developer.md).
O [patch completo próprio](2026-11-06-limpeza-monorepo-mvp-diffs.md) representa o commit
do MVP e exclui a escrita de `documentacoes/` e `lessons/` para evitar recursão.
As exclusões binárias aparecem sem conteúdo exposto. Os snapshots da sessão
continuam locais em `.run/limpeza-mvp/antes/` para rastreabilidade.

A [lesson 22](../../lessons/22%20-%20Monorepo%20e%20monolito%20modular%20no%20MVP.md)
explica monorepo, monólito modular e critérios de separação; a
[lesson 02](../../lessons/02%20-%20Qualidade%20estatica%20em%20TypeScript%20e%20Python.md)
foi alinhada às fronteiras Python atuais. O índice de lessons e os índices de docs/ADRs
foram atualizados. A lista de arquivos próprios acompanha o patch.

O gitleaks inicialmente ausente foi instalado com checksum conferido para a
publicação: histórico pendente e os dois commits staged sem achados. As limitações
anteriores acima descrevem o fechamento técnico; veja a verificação posterior no
[registro de publicação](2026-11-06-publicacao-developer.md).
