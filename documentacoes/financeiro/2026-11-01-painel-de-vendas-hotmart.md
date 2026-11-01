# Painel de vendas Hotmart — 2026-11-01

## 1. Metadados

- **Domínio:** financeiro
- **Tarefa/solicitação:** primeira feature do projeto — painel de vendas dentro do setor Financeiro, com
  back end que baixa as vendas da API da Hotmart, atualização automática a cada 30 minutos e dashboard
  com os dados financeiros. Pedido em conversa (sem ticket).
- **Branch:** `developer`
- **Base / commit inicial:** `HEAD` `8129a391f0f88f6d77704eb41b7cd89a2fc19379`
  (`chore: scripts dev e start da raiz nao dependem do pnpm no PATH`). Merge-base com `origin/main`:
  `54a9aa78812e7772493b9fa5721a2e0a268bfb33`.
- **Estado da árvore no início:** alterações preexistentes e alheias a esta tarefa: `apps/web/next-env.d.ts`
  (modificado, gerado pelo Next.js) e `apps/web/AGENTS.md` (não rastreado, gerado pelo Next.js). Também
  aparece `documentacoes/backlog/00-BACKLOG MANUAL/` (não rastreado, não criado aqui). Nada disso foi alterado.
- **Estado da entrega:** pronta para revisão. Ainda **não validada contra a Hotmart real** (ver seção 7).
- **Autores conhecidos:** usuário (pedido e decisões); Claude Code (implementação).

## 2. Objetivo, contexto e escopo

- **Objetivo:** ver, no setor Financeiro, as vendas da Hotmart (receita, taxas, ticket médio, reembolsos,
  evolução diária, produtos e formas de pagamento), sempre atualizadas por uma rotina de 30 em 30 minutos.
- **Contexto:** o `apps/api` era só um esqueleto (`/healthz`), sem banco; o front estava reiniciado do zero
  e o setor Financeiro tinha uma página vazia. Não há login real implementado.
- **Escopo:**
  - API NestJS: cliente da Hotmart (OAuth2), sincronização idempotente, agendador de 30 min, endpoints
    do painel protegidos por chave de serviço.
  - Banco: tabelas dentro do **banco único do Nucleos** ([banco-unico-nucleos.md](../dados/banco-unico-nucleos.md)).
  - Front: rota `/setores/financeiro/vendas` com filtros, indicadores, gráfico, rankings e últimas vendas.
  - Contrato compartilhado em `packages/contracts` e configuração tipada em `packages/config`.
- **Fora do escopo:** login real e papéis (lote `web-001` não implementado); multi-organização/tenant;
  webhooks da Hotmart; exportação (CSV/PDF); previsões; o conceito de "funcionários de IA" (o usuário o
  propôs durante a sessão e depois pediu para **não** fazê-lo); deploy.

## 3. Resumo da implementação

1. **Banco único:** schema `financeiro` (`vendas`, `sincronizacao_estado`) no Postgres do Docker
   (`nucleos_dev`). Migrations SQL forward-only aplicadas por `migrar-banco.sh`.
2. **Sincronização:** `HotmartClient` obtém token (`client_credentials`), consulta o histórico de vendas
   **um status por vez**, pagina por `page_token`, tenta de novo em `429/5xx` e normaliza cada venda. O
   e-mail do comprador vira um pseudônimo HMAC; nome e e-mail **não** são guardados.
3. **Rotina de 30 min:** `Agendador` roda ao subir a API e a cada `HOTMART_SYNC_INTERVAL` (padrão 30 min),
   sem sobrepor execuções; um *advisory lock* do Postgres impede duas instâncias ao mesmo tempo. Janela:
   backfill de 90 dias na primeira vez; depois, desde o último sucesso menos 2 dias; uma vez por dia
   reconsulta 30 dias para pegar reembolsos tardios.
4. **API:** `GET /v1/vendas/painel`, `GET /v1/vendas`, `GET|POST /v1/vendas/sincronizacao`. Exigem
   `Authorization: Bearer <chave de serviço>`; sem chave configurada respondem 503 (falha fechada).
