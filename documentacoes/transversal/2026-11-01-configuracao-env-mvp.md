# Configuracao tradicional do MVP com .env

Data: 2026-11-01 (America/Sao_Paulo). Dominio: transversal.
Solicitacao: permitir segredos no .env, revisar a documentacao e preparar banco/Hotmart.
Branch: `developer`. Autor: Codex, sob solicitacao do usuario.
HEAD inicial: `8129a391f0f88f6d77704eb41b7cd89a2fc19379`.
Merge-base com `origin/main`: `54a9aa78812e7772493b9fa5721a2e0a268bfb33`.
Estado: implementado; validacoes e limitacoes abaixo. Nenhum commit criado nesta tarefa.

## Contexto e escopo

A exclusividade de segredos por arquivo dificultava o MVP. O usuario autorizou explicitamente
o uso tradicional de .env e a aplicacao diretamente em developer. A arvore inicial estava suja:
alteracoes de vendas em API, web, contratos, config, lockfile e documentacao foram preservadas.
O patch desta tarefa usa o snapshot de entrada, nao atribui o diff anterior a esta entrega.

Incluido: banco, Hotmart, chave privada de vendas, carregamento do .env na API/web,
compatibilidade opcional com arquivos e paridade de validacao Python.
Fora de escopo: publicar deploy, alterar banco, acessar Hotmart real, alterar broker ou
isolamento de tenants e migrar os overlays endurecidos de staging/producao para ambiente.

## Implementacao e arquivos

- `packages/config/src/load.ts`: remove bloqueio global de nomes de segredos; carrega .env
  da raiz via Node, preserva ambiente exportado, converte falha de leitura em erro sem valores;
  resolve segredo direto ou arquivo, rejeita duplicidade e limita tamanho a 16 KiB.
- `packages/config/src/api.ts`: aceita DATABASE_PASSWORD, mantem *_FILE e valida banco/senha
  em staging/production; o resultado continua usando Secret.
- `packages/config/src/vendas.ts`: aceita HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET e
  VENDAS_API_KEY; exige o par Hotmart e mantem sincronizacao desativada quando ausente.
- `packages/config/src/secret.ts`: documenta as duas origens de Secret.
- `packages/config/src/config.test.ts`, `vendas.test.ts` e `paridade-casos.json`: regressao
  de ambiente, redacao, limites, conflito, dotenv e precedencia.
- `packages/config-py/src/nucleos_config/settings.py`, `secret.py` e `tests/test_config.py`:
  senha direta com SecretStr/Secret, sem bloquear outros nomes no ambiente. Continua recebendo
  mapa explicito; nao procura .env implicitamente em Python.
- `apps/web/next.config.mjs`: carrega .env da raiz apenas no processo servidor, sem publicar
  credenciais em nextConfig.env; `lib/vendas-api.ts` aceita VENDAS_API_KEY e arquivo opcional.
- `apps/web/app/vendas-env.test.ts`: teste de bearer, resposta sem segredo e conflito fechado.
- `apps/web/app/(app)/setores/financeiro/vendas/page.tsx`: instrucao de chave no .env.
- `apps/api/src/migrar.ts`: comentario atualizado sobre as fontes aceitas, sem mudar migracoes.
- `infrastructure/docker/tests/ambientes.test.mjs`: ajusta erro esperado de senha ausente e
  substitui cenario de segredo proibido pelo de fontes conflitantes.
- `.env.example` e `README.md`: instrucoes e variaveis sem valores reais.
- `.env` local, ignorado: preserva valores anteriores, prepara banco a partir da configuracao
  descartavel de Docker ja existente, gera chave privada de vendas e deixa credenciais
  Hotmart ausentes vazias. Nenhum valor real foi registrado neste documento ou patch.

Documentacao atualizada: ADR-020; ADR consolidado em
`documentacoes/transversal/2026-10-25-nucleos-enterprise-adr-arquitetura-mvp-e-evolucao.md`;
entrega FND-006 em `documentacoes/infraestrutura/`; runbook de deploy;
`infrastructure/docker/README.md`; entrega do painel em
`documentacoes/financeiro/2026-11-01-painel-de-vendas-hotmart.md`; este registro e seu patch.
Lessons: [12 - Configuracao tipada](../../lessons/12%20-%20Configuracao%20tipada%20com%20falha%20rapida.md),
[13 - Segredos por arquivo](../../lessons/13%20-%20Segredos%20por%20arquivo%20e%20verificacao%20de%20vazamento.md)
e [indice canonico](../../lessons/README.md), preservando a ordem existente.

## Decisoes, consequencias e operacao

O .env simplifica operacao e dispensa novos pacotes: Node possui loadEnvFile.
Variaveis exportadas ganham do .env. Valores vazios contam como ausentes.
Uma credencial pode vir do ambiente ou de arquivo; duas fontes falham para evitar escolher
uma senha silenciosamente. DATABASE_URL continua sem senha; DATABASE_PASSWORD e separada.
Arquivos existentes continuam sujeitos a dono, modo, tamanho e validacao de caminho.
As funcoes legadas de classificacao de nomes continuam exportadas por compatibilidade,
mas nao bloqueiam o carregamento. Nao ha alteracao de contrato HTTP ou migracao de banco.

