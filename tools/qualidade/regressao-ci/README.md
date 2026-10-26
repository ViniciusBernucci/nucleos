# Regressao do CI (ENT-FND-005)

Fixtures que violam de proposito as politicas dos gates do CI. Nao sao codigo do produto: ficam
fora de lint/scanners normais (`--skip-dirs tools/qualidade`, `osv-scanner -L` explicito, hadolint
sem este diretorio) e so sao lidas por `tools/qualidade/regressao-ci.mjs` (`make ci-regressao`),
que confirma que cada gate FALHA diante da sua violacao. Segredo sintetico: ver `regressao.mjs`
(gerado em tempo de execucao, nunca armazenado). Casos dependentes de rede (osv-scanner, pip-audit,
trivy) sao ignorados com `CI_REGRESSAO_OFFLINE=1`; no CI nunca sao ignorados.