5. **Front:** Server Components buscam no servidor (a chave lida de arquivo nunca vai ao navegador),
   tratam os quatro estados do manual e desenham o gráfico em SVG, com tabela equivalente para leitores
   de tela. O card "Painel de vendas" aparece em Financeiro.

## 4. Mudanças por arquivo

| Arquivo | Tipo | Descrição |
| --- | --- | --- |
| `apps/api/migrations/0001_vendas.up.sql` | migração | Schema `financeiro`, tabelas `vendas` e `sincronizacao_estado`, índices e checks |
| `apps/api/src/migrar.ts` | código | Runner de migrations (advisory lock, checksum, 1 transação por arquivo); senha via `--senha-stdin` |
| `apps/api/src/banco.ts` | código | Monta as opções do `pg.Pool` por componentes (a `connectionString` sobrescreveria a senha) |
| `apps/api/src/main.ts` | código | Lê a config de vendas, cria o pool e registra o módulo quando há `DATABASE_URL` |
| `apps/api/src/app.module.ts` | código | `AppModule.comModulos([...])` para compor módulos opcionais |
| `apps/api/src/vendas/dominio.ts` | código | `Venda`, status da Hotmart, grupos (`receita`/`reembolso`/`cancelada`/`pendente`), centavos |
| `apps/api/src/vendas/hotmart-client.ts` | código | OAuth, paginação, retentativa, normalização, erros tipados sem vazamento |
| `apps/api/src/vendas/sincronizacao.ts` | código | Janela, lock, falha parcial, estado persistido |
| `apps/api/src/vendas/agendador.ts` | código | Execução periódica sem sobreposição |
| `apps/api/src/vendas/repositorio.ts`, `repositorio-pg.ts` | código | Interface e implementação Postgres (upsert em lote, agregados, lock) |
| `apps/api/src/vendas/periodo.ts` | código | Períodos no fuso America/Sao_Paulo, período anterior, preenchimento da série |
| `apps/api/src/vendas/painel.service.ts` | código | Monta o `PainelVendas` |
| `apps/api/src/vendas/chave-servico.guard.ts` | código | Guard de bearer em tempo constante |
| `apps/api/src/vendas/vendas.controller.ts`, `vendas.module.ts` | código | Rotas, validação de query, wiring do Nest |
| `apps/api/src/**/*.test.ts` (6 arquivos) | teste | `hotmart-client`, `sincronizacao`, `apoio` (domínio/período/guard/agendador), `vendas.http`, `banco`, `integracao-pg` |
| `apps/api/package.json` | config | `pg` e `@types/pg` (8.23.1, versão exata); script `migrar` |
| `packages/config/src/vendas.ts` (+ `index.ts`, `vendas.test.ts`) | código/teste | `loadVendasConfig`: credenciais só por arquivo, intervalo, janela de backfill |
| `packages/contracts/src/vendas.ts` (+ `index.ts`) | código | Tipos do painel compartilhados por API e front |
| `apps/web/lib/vendas-api.ts` | código | Busca no servidor com chave de arquivo, estados de falha |
| `apps/web/lib/vendas-formato.ts` + `apps/web/app/vendas-formato.test.ts` | código/teste | Formatação pt-BR, variação, filtros da URL, geometria do gráfico |
| `apps/web/app/(app)/setores/financeiro/vendas/**` | código | Página, 6 componentes e CSS module |
| `apps/web/app/(app)/setores/financeiro/page.tsx` | código | Card de acesso ao painel |
| `apps/web/package.json`, `pnpm-lock.yaml` | config | Dependência de workspace `@nucleos/contracts`; lockfile com `pg` |
| `infrastructure/docker/scripts/migrar-banco.sh` | config | Aplica migrations no Postgres do Docker sem expor a senha |
| `CLAUDE.md` | doc | Regra do banco único |
| `.gitignore` | config | Ignora `.secrets/`, `secrets/`, `*.secret` e os nomes sugeridos dos arquivos de segredo (`hotmart_client_id`, `hotmart_client_secret`, `vendas_api_key`, `db_password`), para credenciais lidas via `*_FILE` não irem ao Git por engano |

