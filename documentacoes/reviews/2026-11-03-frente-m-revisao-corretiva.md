# Revisão independente da frente M — FIN-301

Data: 2026-11-03, America/Sao_Paulo. Revisor: Codex, coordenador desta retomada,
independente do executor da implementação. Modo: revisão corretiva enxuta do plano avulso.
Base: `a1a0b0e`; implementação: `4690f1c8a2982fbceb0d6ea7e94adb90c6703de3`;
candidata final: `adaa9b7cbbd037373facf800dbcdd032b40678db`.
Branch: `feat/lote-1102-m-meta-ads`.

## Resultado

Leitura independente e conferência de falha de preparação concluídas. Um achado médio
de limpeza da fixture foi corrigido no único ciclo, commit `bf0a20e177c2d7668ba871d87f496a92b8e2ce64`.
**Revisão ainda não aprovada:** os testes essenciais de PostgreSQL/HTTP não foram executados
nesta retomada. A autorização do ambiente temporário foi solicitada ao usuário e permanece
pendente. Não interpretar a correção em código como PASS de integração ou aceite visual.

## Cobertura e evidências

- Cliente Meta: GET com origem/rota fixas, versão explícita, credencial em cabeçalho,
  redirecionamentos rejeitados, cursor reconstruído sem visitar `paging.next`, limites
  de páginas/itens, timeout e cancelamento. Erros não propagam corpo externo, URL ou token.
- Normalização: validação de datas e janela; moeda BRL explícita; conversão decimal em
  `BigInt`; uma única série de compras reportadas, sem somar categorias sobrepostas.
- Repositório: transação cobre conta/campanhas/gastos; lock por conta; upsert pela chave
  campanha/dia; verificação de lease e rollback. A leitura de código não comprova o
  comportamento concorrente ou transacional de PostgreSQL em execução.
- Migrations 0020/0021: chaves e constraints, seed idempotente de atribuição/agendamento,
  cron de seis horas e ausência de alteração nas migrations já existentes.
- Composição/configuração: segredo encapsulado, tarefa indisponível sem o par completo
  de credenciais; estados PAUSADO/DESATIVADO preservados; otimização continua indisponível.
- API: guard de chave de serviço nas duas rotas GET, período validado antes da consulta,
  parâmetros SQL vinculados e valores monetários/IDs representados como strings.
- Testes lidos: sete unitários de cliente/configuração e cenários PG/HTTP de migrations,
  estados do catálogo, reimportação, falhas, rollback, execução pelo motor e autenticação.
- `git diff --check a1a0b0e..HEAD`: PASS na candidata congelada; árvore inicialmente limpa.
  Evidências de build, sete unitários, ESLint, Prettier e Gitleaks estão no
  [registro da implementação](../financeiro/2026-11-03-importacao-meta-ads.md).
  Checks já aprovados não foram repetidos sem alteração de fonte.

## Achados e correções

**RM-01 — MÉDIO — banco temporário podia permanecer após falha de preparação.**
Em `apps/api/src/marketing/marketing-pg.test.ts`, o hook `before` cria o banco e aplica
migrations antes de inicializar `app`. Se uma migration ou a criação da aplicação falha,
o antigo `after` começava com `await app.close()` sobre recurso ainda ausente. Esse erro
impedia `pool.end`, `DROP DATABASE` e `admin.end`. Uma falha no próprio close também
interrompia as etapas seguintes. A sequência é demonstrável no código da candidata;
o cenário não foi executado contra PostgreSQL nesta retomada.

A correção registra cada recurso após sua aquisição, identifica se o banco chegou a
ser criado e usa blocos `finally` para tentar toda a limpeza, inclusive o encerramento
da conexão administrativa quando o DROP falha. Não altera SQL de negócio nem acessa
o banco de desenvolvimento. O [patch corretivo completo](2026-11-03-frente-m-revisao-corretiva-diffs.md)
corresponde ao commit `bf0a20e`.

Validação da correção: `tsc -p tsconfig.json --noEmit` da API, ESLint focal,
Prettier focal e `git diff --check` PASS. Os sete testes anteriores não foram repetidos,
pois o cliente/configuração não mudaram. Execução da fixture PG e comprovação da
limpeza real continuam NÃO VALIDADAS, dentro da mesma pendência de ambiente.
Nenhum outro achado médio/alto/crítico conhecido permanece no código lido.
Lesson 16 e índice atualizados com a limpeza mesmo após preparação incompleta.
Patch corretivo conferido contra o diff commitado; 39 links relativos conferidos nos
cinco documentos do fechamento, nenhum ausente. `git diff --check`: PASS.

## Pendências para concluir

1. Resolver a declaração do ambiente de teste: o plano e banco-unico-nucleos.md, seção
   Testes, admitem bancos temporários, mas AGENTS.md, seção Dados, só declara containers
   descartáveis de PoC e exige declaração naquela seção. O core local ainda não foi
   declarado ali como ambiente deste teste. Sem resposta
   explícita do usuário, não executar esse acesso nem alterar as regras para permiti-lo.
2. Executar os cenários PG/HTTP já escritos em ambiente autorizado; registrar resultado
   real e verificar remoção dos bancos temporários. Falha própria deve ser corrigida e
   validada dentro do único ciclo corretivo, sem reiniciar uma revisão completa.
3. Integrar na ordem do plano após revisão concluída; resolver composição com B e aplicar
   os checks integrados pertinentes. Migrations de desenvolvimento não estão autorizadas
   por este relatório.
4. Ativação com credencial Meta e roteiro manual M continuam pendentes para o usuário.

As falhas gerais preexistentes de configuração/caminhos Unix no Windows e de formatação
em arquivos não alterados estão registradas na implementação; não receberam PASS.
