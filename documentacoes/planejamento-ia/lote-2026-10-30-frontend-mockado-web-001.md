# LOC-WEB-001 — Fundação navegável do frontend com dados mockados

> Especificação canônica local do lote [frontend mockado](lote-2026-10-30-frontend-mockado.md). Origem: redirecionamento explícito do usuário em 2026-10-30. Sem ID externo. Perfil **padrão**.

## Objetivo

Transformar o scaffold de `apps/web` em uma experiência navegável e responsiva que permita validar a direção visual do NÚCLEOS usando somente dados mockados tipados, enquanto novas frentes de backend e do motor de IA permanecem pausadas.

## Relação com o backlog

Esta tarefa prepara partes visuais de `WEB-001`, `WEB-003` e `WEB-005`, mas **não conclui nenhum deles**. Autenticação real, seleção segura de organização, cliente de API, SSE/polling, autorização e layout vindo do tenant continuam pendentes nos tickets canônicos do EP-10.

## Escopo incluído

- shell do produto em Next.js com navegação, organização ativa mockada e identificação explícita de ambiente de demonstração;
- dashboard com métricas, agentes, tarefas, aprovações, orçamento e atividade recente a partir de fixtures TypeScript locais;
- representação visual do escritório/prédio e departamentos sem WebGL ou nova dependência, suficiente para validar hierarquia e navegação;
- estados de carregamento, vazio e erro demonstráveis por fixtures/variante local;
- layout responsivo, navegação por teclado, landmarks semânticos, contraste e foco visível;
- testes proporcionais do modelo mockado e das transformações de apresentação;
- documentação de entrega e lesson aplicável, sem alegar integração real.

## Fora de escopo

- qualquer endpoint, banco, fila, autenticação, cookie, token, autorização ou chamada de rede;
- motor de agentes, execução de fluxo de IA ou alteração dos PoCs do EP-00;
- fechar critérios de aceite que exigem backend, tenant real, SSE ou dados reais;
- nova biblioteca de componentes, gráficos, ícones ou 3D; dependência nova exige decisão posterior explícita;
- deploy, push, PR ou publicação externa.

## Critérios de aceite

- **WEB-MOCK-AC-01:** `/` apresenta shell, contexto da organização mockada e indicação visível de dados de demonstração.
- **WEB-MOCK-AC-02:** dashboard renderiza métricas e listas derivadas de fixtures tipadas, sem `fetch`, credenciais ou acesso a serviço externo.
- **WEB-MOCK-AC-03:** a área visual de departamentos/agentes funciona em desktop e viewport móvel sem perda do conteúdo essencial.
- **WEB-MOCK-AC-04:** estados normal, vazio e erro são representáveis de modo determinístico no modelo local e cobertos por teste.
- **WEB-MOCK-AC-05:** controles interativos têm nome acessível, foco visível e operação por teclado; a página usa landmarks e hierarquia de títulos coerentes.
- **WEB-MOCK-AC-06:** `make lint`, `make test` e `make build` passam no ambiente suportado; qualquer limitação de versão é registrada sem inventar sucesso.
- **WEB-MOCK-AC-07:** entrega, diffs, lesson e índice de lessons descrevem o resultado real e apontam de volta para esta especificação.

## Arquivos esperados

`apps/web/app/` (página, estilos e componentes locais), `apps/web/lib/` ou equivalente para fixtures/modelo, testes do web app, `documentacoes/interface-web/` e `lessons/`. Evitar alterações fora desse recorte salvo configuração estritamente necessária e justificada.

## Validação e risco

Executar testes focais do `apps/web` e os gates da raiz. O principal risco é o mock cristalizar contratos inexistentes; por isso, fixtures devem ficar atrás de uma fronteira local clara e os tickets reais continuam abertos. Não usar dados pessoais ou segredos.