## 5. Decisões técnicas, alternativas e consequências

- **Banco único (decisão do usuário):** tudo em um banco, um schema por assunto. Alternativa descartada:
  banco por funcionalidade/tenant (ADR-003/017). Consequência: isolamento por tenant fica como decisão
  futura. Detalhes e pendência do nome do banco em [banco-unico-nucleos.md](../dados/banco-unico-nucleos.md).
- **`pg` como dependência nova** (autorizada pelo usuário): driver oficial, sem ORM, coerente com o SQL
  puro do ADR-017.
- **Chave de serviço em arquivo (decisão do usuário)** em vez de abrir o endpoint ou implementar o login
  agora. É provisória e será trocada pelo login e pela autorização por papel.
- **Uma consulta por status:** o histórico da Hotmart devolve só alguns status por padrão; consultar cada um
  dá visão de reembolsos e cancelamentos. Se a Hotmart recusar um status (HTTP 400), isso aparece como
  falha parcial no painel, não é escondido.
- **Receita líquida estimada = bruta − taxa da Hotmart.** Não considera comissões de coprodutor/afiliado.
- **`PARTIALLY_REFUNDED` conta como receita:** o valor devolvido não vem neste endpoint; superestima um
  pouco a receita nesse caso.
- **Pseudônimo do comprador com HMAC usando o segredo do cliente:** permite contar compradores únicos sem
  guardar dado pessoal. Rotacionar o segredo muda os pseudônimos (a contagem de únicos entre períodos
  antes/depois da rotação se separa).
- **Agendador em processo**, sem fila nem cron externo: simples para o MVP; o lock do banco garante
  segurança com mais de uma instância.
- **Gráfico em SVG no servidor**, sem biblioteca: nenhuma dependência nova no front, com tabela acessível.
- **Filtros por `GET`:** endereço compartilhável e sem JavaScript no cliente.
- **Migrator por comando separado**, com senha por entrada padrão: alinhado ao ADR-017 (migração não roda
  na subida do serviço) e funciona no Windows, onde a leitura de segredo por arquivo (0600) não funciona.

## 6. Validações (comandos e resultados reais)

| Comando | Resultado |
| --- | --- |
| `tsc -p tsconfig.json` em `packages/config`, `packages/contracts`, `apps/api` | sem erros |
| `tsc --noEmit` em `apps/web` | sem erros |
| `node --test dist/vendas/*.test.js dist/banco.test.js dist/health.test.js` (api) | 30 de 30 passaram (inclui 5 testes HTTP do Nest com guard, validação e 503) |
| `node --test dist/integracao-pg.test.js` (api) com `TEST_DATABASE_URL` local, contra o Postgres do Docker | 4 de 4 passaram (migrations do zero/idempotência/checksum, upsert, agregados com fuso e moeda, estado e lock). O banco temporário do teste é removido ao final |
| `node --test dist/vendas.test.js` (`packages/config`) | 3 de 3 passaram |
| `node --test "dist/**/*.test.js"` (`packages/contracts`) | 173 de 173 passaram |
| `node --test app/vendas-formato.test.ts` (web) | 9 de 9 passaram |
| `node --test "dist/**/*.test.js"` (`packages/config`, suíte completa) | 11 de 17 passaram; **6 falham por ambiente Windows**: testes preexistentes de `config.test.ts` esperam caminhos iniciados por `/` e permissão 0600 de arquivo, que o Windows não oferece. Não envolvem os arquivos alterados aqui; não foram reexecutados em Linux |
| `eslint --quiet` em `apps/api/src`, `apps/web/lib`, `apps/web/app`, `packages/config/src`, `packages/contracts/src` | 0 erros (restam só avisos `security/*`, padrão do repositório) |
| `depcruise apps packages --config .dependency-cruiser.cjs` | nenhuma violação (127 módulos) |
| `prettier --check` nos arquivos desta tarefa | ok. (O `prettier --check` do repositório inteiro acusa 49 arquivos preexistentes sem formatação, que não foram tocados) |
| `next build` (`apps/web`) | ok; `/setores/financeiro/vendas` aparece como dinâmica |
| `infrastructure/docker/scripts/migrar-banco.sh` (2 vezes) | 1ª: `0001_vendas.up.sql` aplicada em `nucleos_dev`; 2ª: "nada a aplicar" |
| Smoke de renderização: `next start` + API de mentira só no scratchpad | página com 200, todos os blocos presentes, formato pt-BR correto, chave **não** aparece no HTML; com a API fora do ar, mensagem de erro `role="alert"` |

