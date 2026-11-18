# Consolidação das regras e execução proporcional
Data: 2026-11-02. Repositório nucleos; branch developer.
Base: c5427047db13c8bb84e3a635298e94e89105caea, árvore já modificada.
Pedido: executar os ajustes de eficiência após investigação de contexto/tokens.
Nenhum commit criado nesta tarefa.

AGENTS.md concentra regras; CLAUDE.md e Antigravity apontam para a fonte única.
Preservados PostgreSQL único/schemas, proteção de dados/segredos, documentação,
lessons quando aplicáveis, autorização Git e testes proporcionais. Procedimentos
completos foram movidos para documentacoes/engenharia/, sem apagar histórico.
README não reinstala automaticamente o Node legado; scripts/contexto-projeto.json
aponta uma regra canônica.

Skills conectadas recebem modelo, orçamento justificado, fontes por trecho e
preparação separada dos checks direcionados/integrados. Grill-me e avulso preservados.
Sem alteração do código da aplicação, planos/snapshots antigos ou worktrees canceladas.
Entrega não significa aprovação funcional de tela.

Lessons: NA. Mudança de regras/configuração de fluxo externo, sem conceito novo de
TypeScript/Python/Docker/PostgreSQL no produto ou mudança nos exemplos existentes.
Procedimentos e links da trilha continuam obrigatórios.

Rollback: restaurar somente os arquivos desta tarefa à base registrada e
ressincronizar mirrors; não usar reset global nem substituir trabalho anterior.
Os diffs próprios e resultados de validação acompanham este documento.

## Prova real limitada (2026-11-02)

Run 7f77b916aaffffd79e29d24c6968a703: CANCELLED pelo timeout de 180 segundos. Claude 2.1.226, modelo observado claude-opus-5, effort medium, compactação solicitada em 100000, teto externo 160000. Duas mensagens e duas ferramentas; entrada normalizada observada 23736, saída 241; custo completo desconhecido. Sem PASS nem artefato concluído. A primeira ferramenta Bash (ls do fixture) demorou cerca de 80,5 segundos e retornou aviso stty sem TTY. Não é evidência de erro de tokens nem de leitura de documentação. A causa precisa dessa latência não foi demonstrada; não foram alterados perfis pessoais ou variáveis não documentadas.

A segunda chamada direta foi cancelada do desenho antes de iniciar: sem par comparável não há A/B válido nem economia comprovada. --autocompact foi aceito pelo cliente, mas não houve compact_boundary neste piloto; o tratamento do evento foi validado por replay sintético em teste Go. Não significa validar preservação de requisitos em compactação real. Não forçar 100k tokens artificiais. Antes de comparar novamente, diagnosticar a inicialização Bash no Windows e repetir a prova pequena, não um lote de login. Runs antigos do Núcleos não foram retomados.

## Validações desta entrega

- Testes Go finais de execution, agent, cli e workflow: 145 PASS, 0 SKIP, 0 falhas.
- Gerador Node: 17 PASS, zero falhas/skips, incluindo pipeline real com executor falso e entrega local.
- go vet ./... concluído sem diagnósticos; binário final compilado.
- A tentativa de suíte completa NÃO ficou limpa: dois testes de liveness/detach em Windows falharam e testrunner de navegador atingiu timeout. Três falhas de workflow eram fixtures ausentes na cópia e passaram após copiá-los no teste final. Não atribuir falhas de host automaticamente à alteração, nem declarar suíte completa aprovada.
- Código do produto Núcleos não alterado; não foram executados testes de tela/API/banco do produto nesta entrega de regras.

[Diffs próprios desta tarefa](2026-11-02-eficiencia-fluxo-ia-diffs.md).

## Fechamento da validação

A repetição isolada de daemon e testrunner passou: 21 testes, zero falhas. Workflow passou após completar os fixtures da cópia. Considerando a suíte completa e as reexecuções dos pacotes que inicialmente falharam: 398 testes PASS, 3 SKIP e nenhuma falha remanescente. O comando inicial completo retornou falha; essa condição foi resolvida nas reexecuções descritas, sem alterar esses pacotes. Os testes finais adicionais de execução/CLI também passaram (77), incluindo o novo caso de override.

Planos com modelo fixado agora recusam --with para outro provider sem modelo de destino no catálogo. Catálogos antigos sem modelo mantêm compatibilidade explícita. As duas cópias de skills terminaram sincronizadas: 17 skills, 87 arquivos por destino, zero divergências; archify foi preservado no Núcleos. Binário recompilado no repositório do compilador. Nenhum run histórico retomado e nenhum commit/push criado.

## Continuação e validação real concluída — 2026-11-02

Pedido de prosseguimento atendido: novo fixture isolado, fora do produto, com o mesmo prompt/modelo/esforço/flags e ambiente filtrado. Compilador: DONE, 61199 tokens normalizados, 937 de saída, cinco mensagens/ferramentas, três testes passando. Direto: PASS, 61943 de entrada normalizada, 935 de saída, cinco mensagens/ferramentas e os mesmos testes passando. Prompt SHA-256 b10215dbed10a7588706c3843dde86991a9bb0b4bbaa55404c8894714f6565c9.

B primeiro, A depois: cache/ordem impedem atribuir a diferença de preço a eficiência do produto. O perfil Bash contribuiu com 6–11 segundos em sondas sem IA; a causa integral da lentidão anterior não foi demonstrada. Sem editar preferências pessoais. Compactação real não foi acionada, preservando a limitação explícita da prova. Estado da implementação: concluída; validação operacional pequena concluída, sem afirmação de economia para login completo.

Somente documentação e recibo foram acrescentados nesta continuação. Nenhuma mudança adicional de código/configuração, binário, skills, lessons, banco ou estado de runs do Núcleos; os diffs de implementação anteriores continuam válidos. Lessons continuam NA pelo escopo externo. Nenhum commit criado nesta tarefa. Rollback desta continuação: remover somente este registro documental; sem reset global.

## Commit local posterior em 2026-11-06

O usuario autorizou consolidar as alteracoes prontas na developer, sem QA. Conteudo registrado no commit `21c3d7dc9c0f4c0e3fe26dafab5ed927529255f6`. Os resultados anteriores acima permanecem historicos; as conferencias novas, limites e diffs estao no [fechamento integrado](2026-11-06-consolidacao-pendencias-locais.md). Nenhum run antigo foi retomado.
