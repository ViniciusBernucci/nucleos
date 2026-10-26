# Regressao dos controles de qualidade (ENT-FND-002)

Estes arquivos violam de proposito as regras de lint, tipagem e arquitetura. Eles NAO sao
codigo do produto: sao excluidos de ESLint, Prettier, ruff e dependency-cruiser nas execucoes
normais, e so sao lidos por `tools/qualidade/regressao.mjs` (`make lint-regressao`), que
confirma que cada violacao FALHA com a regra esperada. Se um controle deixar de pegar sua
violacao, o runner falha. O segredo sintetico nao e armazenado: e gerado em tempo de execucao.