**O que não foi executado e por quê**

- **Nada foi testado contra a Hotmart real.** Não há credenciais e a documentação em
  `developers.hotmart.com` é renderizada por JavaScript, então não consegui lê-la nesta sessão. Os endereços,
  parâmetros (`max_results`, `start_date`/`end_date` em milissegundos, `transaction_status`, `page_token`) e
  nomes de campos da resposta (`purchase.transaction`, `order_date`, `price.value`, `hotmart_fee.total`,
  `payment.type`...) vêm do meu conhecimento da API e estão cobertos por testes com respostas simuladas.
  O host de sandbox também é suposição. **Antes de confiar nos números, rode com credenciais de sandbox ou
  produção e confira.**
- `make lint`, `make test`, `make build`, `make contracts-check`, gitleaks e o CI não foram executados (o
  ambiente é Windows; rodei os equivalentes por pacote). Como os tipos do contrato foram escritos à mão em
  `packages/contracts/src/vendas.ts` (como o `HealthResponse`), o `contracts-check` não os cobre.
- A API completa com `DATABASE_PASSWORD_FILE` (leitura de segredo 0600) não foi iniciada no Windows; a
  fiação foi exercitada por teste HTTP com um pool falso e pelo teste de integração com Postgres real.

Configuracao atualizada pela [revisao do .env](../transversal/2026-11-01-configuracao-env-mvp.md).

## 7. Impactos, riscos, compatibilidade, observabilidade e rollback

- **Como configurar (API):** `DATABASE_URL` (sem senha) e `DATABASE_PASSWORD` no `.env` da raiz;
  `HOTMART_CLIENT_ID` e `HOTMART_CLIENT_SECRET` (sempre em par); `HOTMART_ENV`
  (`production` ou `sandbox`); `HOTMART_SYNC_INTERVAL` (padrão `30m`, de `1m` a `24h`);
  `HOTMART_BACKFILL_DAYS` (padrão 90); `VENDAS_API_KEY`. Segredos no `.env`; `*_FILE` permanece opcional, sem configurar as duas fontes.
  Sem credenciais da Hotmart a API sobe, mas a sincronização fica desativada (o painel avisa).
- **Como configurar (web):** `VENDAS_API_KEY_FILE` (a mesma chave) e, se a API não estiver em
  `http://127.0.0.1:3001`, `VENDAS_API_URL`.
- **Como aplicar as tabelas:** `bash infrastructure/docker/scripts/migrar-banco.sh` (precisa de `make build`).
- **Riscos:** (1) suposições sobre a API da Hotmart (seção 6); (2) chave de serviço estática é uma
  proteção provisória; (3) painel financeiro sem autorização por papel; (4) primeira sincronização baixa
  até 90 dias e pode demorar; (5) a Hotmart limita requisições: o cliente respeita `Retry-After` e tem
  limite de tentativas, mas 17 consultas por rodada devem ser medidas em produção.
- **Compatibilidade:** mudança aditiva; a API sem `DATABASE_URL` continua subindo como antes (o módulo de
  vendas só liga quando há banco). Nova dependência: `pg`.