Segredos de ambiente podem aparecer para administradores em inspect, dumps e processos filhos.
Secret protege serializacao do objeto, nao process.env. O .env permanece ignorado por Git e
Docker; nao usar NEXT_PUBLIC_* nem nextConfig.env para credenciais. O perfil endurecido de
deploy continua por arquivo e preserva a verificacao de ausencia no ambiente nesse perfil.
Atualizar .env nao modifica senha no Postgres. Em container use postgres:5432 e api:3001;
os valores locais preparados usam portas de loopback do host. Reinicie API/web apos editar.
Erros continuam listando nomes e motivos, sem valores ou caminhos sensiveis.

Rollback: remover valores diretos, configurar *_FILE e reiniciar consumidores. Para voltar a
politica anterior, reverter apenas o patch desta tarefa e sua revisao de ADR; nao reverter o
trabalho anterior do painel. Rotacao de credenciais exige atualizacao no destino.

## Validacao executada

- Build TypeScript e Next.js via `make build`: 7 tarefas passaram. O empacotamento Python
  foi bloqueado inicialmente pelo cache do sandbox; `uv build --all-packages --out-dir
  .run/py-dist` fora do sandbox concluiu todos os pacotes.
- `pnpm --filter @nucleos/config build`, `pnpm --filter @nucleos/api build` e
  `pnpm --filter @nucleos/web lint`: passaram.
- Testes de config em Linux descartavel, sem rede, com bundle de codigo/dependencias sem .env
  real: `node --test dist/config.test.js dist/vendas.test.js`, 19 passaram, incluindo dotenv.
  Os testes Windows da leitura por arquivo
  encontram restricoes POSIX ja existentes; nao se relaxaram essas garantias.
- `pnpm --filter @nucleos/web test`: 24 passaram, incluindo bearer por ambiente.
- `node --test apps/api/dist/banco.test.js 'apps/api/dist/vendas/*.test.js'`: 28 passaram.
- `python -m pytest packages/config-py/tests/test_config.py -q`: 23 passaram e 8 falharam
  por recursos Unix ausentes no Windows (O_NOFOLLOW, getuid/permissoes). Selecao sem esses
  cenarios: 21 passaram, 10 deselecionados. Nao foi executada suite Python em Linux.
- `ruff check packages/config-py`, `ruff format --check packages/config-py` e
  `mypy --platform linux packages/config-py/src`: passaram. Mypy com plataforma Windows
  reporta 4 referencias POSIX preexistentes no leitor de arquivo.
- ESLint dos arquivos TS alterados: sem erros, 14 warnings de seguranca (caminhos dinamicos).
  Prettier dos arquivos de configuracao/testes alterados: passou.
- `node infrastructure/docker/scripts/verificar-deploy.mjs`: passou.
- `make lint`: falhou no wrapper check-env por PATH com espacos no Windows; controles
  relevantes foram executados diretamente. `pnpm run lint` com .run/bin no PATH passou
  (10 tarefas). `pnpm exec depcruise apps packages --config .dependency-cruiser.cjs` passou
  (129 modulos, nenhuma violacao).
- Suite geral da API executada: falhou por artefatos antigos `dist/funcionarios` que
  importam contratos ausentes no estado atual. Nao foram apagados artefatos de outra tarefa.
- `make setup` nao repetido: dependencias existentes suficientes, nenhuma dependencia nova.
  Sem testes contra banco real, Hotmart real, deploy ou `make test-ambientes` completo.
- Carregamento do .env real validado sem conexoes: banco, senha e chave de vendas presentes;
  Hotmart ausente conforme os campos vazios. Valores nunca impressos.
- `git diff --check`: apontou apenas whitespace preexistente em CLAUDE.md:200-202,
  preservado por pertencer ao trabalho anterior. Links dos documentos desta entrega
  conferidos e .env confirmado como ignorado.

## Commits, diff e pendencias

Nenhum commit criado nesta tarefa. Nenhum diff staged desta tarefa.
[Patch unstaged exclusivo desta tarefa](2026-11-01-configuracao-env-mvp-diffs.md).

Pendencias reais: preencher HOTMART_CLIENT_ID e HOTMART_CLIENT_SECRET no .env local;
reexecutar a suite Python POSIX em Linux e resolver os bloqueios gerais de validacao acima
na frente responsavel. Nao houve conexao ao banco ou teste de sincronizacao real.

## Continuacao em 2026-11-01

O usuario informou ter preenchido as credenciais locais. O suporte ao Client Token e o
botao de atualizacao foram entregues na [continuacao](../financeiro/2026-11-01-atualizacao-manual-hotmart.md).
A pendencia de preenchimento acima corresponde ao encerramento original, antes dessa continuacao.