- **Observabilidade:** logs de uma linha por rodada (`vendas: sincronizacao <resultado> (<n> registros)`),
  sem dados de venda. O estado da última rodada (sucesso/parcial/falha, quando, quantas vendas e uma
  mensagem fixa) é mostrado no painel e em `GET /v1/vendas/sincronizacao`.
- **Privacidade (LGPD):** e-mail e nome do comprador não são persistidos nem expostos; a tela mostra só os
  8 primeiros caracteres do pseudônimo.
- **Rollback:** remover `DATABASE_URL` desliga o módulo sem tocar nos dados. Para remover as tabelas,
  crie uma nova migration (roll-forward) que descarte o schema `financeiro` — não edite a migration 0001.

## 8. Commits e diffs

- Branch `developer`, `HEAD` `8129a39`, base `54a9aa7` (merge-base com `origin/main`).
- **Nenhum commit criado nesta tarefa.**
- Diffs da árvore de trabalho (modificados e novos): [2026-11-01-painel-de-vendas-hotmart-diffs.md](2026-11-01-painel-de-vendas-hotmart-diffs.md).
- Arquivos de `documentacoes/` e `lessons/` desta entrega (fora do patch, para evitar recursão):
  `documentacoes/financeiro/2026-11-01-painel-de-vendas-hotmart.md`, `…-diffs.md`,
  `documentacoes/dados/banco-unico-nucleos.md`, `lessons/00 - Migracoes SQL forward-only no PostgreSQL.md`
  (atualizada), `lessons/16 - …md`, `lessons/17 - …md` e `lessons/README.md` (atualizado).

## 9. Lessons

- [16 - Sincronização idempotente com API externa](../../lessons/16%20-%20Sincronizacao%20idempotente%20com%20API%20externa.md) (nova)
- [17 - Painel de dados com Server Components no Next.js](../../lessons/17%20-%20Painel%20de%20dados%20com%20Server%20Components%20no%20Next.js.md) (nova)
- [00 - Migrações SQL forward-only no PostgreSQL](../../lessons/00%20-%20Migracoes%20SQL%20forward-only%20no%20PostgreSQL.md) (atualizada: banco único com schemas)
- Índice: [lessons/README.md](../../lessons/README.md)

## 10. Pendências

1. **Validar com a Hotmart real** (credenciais de sandbox/produção): conferir endpoints, parâmetros,
   campos e respostas reais. Endpoints, parametros e 17 status conferidos na documentacao em 2026-11-01; ver a entrega de atualizacao manual. Ajustar o `hotmart-client.ts` se algo divergir.
2. **Nome definitivo do banco único:** o container tem `nucleos_dev` (usado aqui) e um `nucleos_control`
   (schemas `iam`/`tenancy`) de outro checkout; consolidar quando o login real for integrado.
3. **Trocar a chave de serviço** pelo login real e pela autorização por papel.
4. **Arquivos de build obsoletos para apagar à mão** (ignorados pelo Git; a remoção foi bloqueada pelas
   permissões desta sessão): `apps/api/dist/funcionarios/`, `apps/api/dist/vendas/executor.*` e
   `packages/contracts/dist/funcionarios.*`. Um `node --test "dist/**/*.test.js"` em `apps/api` falha
   enquanto esses testes antigos existirem, e um build comum não remove saídas antigas.
5. **Rodar em Linux/CI:** `make lint`, `make test`, `make build`, `make contracts-check`, gitleaks e a suíte
   completa de `packages/config` (6 falhas aqui são do Windows).
6. Decidir o isolamento por tenant (ADR próprio) antes de haver mais de uma organização com dados reais.

## Atualizacao manual e Client Token

O painel oferece Atualizar agora e aguarda a sincronizacao antes de renovar os dados.
HOTMART_CLIENT_TOKEN passou a ser lido do ambiente. Endpoints oficiais, autenticacao e
status foram conferidos. Registro: [atualizacao manual](2026-11-01-atualizacao-manual-hotmart.md).
